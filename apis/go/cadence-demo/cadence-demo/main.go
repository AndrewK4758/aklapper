package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	cadencev1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/cadence/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/k8sevents"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

type gateVerdictRequest struct {
	Verdict string `json:"verdict"`
}

func newHandler(provider llm.Provider, vectorStore *qdrant.Client, store *pg.Store) http.Handler {
	privacyCfg, _ := privacy.LoadConfig(privacy.ConfigInput{})
	return newHandlerWithDeps(cadenceServiceDeps{
		provider:    provider,
		vectorStore: vectorStore,
		store:       store,
		privacyCfg:  privacyCfg,
	})
}

func newHandlerWithDeps(deps cadenceServiceDeps) http.Handler {
	if deps.store == nil {
		deps.store = pg.NewMemoryStore()
	}
	if deps.privacyCfg == nil {
		deps.privacyCfg, _ = privacy.LoadConfig(privacy.ConfigInput{})
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpkit.NewHealthHandler("cadence-demo"))

	mux.HandleFunc("GET /v1/cadence/runs", func(w http.ResponseWriter, r *http.Request) {
		claims, ok := httpkit.RequireInternalAuth(w, r)
		if !ok {
			return
		}

		candidate := strings.TrimSpace(r.URL.Query().Get("sessionId"))
		if candidate == "" {
			candidate = strings.TrimSpace(r.Header.Get("X-Session-Id"))
		}
		role := contracts.RoleGuest
		if claims.Role == internalauth.RoleAdmin {
			role = contracts.RoleAdmin
		}
		sessionID, authOK := resolveAuthorizedSession(w, r, claims, candidate, role != contracts.RoleAdmin)
		if !authOK {
			return
		}

		limit := 10
		if rawLimit := strings.TrimSpace(r.URL.Query().Get("limit")); rawLimit != "" {
			if parsed, err := strconv.Atoi(rawLimit); err == nil && parsed > 0 && parsed <= 50 {
				limit = parsed
			}
		}

		runs, err := deps.store.ListSandboxRuns(r.Context(), sessionID, limit)
		if err != nil {
			httpkit.WriteError(w, http.StatusInternalServerError, "failed to list sandbox runs")
			return
		}
		quota, _ := deps.store.GetQuotaStatus(r.Context(), role, sessionID)

		httpkit.WriteJSON(w, http.StatusOK, map[string]any{
			"runs":  runs,
			"quota": quota,
		})
	})

	mux.HandleFunc("GET /v1/cadence/runs/{id}/stream", handleRunStream(deps))

	mux.HandleFunc("POST /v1/cadence/runs/{id}/gate", func(w http.ResponseWriter, r *http.Request) {
		claims, ok := httpkit.RequireInternalAuth(w, r)
		if !ok {
			return
		}
		runID := strings.TrimSpace(r.PathValue("id"))
		if runID == "" {
			httpkit.WriteError(w, http.StatusBadRequest, "missing run id")
			return
		}
		headerSession := strings.TrimSpace(r.Header.Get("X-Session-Id"))
		if headerSession == "" && (claims == nil || strings.TrimSpace(claims.Sub) == "") {
			logCadenceSeam("UNSOUND_CONDITION", "cadence.stream.session_mismatch_or_missing", "critical", map[string]any{
				"runId":  runID,
				"reason": "missing_session",
			})
			httpkit.WriteError(w, http.StatusUnauthorized, "missing X-Session-Id header")
			return
		}
		sessionID, authOK := resolveAuthorizedSession(w, r, claims, headerSession, false)
		if !authOK {
			return
		}
		var req gateVerdictRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid JSON payload")
			return
		}

		updated, err := deps.store.UpdateSandboxGateVerdictForSession(
			r.Context(),
			runID,
			sessionID,
			strings.TrimSpace(req.Verdict),
		)
		if err != nil {
			switch {
			case errors.Is(err, pg.ErrInvalidVerdict):
				httpkit.WriteError(w, http.StatusBadRequest, err.Error())
			case errors.Is(err, pg.ErrGoldenRunImmutable):
				logCadenceSeam("UNSOUND_CONDITION", "cadence.gate.golden_mutation_blocked", "critical", map[string]any{
					"runId": runID,
				})
				httpkit.WriteError(w, http.StatusConflict, err.Error())
			case errors.Is(err, pg.ErrRunNotFound):
				httpkit.WriteError(w, http.StatusNotFound, err.Error())
			case errors.Is(err, pg.ErrForbiddenSession):
				logCadenceSeam("UNSOUND_CONDITION", "cadence.stream.session_mismatch_or_missing", "critical", map[string]any{
					"runId":  runID,
					"reason": "gate_session_mismatch",
				})
				httpkit.WriteError(w, http.StatusForbidden, err.Error())
			case errors.Is(err, pg.ErrRunNotReady):
				httpkit.WriteError(w, http.StatusConflict, err.Error())
			default:
				httpkit.WriteError(w, http.StatusInternalServerError, "failed to update gate verdict")
			}
			return
		}

		readyStatus, osc := buildReadyStatus()
		contractRun := pg.SandboxRunToContractResult(updated, nil, &readyStatus, osc)
		httpkit.WriteJSON(w, http.StatusOK, map[string]any{
			"runId":       updated.RunID,
			"gateVerdict": updated.GateVerdict,
			"status":      updated.Status,
			"run":         contractRun,
		})
	})

	mux.HandleFunc("POST /v1/cadence/runs", func(w http.ResponseWriter, r *http.Request) {
		claims, ok := httpkit.RequireInternalAuth(w, r)
		if !ok {
			return
		}
		var req contracts.CadenceRunRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid JSON payload")
			return
		}
		if err := req.Validate(); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}

		role := contracts.RoleGuest
		if claims.Role == internalauth.RoleAdmin {
			role = contracts.RoleAdmin
		}
		candidateSession := strings.TrimSpace(req.SessionID)
		if candidateSession == "" {
			candidateSession = strings.TrimSpace(r.Header.Get("X-Session-Id"))
		}
		sessionID, authOK := resolveAuthorizedSession(w, r, claims, candidateSession, false)
		if !authOK {
			return
		}
		if sessionID == "" {
			sessionID = "anonymous"
		}

		presetSlug := strings.TrimSpace(req.PresetSlug)
		if presetSlug == "" {
			if req.DeferExecution {
				presetSlug = "custom"
			} else {
				presetSlug = "chord-decomposition-workbench"
			}
		}

		mode := strings.TrimSpace(req.Mode)
		if mode == "" {
			if req.DeferExecution {
				mode = contracts.CadenceModeFast
			} else {
				mode = contracts.CadenceModeLLM
			}
		}

		// Pre-quota scoped prompt_hash cache lookup -> $0 isolated session-owned clone on hit.
		cacheRes, cacheErr := resolveCacheLookupAndClone(
			r.Context(),
			deps.store,
			sessionID,
			"portal-proxy",
			presetSlug,
			mode,
			strings.TrimSpace(req.Prompt),
		)
		if cacheErr == nil && cacheRes.Hit && cacheRes.ClonedRun != nil {
			quota, _ := deps.store.GetQuotaStatus(r.Context(), role, sessionID)
			readyStatus, osc := buildReadyStatus()
			res := pg.SandboxRunToContractResult(cacheRes.ClonedRun, &quota, &readyStatus, osc)
			httpkit.WriteJSON(w, http.StatusCreated, res)
			return
		}

		if req.DeferExecution {
			pendingRun, quota, allowed, initErr := deps.store.CreatePendingSandboxRunWithQuota(
				r.Context(),
				role,
				sessionID,
				1,
				800,
				pg.PendingSandboxRunInput{
					SessionID:  sessionID,
					IPHash:     "portal-proxy",
					PresetSlug: presetSlug,
					Prompt:     strings.TrimSpace(req.Prompt),
					Mode:       mode,
					PromptHash: cacheRes.PromptHash,
				},
			)
			if initErr != nil {
				httpkit.WriteError(w, http.StatusInternalServerError, "failed to initialize sandbox run")
				return
			}
			if !allowed {
				httpkit.WriteJSON(w, http.StatusTooManyRequests, map[string]any{
					"error": "Session or daily CADENCE quota exceeded.",
					"quota": quota,
				})
				return
			}
			pct := 0
			queuedStatus := contracts.Osc7501Status{
				Source:    "cadence-demo",
				State:     contracts.CadenceStatusRunning,
				Label:     "CHORD pipeline queued (" + mode + ")",
				Progress:  &pct,
				Timestamp: time.Now().UTC(),
			}
			res := pg.SandboxRunToContractResult(pendingRun, &quota, &queuedStatus, k8sevents.FormatOSC7501(queuedStatus))
			httpkit.WriteJSON(w, http.StatusAccepted, res)
			return
		}

		quota, allowed, quotaErr := deps.store.CheckAndConsumeQuota(r.Context(), role, sessionID, 1, 800)
		if quotaErr != nil {
			httpkit.WriteError(w, http.StatusInternalServerError, "failed to evaluate quota")
			return
		}
		if !allowed {
			httpkit.WriteJSON(w, http.StatusTooManyRequests, map[string]any{
				"error": "Session or daily CADENCE quota exceeded.",
				"quota": quota,
			})
			return
		}

		logCadenceSeam("RULE_DIVERGENCE", "cadence.run.execution_branch", "info", map[string]any{
			"branch": mode + "-go",
		})

		execOut, execErr := executeChordStepsWithOptions(r.Context(), chordExecInput{
			Provider:    deps.provider,
			VectorStore: deps.vectorStore,
			Store:       deps.store,
			PrivacyCfg:  deps.privacyCfg,
			CorrID:      strings.TrimSpace(r.Header.Get("X-Correlation-Id")),
			Prompt:      req.Prompt,
			PresetSlug:  presetSlug,
			Mode:        mode,
		})
		if execErr != nil {
			if errors.Is(execErr, privacy.ErrPrivacyAborted) {
				httpkit.WriteError(w, http.StatusForbidden, "output blocked by privacy boundary")
				return
			}
			httpkit.WriteError(w, http.StatusInternalServerError, "failed to execute sandbox run")
			return
		}

		runID, err := deps.store.CreateSandboxRun(r.Context(), pg.SandboxRunInput{
			SessionID:     sessionID,
			IPHash:        "portal-proxy",
			MenuSlug:      presetSlug,
			Prompt:        req.Prompt,
			Status:        contracts.CadenceStatusReady,
			GateVerdict:   "pending",
			TokensIn:      execOut.TokensIn,
			TokensOut:     execOut.TokensOut,
			ArtifactHTML:  execOut.ArtifactHTML,
			PromptHash:    cacheRes.PromptHash,
			ExecutionMode: execOut.ExecutionMode,
			SpecJSON:      execOut.Spec,
			GateAuditJSON: execOut.GateAudit,
		})
		if err != nil {
			httpkit.WriteError(w, http.StatusInternalServerError, "failed to persist sandbox run")
			return
		}

		turns := make([]contracts.CadenceTurn, 0, len(execOut.Turns))
		for _, ti := range execOut.Turns {
			ti.RunID = runID
			recorded, turnErr := deps.store.InsertSandboxTurn(r.Context(), ti)
			if turnErr == nil {
				turns = append(turns, recorded)
			}
		}

		res := contracts.CadenceRunResult{
			RunID:         runID,
			Prompt:        req.Prompt,
			PresetSlug:    presetSlug,
			RunStatus:     contracts.CadenceStatusReady,
			Mode:          mode,
			ExecutionMode: execOut.ExecutionMode,
			IsGolden:      false,
			Spec:          execOut.Spec,
			GateAudit:     execOut.GateAudit,
			Status:        &execOut.Status,
			OSC7501:       execOut.OSC7501,
			GateVerdict:   "pending",
			Turns:         turns,
			ArtifactHTML:  execOut.ArtifactHTML,
			TokensIn:      execOut.TokensIn,
			TokensOut:     execOut.TokensOut,
			Quota:         &quota,
		}
		httpkit.WriteJSON(w, http.StatusCreated, res)
	})

	return mux
}

