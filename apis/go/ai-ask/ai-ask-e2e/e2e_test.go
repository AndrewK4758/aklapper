package aiask_e2e_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit/e2etest"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

func make768Vec(val float32) []float32 {
	v := make([]float32, llm.ExpectedEmbeddingDims)
	for i := range v {
		v[i] = val
	}
	return v
}

func guestHeaders(t *testing.T, sub, secret string) map[string]string {
	t.Helper()
	tok, err := internalauth.Sign(internalauth.RoleGuest, sub, time.Minute, secret)
	if err != nil {
		t.Fatalf("sign guest token: %v", err)
	}
	return map[string]string{internalauth.HeaderName: tok}
}

func envWithout(drop ...string) []string {
	blocked := map[string]bool{}
	for _, k := range drop {
		blocked[k] = true
	}
	var out []string
	for _, kv := range os.Environ() {
		idx := strings.IndexByte(kv, '=')
		if idx <= 0 || blocked[kv[:idx]] {
			continue
		}
		out = append(out, kv)
	}
	return out
}

func TestAiAskEndToEnd(t *testing.T) {
	if strings.TrimSpace(os.Getenv("DATABASE_URL")) == "" {
		t.Fatal("DATABASE_URL must be set for ai-ask-e2e (live PG19 strict startup)")
	}

	var embedFail atomic.Bool
	var chatFail atomic.Bool
	var chatModeJD atomic.Bool
	var qdrantEmpty atomic.Bool
	var qdrantLowScore atomic.Bool
	var qdrantStatusFail atomic.Bool

	llmServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/embeddings":
			if embedFail.Load() {
				http.Error(w, "embed unavailable", http.StatusServiceUnavailable)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"data": []map[string]any{{"embedding": make768Vec(0.25)}},
			})
		case "/v1/chat/completions":
			if chatFail.Load() {
				http.Error(w, "chat backend error", http.StatusInternalServerError)
				return
			}
			content := "Grounded answer citing Portfolio Architecture."
			if chatModeJD.Load() {
				content = `{"answer":"Strong match for Go microservices and React SSR.","matchScore":88,"strengths":["Go microservices on GKE","PostgreSQL 19 & Qdrant RAG"],"gaps":["Rust embedded experience not indexed"]}`
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"choices": []map[string]any{{"message": map[string]any{"content": content}}},
				"usage":   map[string]any{"total_tokens": 42},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(llmServer.Close)

	var prunedCount atomic.Int32
	qdrantServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/collections/portfolio_docs":
			if qdrantStatusFail.Load() {
				http.Error(w, "qdrant secret internal connection error", http.StatusBadGateway)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"result": map[string]any{
					"status":       "green",
					"points_count": 3,
					"config": map[string]any{
						"params": map[string]any{
							"vectors": map[string]any{
								"size":     llm.ExpectedEmbeddingDims,
								"distance": "Cosine",
							},
						},
					},
				},
			})
		case r.Method == http.MethodPut && r.URL.Path == "/collections/portfolio_docs":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"result":true}`))
		case r.Method == http.MethodPut && r.URL.Path == "/collections/portfolio_docs/points":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"ok"}`))
		case r.Method == http.MethodPost && r.URL.Path == "/collections/portfolio_docs/points/scroll":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"result": map[string]any{
					"points":           []map[string]any{{"id": qdrant.PortfolioPointID("stale-e2e-point", 0)}},
					"next_page_offset": nil,
				},
			})
		case r.Method == http.MethodPost && r.URL.Path == "/collections/portfolio_docs/points/delete":
			var body struct {
				Points []any `json:"points"`
			}
			_ = json.NewDecoder(r.Body).Decode(&body)
			prunedCount.Add(int32(len(body.Points)))
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"ok"}`))
		case r.Method == http.MethodPost && r.URL.Path == "/collections/portfolio_docs/points/search":
			if qdrantEmpty.Load() {
				_ = json.NewEncoder(w).Encode(map[string]any{"result": []any{}})
				return
			}
			score := 0.94
			if qdrantLowScore.Load() {
				score = 0.22
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"result": []map[string]any{{
					"id":    qdrant.PortfolioPointID("curated:architecture", 0),
					"score": score,
					"payload": map[string]any{
						"docId":    "curated:architecture",
						"title":    "Portfolio Architecture",
						"snippet":  "Monorepo built with Go, Node 26, React Router SSR, Kubernetes GKE, and PostgreSQL 19.",
						"category": "architecture",
					},
				}},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(qdrantServer.Close)

	const secret = "e2e-ai-ask-secret"
	baseURL := e2etest.StartBinary(
		t,
		"../ai-ask",
		"APP_ENV=production",
		"INTERNAL_AUTH_SECRET="+secret,
		"LOCAL_LLM_BASE_URL="+llmServer.URL+"/v1",
		"LOCAL_LLM_CHAT_MODEL=e2e-chat",
		"LOCAL_LLM_EMBED_MODEL=embedding",
		"QDRANT_URL="+qdrantServer.URL,
	)

	t.Run("Binary fails closed on empty DATABASE_URL or production missing INTERNAL_AUTH_SECRET", func(t *testing.T) {
		absDir, _ := filepath.Abs("../ai-ask")
		binPath := filepath.Join(t.TempDir(), "ai-ask-strict-check")
		out, buildErr := exec.Command("go", "build", "-o", binPath, ".").CombinedOutput()
		if buildErr != nil {
			// Build from explicit dir
			c := exec.Command("go", "build", "-o", binPath, ".")
			c.Dir = absDir
			if o, err := c.CombinedOutput(); err != nil {
				t.Fatalf("build strict binary: %v\n%s\n%s", err, string(out), string(o))
			}
		}

		noDB := exec.Command(binPath)
		noDB.Env = append(envWithout("DATABASE_URL"), "DATABASE_URL=", "APP_ENV=production", "INTERNAL_AUTH_SECRET="+secret)
		if _, err := noDB.CombinedOutput(); err == nil {
			t.Fatal("expected ai-ask startup failure when DATABASE_URL is empty")
		}

		noSecret := exec.Command(binPath)
		noSecret.Env = append(envWithout("INTERNAL_AUTH_SECRET"), "APP_ENV=production", "INTERNAL_AUTH_SECRET=")
		if _, err := noSecret.CombinedOutput(); err == nil {
			t.Fatal("expected ai-ask startup failure when APP_ENV=production and INTERNAL_AUTH_SECRET empty")
		}
	})

	t.Run("GET /healthz and /v1/ask/status enforce signed internal auth and return healthy and redacted 503", func(t *testing.T) {
		res, health := e2etest.DoJSON[httpkit.HealthResponse](t, http.MethodGet, baseURL+"/healthz", nil, nil)
		if res.StatusCode != http.StatusOK || !health.OK || health.Service != "ai-ask" {
			t.Fatalf("unexpected healthz (%d): %+v", res.StatusCode, health)
		}

		resUnauth, _ := e2etest.DoJSON[httpkit.ErrorResponse](t, http.MethodGet, baseURL+"/v1/ask/status", nil, nil)
		if resUnauth.StatusCode != http.StatusUnauthorized {
			t.Fatalf("expected 401 without internal auth header, got %d", resUnauth.StatusCode)
		}

		serviceTok, err := internalauth.Sign(internalauth.RoleService, "e2e-portal", time.Minute, secret)
		if err != nil {
			t.Fatalf("sign service token: %v", err)
		}
		serviceHeaders := map[string]string{internalauth.HeaderName: serviceTok}

		resS, out := e2etest.DoJSON[contracts.AskServiceStatus](t, http.MethodGet, baseURL+"/v1/ask/status", nil, serviceHeaders)
		if resS.StatusCode != http.StatusOK || out.Status != "ready" || !out.PGConnected {
			t.Fatalf("unexpected status (%d): %+v", resS.StatusCode, out)
		}

		qdrantStatusFail.Store(true)
		defer qdrantStatusFail.Store(false)
		res503, body := e2etest.DoRequest(t, http.MethodGet, baseURL+"/v1/ask/status", nil, serviceHeaders)
		if res503.StatusCode != http.StatusServiceUnavailable || strings.Contains(string(body), "secret internal connection") {
			t.Fatalf("expected redacted 503 status, got (%d): %s", res503.StatusCode, string(body))
		}
	})

	t.Run("POST /v1/ask/reindex indexes 768-dim UUIDv5 points with admin auth", func(t *testing.T) {
		resF, _ := e2etest.DoRequest(t, http.MethodPost, baseURL+"/v1/ask/reindex", nil, nil)
		if resF.StatusCode != http.StatusForbidden {
			t.Fatalf("expected 403, got %d", resF.StatusCode)
		}

		tok, _ := internalauth.Sign(internalauth.RoleAdmin, "e2e-admin", time.Minute, secret)
		resOK, out := e2etest.DoJSON[map[string]any](
			t, http.MethodPost, baseURL+"/v1/ask/reindex", nil, map[string]string{internalauth.HeaderName: tok},
		)
		if resOK.StatusCode != http.StatusOK || int(out["vectorSize"].(float64)) != llm.ExpectedEmbeddingDims {
			t.Fatalf("unexpected reindex (%d): %+v", resOK.StatusCode, out)
		}
		if prunedCount.Load() != 1 {
			t.Fatalf("expected 1 stale point pruned in E2E reindex, got %d", prunedCount.Load())
		}
	})

	t.Run("POST /v1/ask authenticates, grounds QA & JD Match, polls /v1/ask/turns/:id, and fails closed 502 on backend failure", func(t *testing.T) {
		resUnauth, _ := e2etest.DoJSON[contracts.PublicAppError](
			t, http.MethodPost, baseURL+"/v1/ask", map[string]string{"question": "What stack?"}, nil,
		)
		if resUnauth.StatusCode != http.StatusUnauthorized {
			t.Fatalf("expected 401 without X-Internal-Auth, got %d", resUnauth.StatusCode)
		}

		attemptQA := "11111111-1111-4111-8111-111111111121"
		headers := guestHeaders(t, "e2e-qa-guest", secret)
		resQA, outQA := e2etest.DoJSON[contracts.AskResponse](
			t, http.MethodPost, baseURL+"/v1/ask",
			map[string]string{"mode": "qa", "attemptId": attemptQA, "question": "What stack powers this portfolio?"},
			headers,
		)
		if resQA.StatusCode != http.StatusOK || !outQA.Grounded || outQA.TokensUsed != 42 || outQA.Quota == nil || outQA.Quota.TokensUsed != 42 {
			t.Fatalf("unexpected QA response (%d): %+v", resQA.StatusCode, outQA)
		}

		// Recovery GET /v1/ask/turns/:attemptId returns completed turn without extra debit
		resPoll, pollOut := e2etest.DoJSON[contracts.AskTurnState](
			t, http.MethodGet, baseURL+"/v1/ask/turns/"+attemptQA, nil, headers,
		)
		if resPoll.StatusCode != http.StatusOK || pollOut.Status != contracts.TurnStatusCompleted || pollOut.Response == nil {
			t.Fatalf("unexpected turn lookup (%d): %+v", resPoll.StatusCode, pollOut)
		}

		// AI JD Match
		chatModeJD.Store(true)
		defer chatModeJD.Store(false)
		resJD, outJD := e2etest.DoJSON[contracts.AskResponse](
			t, http.MethodPost, baseURL+"/v1/ask",
			map[string]string{"mode": "jd_match", "jobDescription": "Principal engineer building Go microservices on GKE with React SSR and PostgreSQL."},
			guestHeaders(t, "e2e-jd-guest", secret),
		)
		if resJD.StatusCode != http.StatusOK || !outJD.Grounded || outJD.MatchScore == nil || *outJD.MatchScore != 88 {
			t.Fatalf("unexpected JD response (%d): %+v", resJD.StatusCode, outJD)
		}

		// Upstream failure -> HTTP 502 (not 200 abstention) + quota refund
		embedFail.Store(true)
		failHeaders := guestHeaders(t, "e2e-fail-guest", secret)
		resFail, failErr := e2etest.DoJSON[contracts.PublicAppError](
			t, http.MethodPost, baseURL+"/v1/ask",
			map[string]string{"mode": "qa", "question": "Should fail closed 502"},
			failHeaders,
		)
		embedFail.Store(false)
		if resFail.StatusCode != http.StatusBadGateway || failErr.Code != contracts.ErrCodeUpstreamUnavailable {
			t.Fatalf("expected 502 PublicAppError on embed error, got (%d): %+v", resFail.StatusCode, failErr)
		}
		_ = pg.DefaultAskTurnReserveTokens // compile check that pg kit aligns cleanly
	})

	t.Run("POST /v1/ask enforces guest session 5-turn quota with HTTP 429", func(t *testing.T) {
		headers := guestHeaders(t, "e2e-quota-guest", secret)
		for i := range 5 {
			res, _ := e2etest.DoJSON[contracts.AskResponse](
				t, http.MethodPost, baseURL+"/v1/ask",
				map[string]string{"question": "Check quota turn tracking"},
				headers,
			)
			if res.StatusCode != http.StatusOK {
				t.Fatalf("turn %d expected 200, got %d", i+1, res.StatusCode)
			}
		}
		resOver, body := e2etest.DoJSON[map[string]any](
			t, http.MethodPost, baseURL+"/v1/ask",
			map[string]string{"question": "Sixth turn rejected"},
			headers,
		)
		if resOver.StatusCode != http.StatusTooManyRequests || body["quota"] == nil {
			t.Fatalf("expected 429 with quota, got (%d): %+v", resOver.StatusCode, body)
		}
	})
}
