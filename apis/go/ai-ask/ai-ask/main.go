package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	ai_askv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/ai_ask/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
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
	ConversationID string `json:"conversationId,omitempty"`
	VisitorLens    string `json:"visitorLens,omitempty"`
	SessionID      string `json:"sessionId"`
	Role           string `json:"role"`
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

func newUUIDv4() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func extractCorrelationID(r *http.Request) string {
	if r != nil {
		if c := strings.TrimSpace(r.Header.Get("X-Correlation-Id")); c != "" && len(c) <= 128 {
			return c
		}
	}
	return newUUIDv4()
}

func hashPrompt(mode, text string) string {
	sum := sha256.Sum256([]byte(mode + ":" + text))
	return hex.EncodeToString(sum[:])
}

func writePublicError(w http.ResponseWriter, status int, code, msg, action, corrID string) {
	w.Header().Set("X-Correlation-Id", corrID)
	httpkit.WriteJSON(w, status, contracts.PublicAppError{
		Code:          code,
		Status:        status,
		Message:       msg,
		Action:        action,
		CorrelationID: corrID,
	})
}

func logAskEvent(event string, fields map[string]any) {
	fields["event"] = event
	raw, err := json.Marshal(fields)
	if err == nil {
		log.Println(string(raw))
	}
}

func handleAskStatus(provider llm.Provider, vectorStore *qdrant.Client, store *pg.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		corrID := extractCorrelationID(r)
		w.Header().Set("X-Correlation-Id", corrID)
		if _, ok := httpkit.RequireInternalAuth(w, r); !ok {
			return
		}

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
	privacyCfg, _ := privacy.LoadConfig(privacy.ConfigInput{})
	return newHandlerWithDeps(askStreamDeps{
		provider:    provider,
		vectorStore: vectorStore,
		store:       store,
		privacyCfg:  privacyCfg,
	}, syncWait)
}

func newHandlerWithDeps(deps askStreamDeps, syncWait time.Duration) http.Handler {
	if deps.store == nil {
		deps.store = pg.NewMemoryStore()
	}
	if deps.privacyCfg == nil {
		deps.privacyCfg, _ = privacy.LoadConfig(privacy.ConfigInput{})
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpkit.NewHealthHandler("ai-ask"))
	mux.HandleFunc("GET /v1/ask/status", handleAskStatus(deps.provider, deps.vectorStore, deps.store))
	mux.HandleFunc("POST /v1/ask/reindex", handleReindex(deps.provider, deps.vectorStore, deps.store))
	mux.HandleFunc("POST /v1/ask", handleAskPost(deps.provider, deps.vectorStore, deps.store, deps.privacyCfg, syncWait))
	mux.HandleFunc("POST /v1/ask/stream", handleAskStreamPost(deps))
	mux.HandleFunc("GET /v1/ask/turns/{attemptId}", handleTurnLookup(deps.store))
	return mux
}

func main() {
	if _, err := internalauth.ResolveSecret(""); err != nil {
		log.Fatalf("ai-ask production auth startup failure: %v", err)
	}
	if _, err := llm.ParseVertexThinkingBudget(os.Getenv("VERTEX_THINKING_BUDGET")); err != nil {
		log.Fatalf("ai-ask invalid VERTEX_THINKING_BUDGET: %v", err)
	}
	privacyCfg, err := privacy.LoadConfigFromEnv()
	if err != nil {
		log.Fatalf("ai-ask invalid privacy denylist configuration: %v", err)
	}
	// Evaluate AI_DEV_UNLIMITED once at startup so invalid prod/vertex overrides log loudly.
	_ = llm.IsDevUnlimitedEnabled()

	store, err := pg.OpenFromEnvStrict(context.Background())
	if err != nil {
		log.Fatalf("ai-ask strict postgres startup failure: %v", err)
	}
	defer store.Close()

	deps := askStreamDeps{
		provider:    llm.NewFromEnv(),
		vectorStore: qdrant.NewFromEnv(),
		store:       store,
		privacyCfg:  privacyCfg,
	}
	httpHandler := newHandlerWithDeps(deps, defaultSyncWaitWindow)
	addr := httpkit.ListenAddr("8083")
	grpcAddr := grpckit.GRPCListenAddr()

	var grpcSrv httpkit.GRPCGracefulServer
	if grpcAddr != "" {
		srv, _ := grpckit.NewServer("", "ai_ask.v1.AskService")
		ai_askv1.RegisterAskServiceServer(srv, newAskGRPCServer(deps))
		grpcSrv = srv
		log.Printf("ai-ask listening on http=%s grpc=%s (pgLive=%v)", addr, grpcAddr, store.IsLivePG())
	} else {
		log.Printf("ai-ask listening on http=%s (gRPC disabled: GRPC_PORT empty, pgLive=%v)", addr, store.IsLivePG())
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