func main() {
	if _, err := llm.ParseVertexThinkingBudget(os.Getenv("VERTEX_THINKING_BUDGET")); err != nil {
		log.Fatalf("cadence-demo invalid VERTEX_THINKING_BUDGET: %v", err)
	}
	privacyCfg, err := privacy.LoadConfigFromEnv()
	if err != nil {
		log.Fatalf("cadence-demo invalid privacy denylist configuration: %v", err)
	}
	_ = llm.IsDevUnlimitedEnabled()

	store := pg.OpenBestEffort(context.Background())
	defer store.Close()

	deps := cadenceServiceDeps{
		provider:    llm.NewFromEnv(),
		vectorStore: qdrant.NewFromEnv(),
		store:       store,
		privacyCfg:  privacyCfg,
	}
	httpHandler := newHandlerWithDeps(deps)
	addr := httpkit.ListenAddr("8082")
	grpcAddr := grpckit.GRPCListenAddr()

	var grpcSrv httpkit.GRPCGracefulServer
	if grpcAddr != "" {
		srv, _ := grpckit.NewServer("", "cadence.v1.CadenceService")
		cadencev1.RegisterCadenceServiceServer(srv, newCadenceGRPCServer(deps))
		grpcSrv = srv
		log.Printf("cadence-demo listening on http=%s grpc=%s (pgLive=%v)", addr, grpcAddr, store.IsLivePG())
	} else {
		log.Printf("cadence-demo listening on http=%s (gRPC disabled: GRPC_PORT empty, pgLive=%v)", addr, store.IsLivePG())
	}

	if err := httpkit.ListenAndServeDualGracefulSignals(httpkit.DualServerConfig{
		HTTPAddr:    addr,
		HTTPHandler: httpHandler,
		GRPCAddr:    grpcAddr,
		GRPCServer:  grpcSrv,
	}); err != nil {
		log.Fatal(err)
	}
}
