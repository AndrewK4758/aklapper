package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/http/httptest"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
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

	t.Run("UTF-8 multi-byte rune validation and JD chunk slicing avoid byte truncation", func(t *testing.T) {
		tok := signHeader(t, internalauth.RoleGuest, "guest-utf8")

		multiByteJD := strings.Repeat("•", 7900) // 7900 chars, 23700 UTF-8 bytes
		chunks := chunkTextForEmbed(multiByteJD, maxEmbedChunkChars)
		if len(chunks) != 5 {
			t.Fatalf("expected 5 rune chunks for 7900-rune JD, got %d", len(chunks))
		}
		for i, ch := range chunks {
			if !utf8.ValidString(ch) || strings.ContainsRune(ch, utf8.RuneError) {
				t.Fatalf("chunk %d split multi-byte UTF-8 rune: valid=%v", i, utf8.ValidString(ch))
			}
		}

		body, _ := json.Marshal(map[string]any{
			"mode":           "jd_match",
			"jobDescription": multiByteJD,
		})
		req := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader(body))
		req.Header.Set(internalauth.HeaderName, tok)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code == http.StatusBadRequest {
			t.Fatalf("expected 7900-rune multi-byte JD accepted past validation, got 400: %s", rec.Body.String())
		}

		multiByteQ := strings.Repeat("字", 800) // 800 chars, 2400 UTF-8 bytes
		qBody, _ := json.Marshal(map[string]any{"mode": "qa", "question": multiByteQ})
		qReq := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader(qBody))
		qReq.Header.Set(internalauth.HeaderName, tok)
		qRec := httptest.NewRecorder()
		h.ServeHTTP(qRec, qReq)
		if qRec.Code == http.StatusBadRequest {
			t.Fatalf("expected 800-rune multi-byte question accepted past validation, got 400: %s", qRec.Body.String())
		}

		overQ := strings.Repeat("字", 801)
		overBody, _ := json.Marshal(map[string]any{"mode": "qa", "question": overQ})
		overReq := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader(overBody))
		overReq.Header.Set(internalauth.HeaderName, tok)
		overRec := httptest.NewRecorder()
		h.ServeHTTP(overRec, overReq)
		if overRec.Code != http.StatusBadRequest {
			t.Fatalf("expected 801-rune question rejected with 400, got %d", overRec.Code)
		}
	})

	t.Run("Concurrent duplicate attemptId at final quota slot reuses idempotently instead of 429", func(t *testing.T) {
		tok := signHeader(t, internalauth.RoleGuest, "guest-cap-dup")
		req1 := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader([]byte(`{"mode":"qa","question":"First quota slot turn"}`)))
		req1.Header.Set(internalauth.HeaderName, tok)
		rec1 := httptest.NewRecorder()
		h.ServeHTTP(rec1, req1)
		if rec1.Code != http.StatusOK {
			t.Fatalf("expected turn 1 200, got %d", rec1.Code)
		}

		finalAttempt := "88888888-8888-4888-8888-888888888888"
		payload := []byte(`{"mode":"qa","attemptId":"` + finalAttempt + `","question":"Concurrent final slot attempt"}`)
		var wg sync.WaitGroup
		codes := make([]int, 2)
		for i := range 2 {
			wg.Add(1)
			go func(idx int) {
				defer wg.Done()
				req := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader(payload))
				req.Header.Set(internalauth.HeaderName, tok)
				rec := httptest.NewRecorder()
				h.ServeHTTP(rec, req)
				codes[idx] = rec.Code
			}(i)
		}
		wg.Wait()
		for i, code := range codes {
			if code != http.StatusOK && code != http.StatusAccepted {
				t.Fatalf("expected duplicate final-slot request %d to return 200/202, got %d", i, code)
			}
		}
	})
}

type syncLogBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *syncLogBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *syncLogBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

type cleanupCtxCapture struct {
	op          string
	attemptID   string
	hasDeadline bool
	deadline    time.Time
	entryErr    error
	exitErr     error
	elapsed     time.Duration
}

type stallingTurnStore struct {
	*pg.Store
	mu             sync.Mutex
	captures       []cleanupCtxCapture
	stallReconcile bool
	stallRefund    bool
	reconcileErr   error
	refundErr      error
	safetyCap      time.Duration
	activeCalls    atomic.Int32
}

