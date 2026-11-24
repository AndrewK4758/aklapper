package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

func TestAiAskAsyncRecoveryDisconnectAndQuota(t *testing.T) {
	t.Setenv("INTERNAL_AUTH_SECRET", "unit-test-secret")

	qdrantSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/collections/portfolio_docs/points/search" {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"result": []map[string]any{{
					"id":    qdrant.PortfolioPointID("curated:architecture", 0),
					"score": 0.91,
					"payload": map[string]any{
						"docId": "curated:architecture", "title": "Portfolio Architecture",
						"snippet": "Go microservices + React SSR.", "category": "architecture",
					},
				}},
			})
			return
		}
		http.NotFound(w, r)
	}))
	defer qdrantSrv.Close()

	provider := &stubLLM{name: "stub-llm"}
	store := pg.NewMemoryStore()
	store.SetPolicyForTest(pg.QuotaPolicy{
		Role: contracts.RoleGuest, MaxTurnsPerSession: 2, MaxTokensPerRun: 4000, MaxDailyGlobalTokens: 100000,
	})
	h := newHandlerWithSyncWait(provider, &qdrant.Client{BaseURL: qdrantSrv.URL}, store, 100*time.Millisecond)

	t.Run("Slow cold-start returns 202 AskTurnState and completes cleanly on turn poll", func(t *testing.T) {
		tok := signHeader(t, internalauth.RoleGuest, "guest-async")
		provider.chatDelay = 200 * time.Millisecond
		defer func() { provider.chatDelay = 0 }()

		attemptID := "55555555-5555-4555-8555-555555555555"
		body := []byte(`{"mode":"qa","attemptId":"` + attemptID + `","question":"Explain cold start async recovery"}`)
		req := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader(body))
		req.Header.Set(internalauth.HeaderName, tok)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusAccepted {
			t.Fatalf("expected 202 Accepted, got %d: %s", rec.Code, rec.Body.String())
		}
		var pending contracts.AskTurnState
		if err := json.Unmarshal(rec.Body.Bytes(), &pending); err != nil || pending.Status != contracts.TurnStatusRunning {
			t.Fatalf("unexpected 202 payload: %+v err=%v", pending, err)
		}

		// Duplicate attemptId while running returns 202 idempotently
		reqDup := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader(body))
		reqDup.Header.Set(internalauth.HeaderName, tok)
		recDup := httptest.NewRecorder()
		h.ServeHTTP(recDup, reqDup)
		if recDup.Code != http.StatusAccepted {
			t.Fatalf("expected 202 on duplicate active attemptId, got %d", recDup.Code)
		}

		deadline := time.Now().Add(2 * time.Second)
		for time.Now().Before(deadline) {
			pollReq := httptest.NewRequest(http.MethodGet, "/v1/ask/turns/"+attemptID, nil)
			pollReq.SetPathValue("attemptId", attemptID)
			pollReq.Header.Set(internalauth.HeaderName, tok)
			pollRec := httptest.NewRecorder()
			h.ServeHTTP(pollRec, pollReq)
			if pollRec.Code == http.StatusOK {
				var done contracts.AskTurnState
				_ = json.Unmarshal(pollRec.Body.Bytes(), &done)
				if done.Status != contracts.TurnStatusCompleted || done.Response == nil || done.Quota.TurnsUsed != 1 || done.Quota.TokensUsed != 55 {
					t.Fatalf("unexpected completed state: %+v", done)
				}
				return
			}
			time.Sleep(35 * time.Millisecond)
		}
		t.Fatal("timed out polling GET /v1/ask/turns/:attemptId")
	})

	t.Run("Client disconnect reconciles detached worker and quota 429 enforces cap", func(t *testing.T) {
		tok := signHeader(t, internalauth.RoleGuest, "guest-disconnect")
		provider.chatDelay = 80 * time.Millisecond
		defer func() { provider.chatDelay = 0 }()

		reqCtx, cancel := context.WithCancel(context.Background())
		attemptID := "66666666-6666-4666-8666-666666666666"
		req := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader([]byte(`{"mode":"qa","attemptId":"`+attemptID+`","question":"Disconnect mid flight"}`))).WithContext(reqCtx)
		req.Header.Set(internalauth.HeaderName, tok)
		go func() {
			time.Sleep(20 * time.Millisecond)
			cancel()
		}()
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)

		time.Sleep(150 * time.Millisecond)
		turn, q, err := store.GetTurnByAttemptID(context.Background(), attemptID, "guest-disconnect")
		if err != nil || turn.Status != contracts.TurnStatusCompleted || q.TurnsUsed != 1 || q.TokensUsed != 55 {
			t.Fatalf("expected detached worker completion, got turn=%+v q=%+v err=%v", turn, q, err)
		}

		req2 := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader([]byte(`{"mode":"qa","question":"Second allowed turn"}`)))
		req2.Header.Set(internalauth.HeaderName, tok)
		rec2 := httptest.NewRecorder()
		h.ServeHTTP(rec2, req2)
		if rec2.Code != http.StatusOK {
			t.Fatalf("expected 200 on 2nd turn, got %d", rec2.Code)
		}
		reqOver := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader([]byte(`{"mode":"qa","question":"Third turn rejected 429"}`)))
		reqOver.Header.Set(internalauth.HeaderName, tok)
		recOver := httptest.NewRecorder()
		h.ServeHTTP(recOver, reqOver)
		if recOver.Code != http.StatusTooManyRequests {
			t.Fatalf("expected 429, got %d", recOver.Code)
		}
	})
}
