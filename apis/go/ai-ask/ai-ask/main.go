package main

import (
	"context"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

const (
	portfolioCollection = "portfolio_docs"
	minGroundScore      = 0.35
)

type askRequest struct {
	Mode           string `json:"mode"`
	Question       string `json:"question"`
	JobDescription string `json:"jobDescription"`
	AttemptID      string `json:"attemptId"`
	SessionID      string `json:"sessionId"`
	Role           string `json:"role"`
}

var curatedSummaryDocs = []pg.CorpusDocument{
	{
		ID:       "curated:architecture",
		Title:    "Portfolio Architecture // Cloud Run SSR + GKE Scale-to-Zero Go",
		Snippet:  "Andrew Klapper's Solar Forge v2 portfolio pairs React 19 + React Router 8 + Fastify 5 SSR on Cloud Run with scale-from-zero distroless Go microservices on GKE Autopilot, PostgreSQL 19, Qdrant cosine vector search, and strict 4-layer CSS tokens.",
		Category: "architecture",
		Source:   "curated",
	},
	{
		ID:       "curated:cadence-sandbox",
		Title:    "CADENCE CHORD Sandbox // Security & Quota Guardrails",
		Snippet:  "The CADENCE Builder runs a 4-phase CHORD pipeline (triage, spec, build, gate) persisted to PostgreSQL 19 sandbox_runs and sandbox_turns, enforcing transactional session/daily quotas, HTML sanitization, and an iframe strictly sandboxed with allow-scripts without allow-same-origin.",
		Category: "security",
		Source:   "curated",
	},
	{
		ID:       "curated:ai-rag",
		Title:    "Grounded AI Retrieval // Vertex AI + Local Llama-Swap + Qdrant",
		Snippet:  "Unified Node and Go LLM providers support local llama-swap on :11434 and live Google Cloud Vertex AI REST/ADC endpoints, paired with Qdrant cosine similarity thresholds and strict fail-closed abstention when evidence is missing or weak.",
		Category: "ai",
		Source:   "curated",
	},
}

func stringFromPayload(payload map[string]any, key, fallback string) string {
	if payload == nil {
		return fallback
	}
	if v, ok := payload[key].(string); ok && strings.TrimSpace(v) != "" {
		return strings.TrimSpace(v)
	}
	return fallback
}

func handleAskStatus(provider llm.Provider, vectorStore *qdrant.Client, store *pg.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		corrID := extractCorrelationID(r)
		w.Header().Set("X-Correlation-Id", corrID)

		pgErr := store.Ping(r.Context())
		if pgErr != nil {
			logAskEvent("ai_ask.status.pg_unavailable", map[string]any{
				"correlationId": corrID,
				"seam_type":     "BOUNDARY_FAULT",
			})
			httpkit.WriteJSON(w, http.StatusServiceUnavailable, map[string]any{
				"status":        "unavailable",
				"code":          contracts.ErrCodeDbUnavailable,
				"provider":      provider.Name(),
				"pgConnected":   false,
				"correlationId": corrID,
			})
			return
		}

		info, qErr := vectorStore.CollectionInfo(r.Context(), portfolioCollection)
		if qErr != nil {
			logAskEvent("ai_ask.status.qdrant_unavailable", map[string]any{
				"correlationId": corrID,
				"seam_type":     "BOUNDARY_FAULT",
			})
			httpkit.WriteJSON(w, http.StatusServiceUnavailable, contracts.AskServiceStatus{
				Status:      "degraded",
				Provider:    provider.Name(),
				PGConnected: store.IsLivePG(),
				Collection: &contracts.AskCollectionStatus{
					Name:        portfolioCollection,
					Status:      "unreachable",
					PointsCount: 0,
				},
			})
			return
		}

		httpkit.WriteJSON(w, http.StatusOK, contracts.AskServiceStatus{
			Status:      "ready",
			Provider:    provider.Name(),
			PGConnected: store.IsLivePG(),
			Collection: &contracts.AskCollectionStatus{
				Name:        portfolioCollection,
				Status:      info.Status,
				PointsCount: info.PointsCount,
				VectorSize:  info.VectorSize,
			},
		})
	}
}

func newHandler(provider llm.Provider, vectorStore *qdrant.Client, store *pg.Store) http.Handler {
	return newHandlerWithSyncWait(provider, vectorStore, store, defaultSyncWaitWindow)
}

func newHandlerWithSyncWait(provider llm.Provider, vectorStore *qdrant.Client, store *pg.Store, syncWait time.Duration) http.Handler {
	if store == nil {
		store = pg.NewMemoryStore()
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpkit.NewHealthHandler("ai-ask"))
	mux.HandleFunc("GET /v1/ask/status", handleAskStatus(provider, vectorStore, store))
	mux.HandleFunc("POST /v1/ask/reindex", handleReindex(provider, vectorStore, store))
	mux.HandleFunc("POST /v1/ask", handleAskPost(provider, vectorStore, store, syncWait))
	mux.HandleFunc("GET /v1/ask/turns/{attemptId}", handleTurnLookup(store))
	return mux
}

func main() {
	if _, err := internalauth.ResolveSecret(""); err != nil {
		log.Fatalf("ai-ask production auth startup failure: %v", err)
	}
	store, err := pg.OpenFromEnvStrict(context.Background())
	if err != nil {
		log.Fatalf("ai-ask strict postgres startup failure: %v", err)
	}
	defer store.Close()

	addr := httpkit.ListenAddr("8083")
	log.Printf("ai-ask listening on %s (pgLive=%v)", addr, store.IsLivePG())
	if err := httpkit.ListenAndServeGraceful(addr, newHandler(llm.NewFromEnv(), qdrant.NewFromEnv(), store)); err != nil {
		log.Fatal(err)
	}
}