func (s *stallingTurnStore) waitOrSafetyCap(ctx context.Context) error {
	capWait := s.safetyCap
	if capWait <= 0 {
		capWait = 250 * time.Millisecond
	}
	timer := time.NewTimer(capWait)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return errors.New("test safety timeout: cleanup context lacked deadline")
	}
}

func (s *stallingTurnStore) recordCapture(c cleanupCtxCapture) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.captures = append(s.captures, c)
}

func (s *stallingTurnStore) snapshotCaptures() []cleanupCtxCapture {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]cleanupCtxCapture, len(s.captures))
	copy(out, s.captures)
	return out
}

func (s *stallingTurnStore) interceptTx(
	ctx context.Context,
	op, attemptID string,
	stall bool,
	injectedErr error,
	fallback func() (contracts.QuotaStatus, error),
) (contracts.QuotaStatus, error) {
	s.activeCalls.Add(1)
	defer s.activeCalls.Add(-1)

	started := time.Now()
	deadline, hasDeadline := ctx.Deadline()
	entryErr := ctx.Err()

	var (
		q   contracts.QuotaStatus
		err error
	)
	switch {
	case stall:
		err = s.waitOrSafetyCap(ctx)
	case injectedErr != nil:
		err = injectedErr
	default:
		q, err = fallback()
	}
	s.recordCapture(cleanupCtxCapture{
		op: op, attemptID: attemptID, hasDeadline: hasDeadline, deadline: deadline,
		entryErr: entryErr, exitErr: err, elapsed: time.Since(started),
	})
	return q, err
}

func (s *stallingTurnStore) ReconcileTurnTx(ctx context.Context, attemptID string, res contracts.AskResponse) (contracts.QuotaStatus, error) {
	s.mu.Lock()
	stall := s.stallReconcile
	injectedErr := s.reconcileErr
	s.mu.Unlock()
	return s.interceptTx(ctx, "reconcile", attemptID, stall, injectedErr, func() (contracts.QuotaStatus, error) {
		return s.Store.ReconcileTurnTx(ctx, attemptID, res)
	})
}

func (s *stallingTurnStore) RefundTurnTx(ctx context.Context, attemptID, errorCode string) (contracts.QuotaStatus, error) {
	s.mu.Lock()
	stall := s.stallRefund
	injectedErr := s.refundErr
	s.mu.Unlock()
	return s.interceptTx(ctx, "refund", attemptID, stall, injectedErr, func() (contracts.QuotaStatus, error) {
		return s.Store.RefundTurnTx(ctx, attemptID, errorCode)
	})
}

func waitWorkerExited(t *testing.T, ch <-chan struct{}) {
	t.Helper()
	select {
	case <-ch:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for executeTurnWorker goroutine to exit")
	}
}

func waitGoroutinesSettled(t *testing.T, baseline int) {
	t.Helper()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		if runtime.NumGoroutine() <= baseline {
			return
		}
		runtime.Gosched()
		time.Sleep(10 * time.Millisecond)
	}
	if got := runtime.NumGoroutine(); got > baseline {
		t.Fatalf("goroutine count did not settle: baseline=%d got=%d", baseline, got)
	}
}

