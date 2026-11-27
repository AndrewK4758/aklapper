package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/gen/cadence/v1/cadencev1connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
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
	healthHandler := httpkit.NewHealthHandler("cadence-demo")
	mux.HandleFunc("GET /health", healthHandler)
	mux.HandleFunc("GET /healthz", healthHandler)

	mux.HandleFunc("GET /v1/cadence/runs", func(w http.ResponseWriter, r *http.Request) {
		claims, ok := httpkit.RequireInternalAuth(w, r)
		if !ok {
			return
		}
		candidate := strings.TrimSpace(r.URL.Query().Get("sessionId"))
		if candidate == "" {
			candidate = strings.TrimSpace(r.Header.Get("X-Session-Id"))
		}
		limit := 10
		if rawLimit := strings.TrimSpace(r.URL.Query().Get("limit")); rawLimit != "" {
			if parsed, err := strconv.Atoi(rawLimit); err == nil && parsed > 0 && parsed <= 50 {
				limit = parsed
			}
		}
		corrID := strings.TrimSpace(r.Header.Get("X-Correlation-Id"))
		runs, quota, svcErr := executeListRuns(r.Context(), deps, claims, candidate, true, limit, corrID)
		if svcErr != nil {
			httpkit.WriteError(w, svcErr.HTTPStatus, svcErr.Error.Message)
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, map[string]any{
			"runs":  runs,
			"quota": quota,
		})
	})

	mux.HandleFunc("GET /v1/cadence/runs/{id}/stream", handleRunStream(deps))

	mux.HandleFunc("POST /v1/cadence/runs/{id}/spec-gate", func(w http.ResponseWriter, r *http.Request) {
		claims, ok := httpkit.RequireInternalAuth(w, r)
		if !ok {
			return
		}
		corrID := strings.TrimSpace(r.Header.Get("X-Correlation-Id"))
		updated, contractRun, quota, svcErr := executeApproveSpecGate(
			r.Context(), deps, claims, r.PathValue("id"), r.Header.Get("X-Session-Id"), corrID,
		)
		if svcErr != nil {
			httpkit.WriteError(w, svcErr.HTTPStatus, svcErr.Error.Message)
			return
		}
		httpkit.WriteJSON(w, http.StatusAccepted, map[string]any{
			"runId":  updated.RunID,
			"status": updated.Status,
			"run":    contractRun,
			"quota":  quota,
		})
	})

	mux.HandleFunc("POST /v1/cadence/runs/{id}/gate", func(w http.ResponseWriter, r *http.Request) {
		claims, ok := httpkit.RequireInternalAuth(w, r)
		if !ok {
			return
		}
		var req gateVerdictRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid JSON payload")
			return
		}
		corrID := strings.TrimSpace(r.Header.Get("X-Correlation-Id"))
		updated, contractRun, svcErr := executeSubmitGateVerdict(
			r.Context(), deps, claims, r.PathValue("id"), r.Header.Get("X-Session-Id"), req.Verdict, corrID,
		)
		if svcErr != nil {
			httpkit.WriteError(w, svcErr.HTTPStatus, svcErr.Error.Message)
			return
		}
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
		candidateSession := strings.TrimSpace(req.SessionID)
		if candidateSession == "" {
			candidateSession = strings.TrimSpace(r.Header.Get("X-Session-Id"))
		}
		corrID := strings.TrimSpace(r.Header.Get("X-Correlation-Id"))
		res, createdImmediately, svcErr := executeCreateRun(r.Context(), deps, claims, req, candidateSession, corrID)
		if svcErr != nil {
			if svcErr.HTTPStatus == http.StatusTooManyRequests && svcErr.Quota != nil {
				httpkit.WriteJSON(w, http.StatusTooManyRequests, map[string]any{
					"error": svcErr.Error.Message,
					"quota": svcErr.Quota,
				})
				return
			}
			httpkit.WriteError(w, svcErr.HTTPStatus, svcErr.Error.Message)
			return
		}
		status := http.StatusAccepted
		if createdImmediately {
			status = http.StatusCreated
		}
		httpkit.WriteJSON(w, status, res)
	})

	grpcHealthPath, grpcHealthHandler := grpckit.NewHealthHandler("cadence.v1.CadenceService")
	mux.Handle(grpcHealthPath, grpcHealthHandler)
	cadencePath, cadenceGRPCHandler := cadencev1connect.NewCadenceServiceHandler(
		newCadenceConnectServer(deps),
		grpckit.NewHandlerOptions("")...,
	)
	mux.Handle(cadencePath, grpckit.NewGRPCOnlyMiddleware(cadenceGRPCHandler))
	return mux
}

func main() {
	if _, err := internalauth.ResolveSecret(""); err != nil {
		logCadenceSeam("UNSOUND_CONDITION", "grpc.startup.secret_missing", "critical", map[string]any{
			"service": "cadence-demo",
		})
		log.Fatalf("cadence-demo production auth startup failure: %v", err)
	}
	if _, err := llm.ParseVertexThinkingLevel(os.Getenv("VERTEX_THINKING_LEVEL")); err != nil {
		log.Fatalf("cadence-demo invalid VERTEX_THINKING_LEVEL: %v", err)
	}
	privacyCfg, err := privacy.LoadConfigFromEnv()
	if err != nil {
		log.Fatalf("cadence-demo invalid privacy denylist configuration: %v", err)
	}
	_ = llm.IsDevUnlimitedEnabled()

	store, err := pg.OpenServiceFromEnv(context.Background())
	if err != nil {
		log.Fatalf("cadence-demo failed to initialize PostgreSQL store: %v", err)
	}
	defer store.Close()

	deps := cadenceServiceDeps{
		provider:    llm.NewFromEnv(),
		vectorStore: qdrant.NewFromEnv(),
		store:       store,
		privacyCfg:  privacyCfg,
	}
	httpHandler := newHandlerWithDeps(deps)
	addr := httpkit.ListenAddr("8082")
	log.Printf("cadence-demo listening on single-port h2c=%s (pgLive=%v)", addr, store.IsLivePG())

	if err := httpkit.ListenAndServeH2CGracefulSignals(addr, httpHandler, 10*time.Second); err != nil {
		log.Fatal(err)
	}
}
