package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

type stubLLM struct {
	name     string
	embedErr error
	chatErr  error
	chatText string
}

func (s *stubLLM) Name() string { return s.name }

func (s *stubLLM) Embed(_ context.Context, _ string) ([]float32, error) {
	if s.embedErr != nil {
		return nil, s.embedErr
	}
	return []float32{0.2, 0.4, 0.6}, nil
}

func (s *stubLLM) Chat(_ context.Context, _ []llm.ChatMessage, _ int) (llm.Completion, error) {
	if s.chatErr != nil {
		return llm.Completion{}, s.chatErr
	}
	return llm.Completion{
		Text:       s.chatText,
		Model:      "stub-chat",
		TokensUsed: 55,
	}, nil
}

func TestAiAskUnitFlows(t *testing.T) {
	t.Setenv("INTERNAL_AUTH_SECRET", "unit-test-secret")

	var searchScore = 0.88
	var upsertedCount int

	qdrantSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/collections/portfolio_docs":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"result": map[string]any{
					"status":       "green",
					"points_count": 7,
				},
			})
		case r.Method == http.MethodPut && r.URL.Path == "/collections/portfolio_docs":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"result":true}`))
		case r.Method == http.MethodPut && r.URL.Path == "/collections/portfolio_docs/points":
			var body struct {
				Points []qdrant.Point `json:"points"`
			}
			_ = json.NewDecoder(r.Body).Decode(&body)
			upsertedCount = len(body.Points)
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"ok"}`))
		case r.Method == http.MethodPost && r.URL.Path == "/collections/portfolio_docs/points/search":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"result": []map[string]any{
					{
						"id":    1,
						"score": searchScore,
						"payload": map[string]any{
							"docId":    "curated:architecture",
							"title":    "Portfolio Architecture",
							"snippet":  "Go microservices on GKE Autopilot with React SSR and PostgreSQL 19.",
							"category": "architecture",
						},
					},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer qdrantSrv.Close()

	provider := &stubLLM{name: "stub-llm", chatText: "Grounded summary citing Portfolio Architecture."}
	store := pg.NewMemoryStore()
	store.SetPolicyForTest(pg.QuotaPolicy{
		Role:                 contracts.RoleGuest,
		MaxTurnsPerSession:   2,
		MaxTokensPerRun:      4000,
		MaxDailyGlobalTokens: 100000,
	})
	h := newHandler(provider, &qdrant.Client{BaseURL: qdrantSrv.URL}, store)

	t.Run("GET /v1/ask/status reports collection info", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/ask/status", nil)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
		if !strings.Contains(rec.Body.String(), `"pointsCount":7`) {
			t.Fatalf("expected pointsCount=7, got %s", rec.Body.String())
		}
	})

	t.Run("POST /v1/ask/reindex rejects non-admin and succeeds for admin", func(t *testing.T) {
		reqUnauth := httptest.NewRequest(http.MethodPost, "/v1/ask/reindex", nil)
		recUnauth := httptest.NewRecorder()
		h.ServeHTTP(recUnauth, reqUnauth)
		if recUnauth.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d", recUnauth.Code)
		}

		tok, err := internalauth.Sign(internalauth.RoleAdmin, "aklapper", time.Minute, "unit-test-secret")
		if err != nil {
			t.Fatalf("sign token: %v", err)
		}
		reqAdmin := httptest.NewRequest(http.MethodPost, "/v1/ask/reindex", nil)
		reqAdmin.Header.Set(internalauth.HeaderName, tok)
		recAdmin := httptest.NewRecorder()
		h.ServeHTTP(recAdmin, reqAdmin)
		if recAdmin.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", recAdmin.Code, recAdmin.Body.String())
		}
		if upsertedCount < 3 {
			t.Fatalf("expected >= 3 curated docs indexed, got %d", upsertedCount)
		}
	})

	t.Run("POST /v1/ask jd_match returns matchScore, strengths, and gaps", func(t *testing.T) {
		searchScore = 0.88
		payload := []byte(`{"mode":"jd_match","sessionId":"sess-jd","jobDescription":"Seeking Staff Engineer experienced in Go microservices, Kubernetes GKE, React SSR, PostgreSQL, and Terraform."}`)
		req := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader(payload))
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}
		var out askResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if !out.Grounded || out.Mode != "jd_match" || out.MatchScore == nil || *out.MatchScore < 15 {
			t.Fatalf("unexpected jd_match response: %+v", out)
		}
		if len(out.Strengths) == 0 || len(out.Sources) != 1 {
			t.Fatalf("expected strengths and sources, got %+v", out)
		}
	})

	t.Run("POST /v1/ask abstains when top score is below 0.35", func(t *testing.T) {
		searchScore = 0.21
		payload := []byte(`{"mode":"qa","sessionId":"sess-low","question":"What is the weather on Mars?"}`)
		req := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader(payload))
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
		var out askResponse
		_ = json.Unmarshal(rec.Body.Bytes(), &out)
		if out.Grounded || len(out.Sources) != 0 || !strings.Contains(out.Answer, "below strict grounding threshold") {
			t.Fatalf("expected low-score abstention, got %+v", out)
		}
	})

	t.Run("POST /v1/ask abstains cleanly when chat inference fails", func(t *testing.T) {
		searchScore = 0.88
		provider.chatErr = errors.New("llm offline")
		defer func() { provider.chatErr = nil }()

		payload := []byte(`{"mode":"qa","sessionId":"sess-chat-err","question":"Describe the portfolio architecture"}`)
		req := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader(payload))
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 abstention, got %d", rec.Code)
		}
		var out askResponse
		_ = json.Unmarshal(rec.Body.Bytes(), &out)
		if out.Grounded || !strings.Contains(out.Answer, "Abstaining") {
			t.Fatalf("expected chat-failure abstention, got %+v", out)
		}
	})

	t.Run("POST /v1/ask enforces session quota with HTTP 429", func(t *testing.T) {
		searchScore = 0.88
		for i := range 2 {
			req := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader([]byte(`{"mode":"qa","sessionId":"sess-quota","question":"Describe the portfolio architecture"}`)))
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)
			if rec.Code != http.StatusOK {
				t.Fatalf("turn %d expected 200, got %d", i+1, rec.Code)
			}
		}
		reqOver := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader([]byte(`{"mode":"qa","sessionId":"sess-quota","question":"Third turn should be rejected"}`)))
		recOver := httptest.NewRecorder()
		h.ServeHTTP(recOver, reqOver)
		if recOver.Code != http.StatusTooManyRequests {
			t.Fatalf("expected 429, got %d: %s", recOver.Code, recOver.Body.String())
		}
	})
}