func TestUnaryTurnWorkerBoundedCleanupContexts(t *testing.T) {
	t.Setenv("INTERNAL_AUTH_SECRET", "unit-test-secret")
	highQdrant := newTestQdrantServer(t, 0.92)
	lowQdrant := newTestQdrantServer(t, 0.15)
	privCfg, err := privacy.LoadConfig(privacy.ConfigInput{SecretAction: privacy.ActionAbort})
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}

	t.Run("default handleAskPost derives detached 5s budget across refund, boundary abstention, and completed reconcile", func(t *testing.T) {
		baseStore := pg.NewMemoryStore()
		recStore := &stallingTurnStore{Store: baseStore}
		prov := &stubLLM{name: "stub-llm"}
		qClient := &qdrant.Client{BaseURL: highQdrant.URL, HTTPClient: highQdrant.Client()}
		defer highQdrant.CloseClientConnections()

		// 1. failWithRefund when LLM fails
		prov.chatErr = errors.New("upstream down")
		attemptFail := "11111111-1111-4111-8111-111111111101"
		hFail := handleAskPostWithDeps(unaryTurnDeps{
			provider:    prov,
			vectorStore: qClient,
			store:       baseStore,
			turnStore:   recStore,
			privacyCfg:  privCfg,
			syncWait:    defaultSyncWaitWindow,
		})
		reqFail := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader([]byte(`{"mode":"qa","attemptId":"`+attemptFail+`","question":"Explain unary refund deadline"}`)))
		reqFail.Header.Set(internalauth.HeaderName, signHeader(t, internalauth.RoleGuest, "sess-default-budget"))
		recFail := httptest.NewRecorder()
		hFail.ServeHTTP(recFail, reqFail)
		prov.chatErr = nil
		if recFail.Code != http.StatusBadGateway {
			t.Fatalf("expected 502 on LLM failure, got %d: %s", recFail.Code, recFail.Body.String())
		}

		// 2. GroundingTierBoundary abstention
		lowClient := &qdrant.Client{BaseURL: lowQdrant.URL, HTTPClient: lowQdrant.Client()}
		defer lowQdrant.CloseClientConnections()
		attemptAbstain := "11111111-1111-4111-8111-111111111102"
		hAbstain := handleAskPostWithDeps(unaryTurnDeps{
			provider:    prov,
			vectorStore: lowClient,
			store:       baseStore,
			turnStore:   recStore,
			privacyCfg:  privCfg,
			syncWait:    defaultSyncWaitWindow,
		})
		reqAbstain := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader([]byte(`{"mode":"qa","attemptId":"`+attemptAbstain+`","question":"Can you share confidential NDA client names?"}`)))
		reqAbstain.Header.Set(internalauth.HeaderName, signHeader(t, internalauth.RoleGuest, "sess-default-budget"))
		recAbstain := httptest.NewRecorder()
		hAbstain.ServeHTTP(recAbstain, reqAbstain)
		if recAbstain.Code != http.StatusOK {
			t.Fatalf("expected 200 on abstention, got %d: %s", recAbstain.Code, recAbstain.Body.String())
		}

		// 3. Completed QA turn
		attemptDone := "11111111-1111-4111-8111-111111111103"
		reqDone := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader([]byte(`{"mode":"qa","attemptId":"`+attemptDone+`","question":"Describe Go architecture"}`)))
		reqDone.Header.Set(internalauth.HeaderName, signHeader(t, internalauth.RoleGuest, "sess-default-budget"))
		recDone := httptest.NewRecorder()
		hFail.ServeHTTP(recDone, reqDone)
		if recDone.Code != http.StatusOK {
			t.Fatalf("expected 200 on completed QA, got %d: %s", recDone.Code, recDone.Body.String())
		}

		captures := recStore.snapshotCaptures()
		if len(captures) != 3 {
			t.Fatalf("expected 3 cleanup captures, got %d (%+v)", len(captures), captures)
		}
		for i, c := range captures {
			if !c.hasDeadline {
				t.Fatalf("capture[%d] (%s %s) lacked context deadline", i, c.op, c.attemptID)
			}
			rem := time.Until(c.deadline)
			if rem <= 3*time.Second || rem > detachedCleanupTimeout+100*time.Millisecond {
				t.Fatalf("capture[%d] (%s) expected ~%v deadline, got remaining=%v", i, c.op, detachedCleanupTimeout, rem)
			}
			if c.entryErr != nil {
				t.Fatalf("capture[%d] (%s) expected nil ctx.Err() on entry, got %v", i, c.op, c.entryErr)
			}
		}

		// 4. Parent workerCtx cancellation during LLM execution still preserves non-canceled cleanup budget via WithoutCancel
		attemptCanceled := "11111111-1111-4111-8111-111111111104"
		prov.chatDelay = 150 * time.Millisecond
		defer func() { prov.chatDelay = 0 }()
		exitCh := make(chan struct{}, 1)
		hWorkerTimeout := handleAskPostWithDeps(unaryTurnDeps{
			provider:      prov,
			vectorStore:   qClient,
			store:         baseStore,
			turnStore:     recStore,
			privacyCfg:    privCfg,
			syncWait:      defaultSyncWaitWindow,
			workerTimeout: 30 * time.Millisecond,
			onWorkerExit:  func() { exitCh <- struct{}{} },
		})
		reqCanceled := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader([]byte(`{"mode":"qa","attemptId":"`+attemptCanceled+`","question":"Trigger workerCtx timeout during chat"}`)))
		reqCanceled.Header.Set(internalauth.HeaderName, signHeader(t, internalauth.RoleGuest, "sess-canceled-worker"))
		recCanceled := httptest.NewRecorder()
		hWorkerTimeout.ServeHTTP(recCanceled, reqCanceled)
		waitWorkerExited(t, exitCh)

		if recCanceled.Code != http.StatusGatewayTimeout {
			t.Fatalf("expected 504 on workerCtx deadline during chat, got %d: %s", recCanceled.Code, recCanceled.Body.String())
		}
		capturesAfter := recStore.snapshotCaptures()
		last := capturesAfter[len(capturesAfter)-1]
		if last.op != "refund" || !last.hasDeadline || last.entryErr != nil {
			t.Fatalf("expected WithoutCancel bounded refund context after workerCtx cancellation, got %+v", last)
		}
		q, _ := baseStore.GetQuotaStatus(context.Background(), contracts.RoleGuest, "sess-canceled-worker")
		if q.TurnsUsed != 0 {
			t.Fatalf("expected refunded quota after workerCtx cancellation, got %+v", q)
		}

		// 5. Real handleAskPost preserves 504 ErrTurnLeaseExpired against live MemoryStore
		attemptLease := "11111111-1111-4111-8111-111111111105"
		prov.chatDelay = 0
		prov.chatFn = func([]llm.ChatMessage) (llm.Completion, error) {
			baseStore.ExpireLeaseForTest(attemptLease, time.Now().UTC().Add(-time.Second))
			return llm.Completion{Text: "Answer after lease expired", Model: "stub-chat", TokensUsed: 20}, nil
		}
		defer func() { prov.chatFn = nil }()
		hReal := handleAskPost(prov, qClient, baseStore, privCfg, defaultSyncWaitWindow)
		reqLease := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader([]byte(`{"mode":"qa","attemptId":"`+attemptLease+`","question":"Verify lease expiry 504 via handleAskPost"}`)))
		reqLease.Header.Set(internalauth.HeaderName, signHeader(t, internalauth.RoleGuest, "sess-real-lease-expired"))
		recLease := httptest.NewRecorder()
		hReal.ServeHTTP(recLease, reqLease)
		if recLease.Code != http.StatusGatewayTimeout {
			t.Fatalf("expected 504 on expired lease via handleAskPost, got %d: %s", recLease.Code, recLease.Body.String())
		}
	})

	t.Run("stalled failWithRefund cancels within cleanupTimeout, logs diagnostic without leaking SQL or masking error, and exits cleanly", func(t *testing.T) {
		var logs syncLogBuffer
		prevOut := log.Writer()
		log.SetOutput(&logs)
		defer log.SetOutput(prevOut)

		baseStore := pg.NewMemoryStore()
		stallStore := &stallingTurnStore{
			Store:       baseStore,
			stallRefund: true,
			safetyCap:   300 * time.Millisecond,
		}
		prov := &stubLLM{name: "stub-llm", chatErr: errors.New("upstream llm unreachable")}
		qClient := &qdrant.Client{BaseURL: highQdrant.URL, HTTPClient: highQdrant.Client()}
		baseline := runtime.NumGoroutine()

		exitCh := make(chan struct{}, 1)
		h := handleAskPostWithDeps(unaryTurnDeps{
			provider:       prov,
			vectorStore:    qClient,
			store:          baseStore,
			turnStore:      stallStore,
			privacyCfg:     privCfg,
			syncWait:       defaultSyncWaitWindow,
			cleanupTimeout: 40 * time.Millisecond,
			onWorkerExit:   func() { exitCh <- struct{}{} },
		})

		attemptID := "22222222-2222-4222-8222-222222222201"
		req := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader([]byte(`{"mode":"qa","attemptId":"`+attemptID+`","question":"Describe architecture when refund stalls"}`)))
		req.Header.Set(internalauth.HeaderName, signHeader(t, internalauth.RoleGuest, "sess-stall-refund"))
		req.Header.Set("X-Correlation-Id", "corr-stall-refund")
		rec := httptest.NewRecorder()

		started := time.Now()
		h.ServeHTTP(rec, req)
		elapsed := time.Since(started)
		waitWorkerExited(t, exitCh)
		qClient.HTTPClient.CloseIdleConnections()
		highQdrant.CloseClientConnections()
		waitGoroutinesSettled(t, baseline+1)

		if elapsed >= 250*time.Millisecond {
			t.Fatalf("expected stalled RefundTurnTx cancelled near 40ms cleanupTimeout, took %v", elapsed)
		}
		if rec.Code != http.StatusBadGateway {
			t.Fatalf("expected upstream 502 preserved (not masked), got %d: %s", rec.Code, rec.Body.String())
		}
		var errEnv contracts.PublicAppError
		if err := json.Unmarshal(rec.Body.Bytes(), &errEnv); err != nil {
			t.Fatalf("unmarshal error body: %v", err)
		}
		if errEnv.Code != contracts.ErrCodeUpstreamUnavailable || errEnv.CorrelationID != "corr-stall-refund" {
			t.Fatalf("expected ERR_UPSTREAM_UNAVAILABLE with correlationId preserved, got %+v", errEnv)
		}

		caps := stallStore.snapshotCaptures()
		if len(caps) != 1 || !caps[0].hasDeadline || !errors.Is(caps[0].exitErr, context.DeadlineExceeded) {
			t.Fatalf("expected bounded RefundTurnTx context.DeadlineExceeded, got %+v", caps)
		}
		if stallStore.activeCalls.Load() != 0 {
			t.Fatalf("expected zero active stalled calls after exit, got %d", stallStore.activeCalls.Load())
		}

		logText := logs.String()
		for _, want := range []string{
			`"event":"ai_ask.turn.refund_error"`,
			`"attemptId":"` + attemptID + `"`,
			`"correlationId":"corr-stall-refund"`,
			`"seam_type":"BOUNDARY_FAULT"`,
			`"reason":"timeout"`,
			`"event":"ai_ask.turn.audit"`,
			`"deltaStatus":"refund_failed"`,
		} {
			if !strings.Contains(logText, want) {
				t.Fatalf("expected log fragment %s in:\n%s", want, logText)
			}
		}

		// Privacy abort with raw SQL/credential refund error must not mask 403 or leak sensitive DB internals
		var secretLogs syncLogBuffer
		log.SetOutput(&secretLogs)
		stallStore.mu.Lock()
		stallStore.stallRefund = false
		stallStore.refundErr = errors.New("pq: SELECT password=supersecret-db-pass FROM ask_turns goroutine 1 [running]: stacktrace")
		stallStore.mu.Unlock()
		prov.chatErr = nil
		prov.chatFn = func([]llm.ChatMessage) (llm.Completion, error) {
			return llm.Completion{Text: "Leaked ghp_1234567890abcdefghijklmnopqrstuvwxyz token", Model: "stub", TokensUsed: 12}, nil
		}
		defer func() { prov.chatFn = nil }()

		exitPriv := make(chan struct{}, 1)
		hPriv := handleAskPostWithDeps(unaryTurnDeps{
			provider:       prov,
			vectorStore:    qClient,
			store:          baseStore,
			turnStore:      stallStore,
			privacyCfg:     privCfg,
			syncWait:       defaultSyncWaitWindow,
			cleanupTimeout: 40 * time.Millisecond,
			onWorkerExit:   func() { exitPriv <- struct{}{} },
		})
		attemptPriv := "22222222-2222-4222-8222-222222222202"
		reqPriv := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader([]byte(`{"mode":"qa","attemptId":"`+attemptPriv+`","question":"Trigger privacy abort refund error"}`)))
		reqPriv.Header.Set(internalauth.HeaderName, signHeader(t, internalauth.RoleGuest, "sess-priv-refund-err"))
		reqPriv.Header.Set("X-Correlation-Id", "corr-priv-refund-err")
		recPriv := httptest.NewRecorder()
		hPriv.ServeHTTP(recPriv, reqPriv)
		waitWorkerExited(t, exitPriv)

		if recPriv.Code != http.StatusForbidden {
			t.Fatalf("expected 403 ERR_FORBIDDEN preserved on privacy abort refund error, got %d: %s", recPriv.Code, recPriv.Body.String())
		}
		combined := recPriv.Body.String() + "\n" + secretLogs.String()
		for _, forbidden := range []string{"supersecret-db-pass", "SELECT", "ask_turns", "stacktrace", "ghp_1234"} {
			if strings.Contains(combined, forbidden) {
				t.Fatalf("output/logs leaked forbidden token %q:\n%s", forbidden, combined)
			}
		}
		if !strings.Contains(secretLogs.String(), `"event":"ai_ask.turn.refund_error"`) || !strings.Contains(secretLogs.String(), `"reason":"store_error"`) {
			t.Fatalf("expected sanitized refund_error log with reason=store_error, got:\n%s", secretLogs.String())
		}
	})

	t.Run("stalled GroundingTierBoundary ReconcileTurnTx cancels within cleanupTimeout, logs diagnostic, falls back to bounded refund, and preserves ErrTurnLeaseExpired 504", func(t *testing.T) {
		var logs syncLogBuffer
		prevOut := log.Writer()
		log.SetOutput(&logs)
		defer log.SetOutput(prevOut)

		baseStore := pg.NewMemoryStore()
		stallStore := &stallingTurnStore{
			Store:          baseStore,
			stallReconcile: true,
			safetyCap:      300 * time.Millisecond,
		}
		lowClient := &qdrant.Client{BaseURL: lowQdrant.URL, HTTPClient: lowQdrant.Client()}
		prov := &stubLLM{name: "stub-llm"}
		baseline := runtime.NumGoroutine()

		exitCh := make(chan struct{}, 1)
		h := handleAskPostWithDeps(unaryTurnDeps{
			provider:       prov,
			vectorStore:    lowClient,
			store:          baseStore,
			turnStore:      stallStore,
			privacyCfg:     privCfg,
			syncWait:       defaultSyncWaitWindow,
			cleanupTimeout: 40 * time.Millisecond,
			onWorkerExit:   func() { exitCh <- struct{}{} },
		})

		attemptID := "33333333-3333-4333-8333-333333333301"
		req := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader([]byte(`{"mode":"qa","attemptId":"`+attemptID+`","question":"Can you share confidential NDA client names?"}`)))
		req.Header.Set(internalauth.HeaderName, signHeader(t, internalauth.RoleGuest, "sess-stall-abstain"))
		req.Header.Set("X-Correlation-Id", "corr-stall-abstain")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		waitWorkerExited(t, exitCh)
		lowClient.HTTPClient.CloseIdleConnections()
		lowQdrant.CloseClientConnections()
		waitGoroutinesSettled(t, baseline+1)

		if rec.Code != http.StatusGatewayTimeout {
			t.Fatalf("expected 504 on stalled boundary reconcile, got %d: %s", rec.Code, rec.Body.String())
		}
		q, _ := baseStore.GetQuotaStatus(context.Background(), contracts.RoleGuest, "sess-stall-abstain")
		if q.TurnsUsed != 0 {
			t.Fatalf("expected fallback bounded refund to restore quota to 0 turns, got %+v", q)
		}
		logText := logs.String()
		for _, want := range []string{
			`"event":"ai_ask.turn.reconcile_error"`,
			`"attemptId":"` + attemptID + `"`,
			`"correlationId":"corr-stall-abstain"`,
			`"groundingTier":"boundary"`,
			`"seam_type":"BOUNDARY_FAULT"`,
			`"reason":"timeout"`,
			`"event":"ai_ask.turn.audit"`,
			`"deltaStatus":"refunded"`,
		} {
			if !strings.Contains(logText, want) {
				t.Fatalf("expected log fragment %s in:\n%s", want, logText)
			}
		}

		// ErrTurnLeaseExpired on boundary abstention returns 504 with lease_expired diagnostic log
		var expLogs syncLogBuffer
		log.SetOutput(&expLogs)
		stallStore.mu.Lock()
		stallStore.stallReconcile = false
		stallStore.reconcileErr = pg.ErrTurnLeaseExpired
		stallStore.mu.Unlock()
		exitExp := make(chan struct{}, 1)
		hExp := handleAskPostWithDeps(unaryTurnDeps{
			provider:       prov,
			vectorStore:    lowClient,
			store:          baseStore,
			turnStore:      stallStore,
			privacyCfg:     privCfg,
			syncWait:       defaultSyncWaitWindow,
			cleanupTimeout: 40 * time.Millisecond,
			onWorkerExit:   func() { exitExp <- struct{}{} },
		})
		attemptExp := "33333333-3333-4333-8333-333333333302"
		reqExp := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader([]byte(`{"mode":"qa","attemptId":"`+attemptExp+`","question":"Can you share confidential NDA client names?"}`)))
		reqExp.Header.Set(internalauth.HeaderName, signHeader(t, internalauth.RoleGuest, "sess-abstain-expired"))
		reqExp.Header.Set("X-Correlation-Id", "corr-abstain-expired")
		recExp := httptest.NewRecorder()
		hExp.ServeHTTP(recExp, reqExp)
		waitWorkerExited(t, exitExp)
		if recExp.Code != http.StatusGatewayTimeout {
			t.Fatalf("expected 504 on ErrTurnLeaseExpired boundary abstention, got %d", recExp.Code)
		}
		if !strings.Contains(expLogs.String(), `"event":"ai_ask.turn.reconcile_error"`) || !strings.Contains(expLogs.String(), `"reason":"lease_expired"`) {
			t.Fatalf("expected lease_expired reconcile_error log, got:\n%s", expLogs.String())
		}
	})

	t.Run("stalled completed QA and JD Match ReconcileTurnTx cancels within cleanupTimeout, exits detached 202 worker cleanly, and preserves ErrTurnLeaseExpired 504", func(t *testing.T) {
		var logs syncLogBuffer
		prevOut := log.Writer()
		log.SetOutput(&logs)
		defer log.SetOutput(prevOut)

		baseStore := pg.NewMemoryStore()
		stallStore := &stallingTurnStore{
			Store:          baseStore,
			stallReconcile: true,
			stallRefund:    true,
			safetyCap:      300 * time.Millisecond,
		}
		qClient := &qdrant.Client{BaseURL: highQdrant.URL, HTTPClient: highQdrant.Client()}
		prov := &stubLLM{name: "stub-llm", chatDelay: 45 * time.Millisecond}
		baseline := runtime.NumGoroutine()

		// 1. Detached 202 async QA turn where both ReconcileTurnTx and fallback RefundTurnTx stall
		exitQA := make(chan struct{}, 1)
		hQA := handleAskPostWithDeps(unaryTurnDeps{
			provider:       prov,
			vectorStore:    qClient,
			store:          baseStore,
			turnStore:      stallStore,
			privacyCfg:     privCfg,
			syncWait:       15 * time.Millisecond,
			cleanupTimeout: 40 * time.Millisecond,
			onWorkerExit:   func() { exitQA <- struct{}{} },
		})
		attemptQA := "44444444-4444-4444-8444-444444444401"
		reqQA := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader([]byte(`{"mode":"qa","attemptId":"`+attemptQA+`","question":"How does async recovery handle PG stalls?"}`)))
		reqQA.Header.Set(internalauth.HeaderName, signHeader(t, internalauth.RoleGuest, "sess-detached-qa"))
		reqQA.Header.Set("X-Correlation-Id", "corr-detached-qa")
		recQA := httptest.NewRecorder()
		hQA.ServeHTTP(recQA, reqQA)
		if recQA.Code != http.StatusAccepted {
			t.Fatalf("expected 202 Accepted on slow chat, got %d: %s", recQA.Code, recQA.Body.String())
		}
		waitWorkerExited(t, exitQA)
		qClient.HTTPClient.CloseIdleConnections()
		highQdrant.CloseClientConnections()
		waitGoroutinesSettled(t, baseline+1)

		if stallStore.activeCalls.Load() != 0 {
			t.Fatalf("expected 0 active stalled store calls after detached exit, got %d", stallStore.activeCalls.Load())
		}
		qaLogText := logs.String()
		for _, want := range []string{
			`"event":"ai_ask.turn.reconcile_error"`,
			`"attemptId":"` + attemptQA + `"`,
			`"correlationId":"corr-detached-qa"`,
			`"seam_type":"BOUNDARY_FAULT"`,
			`"reason":"timeout"`,
			`"event":"ai_ask.turn.refund_error"`,
			`"deltaStatus":"refund_failed"`,
		} {
			if !strings.Contains(qaLogText, want) {
				t.Fatalf("expected log fragment %s in:\n%s", want, qaLogText)
			}
		}

		// 2. Completed JD Match turn with stalled ReconcileTurnTx and healthy RefundTurnTx
		var jdLogs syncLogBuffer
		log.SetOutput(&jdLogs)
		stallStore.mu.Lock()
		stallStore.stallRefund = false
		stallStore.mu.Unlock()
		prov.chatDelay = 0
		prov.chatFn = func([]llm.ChatMessage) (llm.Completion, error) {
			return llm.Completion{
				Text:       `{"answer":"Strong Go fit.","matchScore":88,"strengths":["Go"],"gaps":[]}`,
				Model:      "stub-jd",
				TokensUsed: 75,
			}, nil
		}
		defer func() { prov.chatFn = nil }()

		exitJD := make(chan struct{}, 1)
		hJD := handleAskPostWithDeps(unaryTurnDeps{
			provider:       prov,
			vectorStore:    qClient,
			store:          baseStore,
			turnStore:      stallStore,
			privacyCfg:     privCfg,
			syncWait:       defaultSyncWaitWindow,
			cleanupTimeout: 40 * time.Millisecond,
			onWorkerExit:   func() { exitJD <- struct{}{} },
		})
		attemptJD := "44444444-4444-4444-8444-444444444402"
		jdPayload := `{"mode":"jd_match","attemptId":"` + attemptJD + `","jobDescription":"Seeking Senior Go Engineer building resilient Cloud Run and PostgreSQL 19 services."}`
		reqJD := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader([]byte(jdPayload)))
		reqJD.Header.Set(internalauth.HeaderName, signHeader(t, internalauth.RoleGuest, "sess-stall-jd"))
		reqJD.Header.Set("X-Correlation-Id", "corr-stall-jd")
		recJD := httptest.NewRecorder()
		hJD.ServeHTTP(recJD, reqJD)
		waitWorkerExited(t, exitJD)

		if recJD.Code != http.StatusGatewayTimeout {
			t.Fatalf("expected 504 on stalled jd_match reconcile, got %d: %s", recJD.Code, recJD.Body.String())
		}
		if !strings.Contains(jdLogs.String(), `"event":"ai_ask.turn.reconcile_error"`) ||
			!strings.Contains(jdLogs.String(), `"mode":"jd_match"`) ||
			!strings.Contains(jdLogs.String(), `"correlationId":"corr-stall-jd"`) {
			t.Fatalf("expected jd_match reconcile_error diagnostic log, got:\n%s", jdLogs.String())
		}
		qJD, _ := baseStore.GetQuotaStatus(context.Background(), contracts.RoleGuest, "sess-stall-jd")
		if qJD.TurnsUsed != 0 {
			t.Fatalf("expected refunded jd_match quota after reconcile stall, got %+v", qJD)
		}

		// 3. Completed QA turn with pg.ErrTurnLeaseExpired returns 504 and logs lease_expired without calling RefundTurnTx
		var expLogs syncLogBuffer
		log.SetOutput(&expLogs)
		stallStore.mu.Lock()
		stallStore.stallReconcile = false
		stallStore.reconcileErr = pg.ErrTurnLeaseExpired
		stallStore.mu.Unlock()
		prov.chatFn = nil
		beforeRefundCount := len(stallStore.snapshotCaptures())

		exitExp := make(chan struct{}, 1)
		hExp := handleAskPostWithDeps(unaryTurnDeps{
			provider:       prov,
			vectorStore:    qClient,
			store:          baseStore,
			turnStore:      stallStore,
			privacyCfg:     privCfg,
			syncWait:       defaultSyncWaitWindow,
			cleanupTimeout: 40 * time.Millisecond,
			onWorkerExit:   func() { exitExp <- struct{}{} },
		})
		attemptExp := "44444444-4444-4444-8444-444444444403"
		reqExp := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader([]byte(`{"mode":"qa","attemptId":"`+attemptExp+`","question":"Verify lease expired 504 path"}`)))
		reqExp.Header.Set(internalauth.HeaderName, signHeader(t, internalauth.RoleGuest, "sess-qa-expired"))
		reqExp.Header.Set("X-Correlation-Id", "corr-qa-expired")
		recExp := httptest.NewRecorder()
		hExp.ServeHTTP(recExp, reqExp)
		waitWorkerExited(t, exitExp)

		if recExp.Code != http.StatusGatewayTimeout {
			t.Fatalf("expected 504 on ErrTurnLeaseExpired, got %d: %s", recExp.Code, recExp.Body.String())
		}
		capsAfterExp := stallStore.snapshotCaptures()
		if len(capsAfterExp) != beforeRefundCount+1 || capsAfterExp[len(capsAfterExp)-1].op != "reconcile" {
			t.Fatalf("expected ErrTurnLeaseExpired not to issue extra RefundTurnTx, got %+v", capsAfterExp[beforeRefundCount:])
		}
		if !strings.Contains(expLogs.String(), `"event":"ai_ask.turn.reconcile_error"`) || !strings.Contains(expLogs.String(), `"reason":"lease_expired"`) {
			t.Fatalf("expected lease_expired reconcile_error log, got:\n%s", expLogs.String())
		}
	})
}
