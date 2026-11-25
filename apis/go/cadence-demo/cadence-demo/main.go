package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/k8sevents"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

type gateVerdictRequest struct {
	Verdict string `json:"verdict"`
}

func newHandler(provider llm.Provider, vectorStore *qdrant.Client, store *pg.Store) http.Handler {
	if store == nil {
		store = pg.NewMemoryStore()
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpkit.NewHealthHandler("cadence-demo"))

	mux.HandleFunc("GET /v1/cadence/runs", func(w http.ResponseWriter, r *http.Request) {
		claims, ok := httpkit.RequireInternalAuth(w, r)
		if !ok {
			return
		}

		sessionID := strings.TrimSpace(r.URL.Query().Get("sessionId"))
		if sessionID == "" {
			sessionID = strings.TrimSpace(r.Header.Get("X-Session-Id"))
		}
		role := contracts.RoleGuest
		if claims.Role == internalauth.RoleAdmin {
			role = contracts.RoleAdmin
		}
		if sessionID == "" && role != contracts.RoleAdmin {
			httpkit.WriteError(w, http.StatusBadRequest, "sessionId is required")
			return
		}
		limit := 10
		if rawLimit := strings.TrimSpace(r.URL.Query().Get("limit")); rawLimit != "" {
			if parsed, err := strconv.Atoi(rawLimit); err == nil && parsed > 0 && parsed <= 50 {
				limit = parsed
			}
		}

		runs, err := store.ListSandboxRuns(r.Context(), sessionID, limit)
		if err != nil {
			httpkit.WriteError(w, http.StatusInternalServerError, "failed to list sandbox runs")
			return
		}
		quota, _ := store.GetQuotaStatus(r.Context(), role, sessionID)

		httpkit.WriteJSON(w, http.StatusOK, map[string]any{
			"runs":  runs,
			"quota": quota,
		})
	})

	mux.HandleFunc("GET /v1/cadence/runs/{id}/stream", handleRunStream(provider, vectorStore, store))

	mux.HandleFunc("POST /v1/cadence/runs/{id}/gate", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := httpkit.RequireInternalAuth(w, r); !ok {
			return
		}
		runID := strings.TrimSpace(r.PathValue("id"))
		if runID == "" {
			httpkit.WriteError(w, http.StatusBadRequest, "missing run id")
			return
		}
		sessionID := strings.TrimSpace(r.Header.Get("X-Session-Id"))
		if sessionID == "" {
			logCadenceSeam("UNSOUND_CONDITION", "cadence.stream.session_mismatch_or_missing", "critical", map[string]any{
				"runId":  runID,
				"reason": "missing_session",
			})
			httpkit.WriteError(w, http.StatusUnauthorized, "missing X-Session-Id header")
			return
		}
		var req gateVerdictRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid JSON payload")
			return
		}

		updated, err := store.UpdateSandboxGateVerdictForSession(
			r.Context(),
			runID,
			sessionID,
			strings.TrimSpace(req.Verdict),
		)
		if err != nil {
			switch {
			case errors.Is(err, pg.ErrInvalidVerdict):
				httpkit.WriteError(w, http.StatusBadRequest, err.Error())
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
		sessionID := strings.TrimSpace(req.SessionID)
		if sessionID == "" {
			sessionID = strings.TrimSpace(r.Header.Get("X-Session-Id"))
		}
		if sessionID == "" {
			sessionID = "anonymous"
		}
		presetSlug := strings.TrimSpace(req.PresetSlug)
		if presetSlug == "" {
			if req.DeferExecution {
				presetSlug = "custom"
			} else {
				presetSlug = "solar-forge-starter"
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

		if req.DeferExecution {
			pendingRun, quota, allowed, initErr := store.CreatePendingSandboxRunWithQuota(
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

		quota, allowed, quotaErr := store.CheckAndConsumeQuota(r.Context(), role, sessionID, 1, 800)
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

		execOut, execErr := executeChordSteps(
			r.Context(),
			provider,
			vectorStore,
			store,
			"",
			req.Prompt,
			presetSlug,
			mode,
			nil,
		)
		if execErr != nil {
			httpkit.WriteError(w, http.StatusInternalServerError, "failed to execute sandbox run")
			return
		}

		runID, err := store.CreateSandboxRun(r.Context(), pg.SandboxRunInput{
			SessionID:    sessionID,
			IPHash:       "portal-proxy",
			MenuSlug:     presetSlug,
			Prompt:       req.Prompt,
			Status:       contracts.CadenceStatusReady,
			GateVerdict:  "pending",
			TokensIn:     execOut.TokensIn,
			TokensOut:    execOut.TokensOut,
			ArtifactHTML: execOut.ArtifactHTML,
		})
		if err != nil {
			httpkit.WriteError(w, http.StatusInternalServerError, "failed to persist sandbox run")
			return
		}

		turns := make([]contracts.CadenceTurn, 0, len(execOut.Turns))
		for _, ti := range execOut.Turns {
			ti.RunID = runID
			recorded, turnErr := store.InsertSandboxTurn(r.Context(), ti)
			if turnErr == nil {
				turns = append(turns, recorded)
			}
		}

		res := contracts.CadenceRunResult{
			RunID:        runID,
			Prompt:       req.Prompt,
			PresetSlug:   presetSlug,
			RunStatus:    contracts.CadenceStatusReady,
			Mode:         mode,
			Status:       &execOut.Status,
			OSC7501:      execOut.OSC7501,
			GateVerdict:  "pending",
			Turns:        turns,
			ArtifactHTML: execOut.ArtifactHTML,
			TokensIn:     execOut.TokensIn,
			TokensOut:    execOut.TokensOut,
			Quota:        &quota,
		}
		httpkit.WriteJSON(w, http.StatusCreated, res)
	})

	return mux
}

func main() {
	addr := httpkit.ListenAddr("8082")
	store := pg.OpenBestEffort(context.Background())
	defer store.Close()

	log.Printf("cadence-demo listening on %s (pgLive=%v)", addr, store.IsLivePG())
	if err := httpkit.ListenAndServeGraceful(addr, newHandler(llm.NewFromEnv(), qdrant.NewFromEnv(), store)); err != nil {
		log.Fatal(err)
	}
}
