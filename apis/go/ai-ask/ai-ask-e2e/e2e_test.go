package aiask_e2e_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit/e2etest"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
)

type askResponse struct {
	Grounded   bool                   `json:"grounded"`
	Mode       string                 `json:"mode"`
	Provider   string                 `json:"provider"`
	Model      string                 `json:"model"`
	TokensUsed int                    `json:"tokensUsed"`
	Answer     string                 `json:"answer"`
	Sources    []contracts.AskSource  `json:"sources"`
	MatchScore *int                   `json:"matchScore,omitempty"`
	Strengths  []string               `json:"strengths,omitempty"`
	Gaps       []string               `json:"gaps,omitempty"`
	Quota      *contracts.QuotaStatus `json:"quota,omitempty"`
}

type reindexResponse struct {
	Indexed    int    `json:"indexed"`
	Collection string `json:"collection"`
	VectorSize int    `json:"vectorSize"`
	Provider   string `json:"provider"`
}

func TestAiAskEndToEnd(t *testing.T) {
	t.Parallel()

	var embedFail atomic.Bool
	var chatFail atomic.Bool
	var qdrantEmpty atomic.Bool
	var qdrantLowScore atomic.Bool

	llmServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/embeddings":
			if embedFail.Load() {
				http.Error(w, "embed unavailable", http.StatusServiceUnavailable)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"data": []map[string]any{
					{"embedding": []float32{0.12, 0.34, 0.56}},
				},
			})
		case "/v1/chat/completions":
			if chatFail.Load() {
				http.Error(w, "chat backend error", http.StatusInternalServerError)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"choices": []map[string]any{
					{"message": map[string]any{"content": "Grounded answer from portfolio evidence."}},
				},
				"usage": map[string]any{"total_tokens": 42},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(llmServer.Close)

	qdrantServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/collections/portfolio_docs":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"result": map[string]any{
					"status":       "green",
					"points_count": 3,
				},
			})
		case r.Method == http.MethodPut && r.URL.Path == "/collections/portfolio_docs":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"result":true}`))
		case r.Method == http.MethodPut && r.URL.Path == "/collections/portfolio_docs/points":
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
				"result": []map[string]any{
					{
						"id":    "doc-1",
						"score": score,
						"payload": map[string]any{
							"docId":    "doc-1",
							"title":    "Portfolio Architecture",
							"snippet":  "Monorepo built with Go, Node 26, React Router SSR, Kubernetes GKE, and PostgreSQL 19.",
							"category": "architecture",
						},
					},
				},
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
		"PG_DISABLE_LIVE=true",
		"INTERNAL_AUTH_SECRET="+secret,
		"LOCAL_LLM_BASE_URL="+llmServer.URL+"/v1",
		"LOCAL_LLM_CHAT_MODEL=e2e-chat",
		"LOCAL_LLM_EMBED_MODEL=e2e-embed",
		"QDRANT_URL="+qdrantServer.URL,
	)

	t.Run("GET /healthz returns service identity", func(t *testing.T) {
		res, health := e2etest.DoJSON[httpkit.HealthResponse](t, http.MethodGet, baseURL+"/healthz", nil, nil)
		if res.StatusCode != http.StatusOK {
			t.Fatalf("expected 200, got %d", res.StatusCode)
		}
		if !health.OK || health.Service != "ai-ask" || health.Time == "" {
			t.Fatalf("unexpected health payload: %+v", health)
		}
	})

	t.Run("GET /v1/ask/status returns collection status and provider", func(t *testing.T) {
		res, out := e2etest.DoJSON[map[string]any](t, http.MethodGet, baseURL+"/v1/ask/status", nil, nil)
		if res.StatusCode != http.StatusOK || out["status"] != "ready" || out["provider"] != "local-llama-swap" {
			t.Fatalf("unexpected status response (%d): %+v", res.StatusCode, out)
		}
	})

	t.Run("POST /v1/ask/reindex requires admin token and indexes corpus", func(t *testing.T) {
		resForbidden, _ := e2etest.DoJSON[httpkit.ErrorResponse](t, http.MethodPost, baseURL+"/v1/ask/reindex", nil, nil)
		if resForbidden.StatusCode != http.StatusForbidden {
			t.Fatalf("expected 403 without admin token, got %d", resForbidden.StatusCode)
		}

		tok, err := internalauth.Sign(internalauth.RoleAdmin, "e2e-admin", time.Minute, secret)
		if err != nil {
			t.Fatalf("sign admin token: %v", err)
		}
		resOK, out := e2etest.DoJSON[reindexResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/ask/reindex",
			nil,
			map[string]string{internalauth.HeaderName: tok},
		)
		if resOK.StatusCode != http.StatusOK {
			t.Fatalf("expected 200, got %d", resOK.StatusCode)
		}
		if out.Indexed < 3 || out.Collection != "portfolio_docs" || out.VectorSize != 3 {
			t.Fatalf("unexpected reindex response: %+v", out)
		}
	})

	t.Run("POST /v1/ask returns grounded qa completion with structured sources", func(t *testing.T) {
		embedFail.Store(false)
		chatFail.Store(false)
		qdrantEmpty.Store(false)
		qdrantLowScore.Store(false)

		res, out := e2etest.DoJSON[askResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/ask",
			map[string]string{
				"mode":      "qa",
				"sessionId": "e2e-qa-1",
				"question":  "What stack powers this portfolio monorepo?",
			},
			nil,
		)
		if res.StatusCode != http.StatusOK {
			t.Fatalf("expected 200, got %d", res.StatusCode)
		}
		if !out.Grounded || out.Mode != "qa" || out.Provider != "local-llama-swap" || out.Model != "e2e-chat" {
			t.Fatalf("unexpected grounded metadata: %+v", out)
		}
		if out.TokensUsed != 42 || len(out.Sources) != 1 || out.Sources[0].Title != "Portfolio Architecture" {
			t.Fatalf("unexpected completion payload: %+v", out)
		}
		if !strings.Contains(out.Answer, "Grounded answer") {
			t.Fatalf("unexpected answer: %q", out.Answer)
		}
	})

	t.Run("POST /v1/ask jd_match returns match score, strengths, and gaps", func(t *testing.T) {
		embedFail.Store(false)
		chatFail.Store(false)
		qdrantEmpty.Store(false)
		qdrantLowScore.Store(false)

		res, out := e2etest.DoJSON[askResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/ask",
			map[string]string{
				"mode":           "jd_match",
				"sessionId":      "e2e-jd-1",
				"jobDescription": "Principal engineer building Go microservices on Kubernetes GKE with React SSR and PostgreSQL.",
			},
			nil,
		)
		if res.StatusCode != http.StatusOK {
			t.Fatalf("expected 200, got %d", res.StatusCode)
		}
		if !out.Grounded || out.Mode != "jd_match" || out.MatchScore == nil || *out.MatchScore < 20 {
			t.Fatalf("unexpected jd_match response: %+v", out)
		}
		if len(out.Strengths) == 0 {
			t.Fatalf("expected grounded strengths in jd_match response: %+v", out)
		}
	})

	t.Run("POST /v1/ask abstains when Qdrant returns zero hits or low score", func(t *testing.T) {
		embedFail.Store(false)
		chatFail.Store(false)
		qdrantEmpty.Store(true)

		res, out := e2etest.DoJSON[askResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/ask",
			map[string]string{"sessionId": "e2e-empty", "question": "Tell me about an undocumented topic"},
			nil,
		)
		if res.StatusCode != http.StatusOK || out.Grounded || len(out.Sources) != 0 {
			t.Fatalf("expected zero-hit abstention, got (%d): %+v", res.StatusCode, out)
		}

		qdrantEmpty.Store(false)
		qdrantLowScore.Store(true)
		resLow, outLow := e2etest.DoJSON[askResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/ask",
			map[string]string{"sessionId": "e2e-low", "question": "Tell me about an unrelated topic"},
			nil,
		)
		if resLow.StatusCode != http.StatusOK || outLow.Grounded || len(outLow.Sources) != 0 {
			t.Fatalf("expected low-score abstention, got (%d): %+v", resLow.StatusCode, outLow)
		}
		qdrantLowScore.Store(false)
	})

	t.Run("POST /v1/ask abstains when embedding or chat provider fails", func(t *testing.T) {
		embedFail.Store(true)
		qdrantEmpty.Store(false)

		res, out := e2etest.DoJSON[askResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/ask",
			map[string]string{"sessionId": "e2e-embed-fail", "question": "Will embedding failure abstain cleanly?"},
			nil,
		)
		if res.StatusCode != http.StatusOK || out.Grounded || !strings.Contains(out.Answer, "embedding provider is unavailable") {
			t.Fatalf("expected embedding abstention, got (%d): %+v", res.StatusCode, out)
		}

		embedFail.Store(false)
		chatFail.Store(true)
		resChat, outChat := e2etest.DoJSON[askResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/ask",
			map[string]string{"sessionId": "e2e-chat-fail", "question": "Will chat failure abstain cleanly?"},
			nil,
		)
		if resChat.StatusCode != http.StatusOK || outChat.Grounded || !strings.Contains(outChat.Answer, "Abstaining") {
			t.Fatalf("expected chat-failure abstention, got (%d): %+v", resChat.StatusCode, outChat)
		}
		chatFail.Store(false)
	})

	t.Run("POST /v1/ask enforces guest session quota with HTTP 429", func(t *testing.T) {
		for i := range 5 {
			res, _ := e2etest.DoJSON[askResponse](
				t,
				http.MethodPost,
				baseURL+"/v1/ask",
				map[string]string{"sessionId": "e2e-quota-sess", "question": "Check quota turn tracking"},
				nil,
			)
			if res.StatusCode != http.StatusOK {
				t.Fatalf("turn %d expected 200, got %d", i+1, res.StatusCode)
			}
		}
		resOver, body := e2etest.DoJSON[map[string]any](
			t,
			http.MethodPost,
			baseURL+"/v1/ask",
			map[string]string{"sessionId": "e2e-quota-sess", "question": "Sixth turn should exceed guest quota"},
			nil,
		)
		if resOver.StatusCode != http.StatusTooManyRequests || body["quota"] == nil {
			t.Fatalf("expected 429 with quota payload, got (%d): %+v", resOver.StatusCode, body)
		}
	})

	t.Run("POST /v1/ask rejects invalid JSON and invalid input lengths", func(t *testing.T) {
		res, body := e2etest.DoRequest(
			t,
			http.MethodPost,
			baseURL+"/v1/ask",
			[]byte("{invalid"),
			map[string]string{"Content-Type": "application/json"},
		)
		if res.StatusCode != http.StatusBadRequest {
			t.Fatalf("expected 400 for malformed JSON, got %d (%s)", res.StatusCode, string(body))
		}

		resShort, _ := e2etest.DoJSON[httpkit.ErrorResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/ask",
			map[string]string{"question": "hi"},
			nil,
		)
		if resShort.StatusCode != http.StatusBadRequest {
			t.Fatalf("expected 400 for short question, got %d", resShort.StatusCode)
		}

		resLong, _ := e2etest.DoJSON[httpkit.ErrorResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/ask",
			map[string]string{"question": strings.Repeat("a", 801)},
			nil,
		)
		if resLong.StatusCode != http.StatusBadRequest {
			t.Fatalf("expected 400 for oversized question, got %d", resLong.StatusCode)
		}
	})
}
