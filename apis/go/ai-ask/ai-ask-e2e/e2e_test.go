package aiask_e2e_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/AndrewK4758/aklapper/packages/go/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/httpkit/e2etest"
)

type askResponse struct {
	Grounded   bool     `json:"grounded"`
	Provider   string   `json:"provider"`
	Model      string   `json:"model"`
	TokensUsed int      `json:"tokensUsed"`
	Answer     string   `json:"answer"`
	Sources    []string `json:"sources"`
}

func TestAiAskEndToEnd(t *testing.T) {
	t.Parallel()

	var embedFail atomic.Bool
	var chatFail atomic.Bool
	var qdrantEmpty atomic.Bool

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
		if r.URL.Path != "/collections/portfolio_docs/points/search" {
			http.NotFound(w, r)
			return
		}
		if qdrantEmpty.Load() {
			_ = json.NewEncoder(w).Encode(map[string]any{"result": []any{}})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"result": []map[string]any{
				{
					"id":    "doc-1",
					"score": 0.94,
					"payload": map[string]any{
						"title":   "Portfolio Architecture",
						"snippet": "Monorepo built with Go, Node 26, React Router SSR, and Nx.",
					},
				},
			},
		})
	}))
	t.Cleanup(qdrantServer.Close)

	baseURL := e2etest.StartBinary(
		t,
		"../ai-ask",
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

	t.Run("POST /v1/ask returns grounded completion with sources", func(t *testing.T) {
		embedFail.Store(false)
		chatFail.Store(false)
		qdrantEmpty.Store(false)

		res, out := e2etest.DoJSON[askResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/ask",
			map[string]string{"question": "What stack powers this portfolio monorepo?"},
			nil,
		)
		if res.StatusCode != http.StatusOK {
			t.Fatalf("expected 200, got %d", res.StatusCode)
		}
		if !out.Grounded || out.Provider != "local-llama-swap" || out.Model != "e2e-chat" {
			t.Fatalf("unexpected grounded metadata: %+v", out)
		}
		if out.TokensUsed != 42 || len(out.Sources) != 1 || out.Sources[0] != "Portfolio Architecture" {
			t.Fatalf("unexpected completion payload: %+v", out)
		}
		if !strings.Contains(out.Answer, "Grounded answer") {
			t.Fatalf("unexpected answer: %q", out.Answer)
		}
	})

	t.Run("POST /v1/ask abstains when Qdrant returns zero hits", func(t *testing.T) {
		embedFail.Store(false)
		chatFail.Store(false)
		qdrantEmpty.Store(true)

		res, out := e2etest.DoJSON[askResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/ask",
			map[string]string{"question": "Tell me about an undocumented topic"},
			nil,
		)
		if res.StatusCode != http.StatusOK {
			t.Fatalf("expected 200, got %d", res.StatusCode)
		}
		if out.Grounded || len(out.Sources) != 0 || !strings.Contains(out.Answer, "Abstaining") {
			t.Fatalf("expected abstention response, got: %+v", out)
		}
	})

	t.Run("POST /v1/ask abstains when embedding provider fails", func(t *testing.T) {
		embedFail.Store(true)
		qdrantEmpty.Store(false)

		res, out := e2etest.DoJSON[askResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/ask",
			map[string]string{"question": "Will embedding failure abstain cleanly?"},
			nil,
		)
		if res.StatusCode != http.StatusOK {
			t.Fatalf("expected 200, got %d", res.StatusCode)
		}
		if out.Grounded || !strings.Contains(out.Answer, "embedding provider is unavailable") {
			t.Fatalf("expected embedding abstention, got: %+v", out)
		}
	})

	t.Run("POST /v1/ask returns 502 when chat inference fails", func(t *testing.T) {
		embedFail.Store(false)
		qdrantEmpty.Store(false)
		chatFail.Store(true)

		res, errBody := e2etest.DoJSON[httpkit.ErrorResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/ask",
			map[string]string{"question": "Trigger chat provider failure"},
			nil,
		)
		if res.StatusCode != http.StatusBadGateway {
			t.Fatalf("expected 502, got %d (%+v)", res.StatusCode, errBody)
		}
		if errBody.Error != "llm inference failed" {
			t.Fatalf("unexpected error payload: %+v", errBody)
		}
	})

	t.Run("POST /v1/ask rejects invalid JSON and invalid question lengths", func(t *testing.T) {
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
