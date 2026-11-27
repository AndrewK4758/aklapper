package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	ai_askv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/ai_ask/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/gen/ai_ask/v1/ai_askv1connect"
	commonv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/common/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

type streamStubLLM struct {
	chunks       []string
	chunkDelay   time.Duration
	tokensUsed   int
	streamErr    error
	embedErr     error
	onEmbed      func()
	ctxCancelled atomic.Bool
	streamCalls  atomic.Int32
}

func (s *streamStubLLM) Name() string { return "stream-stub-llm" }

func (s *streamStubLLM) Chat(_ context.Context, _ []llm.ChatMessage, _ int) (llm.Completion, error) {
	return llm.Completion{Text: strings.Join(s.chunks, ""), TokensUsed: s.tokensUsed, Model: "stub-v1"}, nil
}

func (s *streamStubLLM) Embed(_ context.Context, _ string) ([]float32, error) {
	if s.onEmbed != nil {
		s.onEmbed()
	}
	if s.embedErr != nil {
		return nil, s.embedErr
	}
	v := make([]float32, llm.ExpectedEmbeddingDims)
	for i := range v {
		v[i] = 0.25
	}
	return v, nil
}

func (s *streamStubLLM) ChatStream(ctx context.Context, _ llm.ChatStreamRequest, onChunk func(llm.ChatStreamChunk) error) (llm.ChatStreamResult, error) {
	s.streamCalls.Add(1)
	var out strings.Builder
	for _, ch := range s.chunks {
		if s.chunkDelay > 0 {
			select {
			case <-ctx.Done():
				s.ctxCancelled.Store(true)
				return llm.ChatStreamResult{Text: out.String(), Model: "stub-v1"}, ctx.Err()
			case <-time.After(s.chunkDelay):
			}
		}
		if ctx.Err() != nil {
			s.ctxCancelled.Store(true)
			return llm.ChatStreamResult{Text: out.String(), Model: "stub-v1"}, ctx.Err()
		}
		out.WriteString(ch)
		if onChunk != nil {
			if err := onChunk(llm.ChatStreamChunk{Delta: ch}); err != nil {
				return llm.ChatStreamResult{Text: out.String(), Model: "stub-v1"}, err
			}
		}
	}
	if s.streamErr != nil {
		return llm.ChatStreamResult{Text: out.String(), Model: "stub-v1"}, s.streamErr
	}
	return llm.ChatStreamResult{Text: out.String(), Model: "stub-v1", TokensUsed: s.tokensUsed, FinishReason: "stop"}, nil
}

func newTestQdrantServer(t *testing.T, score float64) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/collections/portfolio_docs":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"result": map[string]any{"status": "green", "points_count": 2},
			})
		case r.Method == http.MethodPost && r.URL.Path == "/collections/portfolio_docs/points/search":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"result": []map[string]any{{
					"id":    qdrant.PortfolioPointID("curated:arch", 0),
					"score": score,
					"payload": map[string]any{
						"docId": "curated:arch", "title": "Architecture",
						"snippet": "Go + React Router SSR.", "category": "architecture",
					},
				}},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestAskStreamHTTPAndGRPCContracts(t *testing.T) {
	const secret = "unit-test-secret"
	t.Setenv("INTERNAL_AUTH_SECRET", secret)

	qSrv := newTestQdrantServer(t, 0.92)
	privCfg, err := privacy.LoadConfig(privacy.ConfigInput{
		RawDenylist:    `["Project-Mercury-NDA"]`,
		DenylistAction: privacy.ActionRedact,
		SecretAction:   privacy.ActionAbort,
	})
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}

	t.Run("HTTP SSE streams post-guard deltas, replays completed attemptId, and strips Connection header", func(t *testing.T) {
		provider := &streamStubLLM{chunks: []string{"Built Pro", "ject-Mer", "cury-NDA platform."}, tokensUsed: 88}
		store := pg.NewMemoryStore()
		deps := askStreamDeps{provider: provider, vectorStore: &qdrant.Client{BaseURL: qSrv.URL}, store: store, privacyCfg: privCfg}
		h := newHandlerWithDeps(deps, defaultSyncWaitWindow)

		tok := signHeader(t, internalauth.RoleGuest, "guest-sse-1")
		attemptID := "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"
		body := []byte(`{"mode":"qa","attemptId":"` + attemptID + `","question":"Explain architecture"}`)

		req := httptest.NewRequest(http.MethodPost, "/v1/ask/stream", bytes.NewReader(body))
		req.Header.Set(internalauth.HeaderName, tok)
		req.Header.Set("X-Correlation-Id", "corr-sse-01")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 SSE, got %d: %s", rec.Code, rec.Body.String())
		}
		if rec.Header().Get("Connection") != "" {
			t.Fatalf("expected zero Connection header on SSE, got %q", rec.Header().Get("Connection"))
		}
		raw := rec.Body.String()
		if strings.Contains(raw, "Project-Mercury-NDA") || !strings.Contains(raw, "[REDACTED]") {
			t.Fatalf("expected post-guard redaction in SSE stream, got:\n%s", raw)
		}
		if !strings.Contains(raw, "event: meta\n") || !strings.Contains(raw, "event: sources\n") || !strings.Contains(raw, "event: done\n") {
			t.Fatalf("missing required SSE event sequence:\n%s", raw)
		}

		// Verify persisted ask_turns.result_json contains ONLY post-guard output
		turn, _, err := store.GetTurnByAttemptID(context.Background(), attemptID, "guest-sse-1")
		if err != nil || turn.Result == nil || strings.Contains(turn.Result.Answer, "Project-Mercury-NDA") {
			t.Fatalf("persisted ask_turns.result_json leaked raw text: %+v err=%v", turn, err)
		}

		// Duplicate attemptId replays completed SSE without re-invoking LLM
		callsBeforeReplay := provider.streamCalls.Load()
		req2 := httptest.NewRequest(http.MethodPost, "/v1/ask/stream", bytes.NewReader(body))
		req2.Header.Set(internalauth.HeaderName, tok)
		rec2 := httptest.NewRecorder()
		h.ServeHTTP(rec2, req2)
		if rec2.Code != http.StatusOK || provider.streamCalls.Load() != callsBeforeReplay {
			t.Fatalf("expected zero additional LLM calls on 200 SSE replay, before=%d after=%d code=%d", callsBeforeReplay, provider.streamCalls.Load(), rec2.Code)
		}
	})

	t.Run("Built-in secret abort refunds turn, persists zero leaked text, and returns 403 on lookup & replay", func(t *testing.T) {
		provider := &streamStubLLM{chunks: []string{"postgres://admin:s3cr3tP4ssw0rd", "@db.internal:5432/aklapper"}, tokensUsed: 40}
		store := pg.NewMemoryStore()
		emptyCfg, _ := privacy.LoadConfig(privacy.ConfigInput{})
		deps := askStreamDeps{provider: provider, vectorStore: &qdrant.Client{BaseURL: qSrv.URL}, store: store, privacyCfg: emptyCfg}
		h := newHandlerWithDeps(deps, defaultSyncWaitWindow)

		tok := signHeader(t, internalauth.RoleGuest, "guest-secret")
		attemptID := "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"
		body := []byte(`{"mode":"qa","attemptId":"` + attemptID + `","question":"Leak check"}`)
		req := httptest.NewRequest(http.MethodPost, "/v1/ask/stream", bytes.NewReader(body))
		req.Header.Set(internalauth.HeaderName, tok)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)

		if strings.Contains(rec.Body.String(), "s3cr3t") || !strings.Contains(rec.Body.String(), contracts.ErrCodeForbidden) {
			t.Fatalf("expected ERR_FORBIDDEN without secret leak, got:\n%s", rec.Body.String())
		}

		// GET /v1/ask/turns/{attemptId} returns HTTP 403 ERR_FORBIDDEN
		pollReq := httptest.NewRequest(http.MethodGet, "/v1/ask/turns/"+attemptID, nil)
		pollReq.SetPathValue("attemptId", attemptID)
		pollReq.Header.Set(internalauth.HeaderName, tok)
		pollRec := httptest.NewRecorder()
		h.ServeHTTP(pollRec, pollReq)
		if pollRec.Code != http.StatusForbidden {
			t.Fatalf("expected HTTP 403 on turn lookup, got %d: %s", pollRec.Code, pollRec.Body.String())
		}

		// Replaying failed attemptId returns synchronous 403 before flushing 200
		replayReq := httptest.NewRequest(http.MethodPost, "/v1/ask/stream", bytes.NewReader(body))
		replayReq.Header.Set(internalauth.HeaderName, tok)
		replayRec := httptest.NewRecorder()
		h.ServeHTTP(replayRec, replayReq)
		if replayRec.Code != http.StatusForbidden {
			t.Fatalf("expected synchronous HTTP 403 on failed replay, got %d", replayRec.Code)
		}
	})

	t.Run("Zero-rune client cancel refunds with 499; partial-rune cancel reconciles aborted_partial", func(t *testing.T) {
		store := pg.NewMemoryStore()

		// 1. Zero-rune cancel before first delta -> RefundTurnTx + 499 on lookup
		slowZero := &streamStubLLM{chunks: []string{"delayed text"}, chunkDelay: 200 * time.Millisecond, tokensUsed: 30}
		hZero := newHandlerWithDeps(askStreamDeps{provider: slowZero, vectorStore: &qdrant.Client{BaseURL: qSrv.URL}, store: store, privacyCfg: privCfg}, defaultSyncWaitWindow)
		tok := signHeader(t, internalauth.RoleGuest, "guest-cancel-0")
		att0 := "cccccccc-cccc-4ccc-8ccc-ccccccccccc1"
		ctx0, cancel0 := context.WithCancel(context.Background())
		go func() {
			time.Sleep(40 * time.Millisecond)
			cancel0()
		}()
		req0 := httptest.NewRequest(http.MethodPost, "/v1/ask/stream", bytes.NewReader([]byte(`{"mode":"qa","attemptId":"`+att0+`","question":"Cancel at zero runes"}`))).WithContext(ctx0)
		req0.Header.Set(internalauth.HeaderName, tok)
		hZero.ServeHTTP(httptest.NewRecorder(), req0)

		poll0 := httptest.NewRequest(http.MethodGet, "/v1/ask/turns/"+att0, nil)
		poll0.SetPathValue("attemptId", att0)
		poll0.Header.Set(internalauth.HeaderName, tok)
		pollRec0 := httptest.NewRecorder()
		hZero.ServeHTTP(pollRec0, poll0)
		if pollRec0.Code != 499 || !slowZero.ctxCancelled.Load() {
			t.Fatalf("expected 499 ERR_STREAM_ABORTED and cancelled LLM ctx, got code=%d cancelled=%v body=%s", pollRec0.Code, slowZero.ctxCancelled.Load(), pollRec0.Body.String())
		}

		// 2. Partial-rune cancel after >0 runes emitted -> ReconcileTurnTx charging 1 turn + estimated tokens
		// Chunk 1 exceeds 16-rune baseline holdback so safe prefix flushes before Chunk 2 stalls.
		slowPartial := &streamStubLLM{
			chunks:     []string{"This is a sufficiently long safe first streaming chunk that flushes immediately. ", "second stalled chunk"},
			chunkDelay: 60 * time.Millisecond,
			tokensUsed: 0,
		}
		emptyPriv, _ := privacy.LoadConfig(privacy.ConfigInput{})
		hPart := newHandlerWithDeps(askStreamDeps{provider: slowPartial, vectorStore: &qdrant.Client{BaseURL: qSrv.URL}, store: store, privacyCfg: emptyPriv}, defaultSyncWaitWindow)
		tokP := signHeader(t, internalauth.RoleGuest, "guest-cancel-partial")
		attP := "cccccccc-cccc-4ccc-8ccc-ccccccccccc2"
		ctxP, cancelP := context.WithCancel(context.Background())
		go func() {
			time.Sleep(90 * time.Millisecond)
			cancelP()
		}()
		reqP := httptest.NewRequest(http.MethodPost, "/v1/ask/stream", bytes.NewReader([]byte(`{"mode":"qa","attemptId":"`+attP+`","question":"Cancel after partial runes"}`))).WithContext(ctxP)
		reqP.Header.Set(internalauth.HeaderName, tokP)
		hPart.ServeHTTP(httptest.NewRecorder(), reqP)

		turnP, quotaP, err := store.GetTurnByAttemptID(context.Background(), attP, "guest-cancel-partial")
		if err != nil || turnP.Status != contracts.TurnStatusFailed || turnP.ErrorCode != contracts.ErrCodeStreamAborted || quotaP.TurnsUsed != 1 || turnP.TokensUsed < 1 {
			t.Fatalf("expected partial-rune cancel reconciled under failed status with >=1 token charged, got turn=%+v quota=%+v err=%v", turnP, quotaP, err)
		}
		histP, _ := store.ListConversationHistory(context.Background(), "guest-cancel-partial", turnP.ConversationID, 6)
		if len(histP) != 0 {
			t.Fatalf("expected partial-aborted failed turn excluded from conversation recall, got %+v", histP)
		}
	})

	t.Run("Embed failure emits SSE error event and refunds quota after early status flush; low score abstains cleanly", func(t *testing.T) {
		failProv := &streamStubLLM{embedErr: errors.New("embed offline")}
		store := pg.NewMemoryStore()
		hFail := newHandlerWithDeps(askStreamDeps{provider: failProv, vectorStore: &qdrant.Client{BaseURL: qSrv.URL}, store: store}, defaultSyncWaitWindow)
		tok := signHeader(t, internalauth.RoleGuest, "guest-fail-pre")
		attemptID := "abababab-abab-4bab-8bab-abababababab"
		req := httptest.NewRequest(http.MethodPost, "/v1/ask/stream", bytes.NewReader([]byte(`{"mode":"qa","attemptId":"`+attemptID+`","question":"Will fail embed"}`)))
		req.Header.Set(internalauth.HeaderName, tok)
		rec := httptest.NewRecorder()
		hFail.ServeHTTP(rec, req)
		body := rec.Body.String()
		if rec.Code != http.StatusOK || !strings.Contains(body, "event: status\n") || !strings.Contains(body, "event: error\n") || !strings.Contains(body, contracts.ErrCodeUpstreamUnavailable) {
			t.Fatalf("expected early SSE headers followed by ERR_UPSTREAM_UNAVAILABLE error event, got code=%d body=%s", rec.Code, body)
		}
		turn, quota, err := store.GetTurnByAttemptID(context.Background(), attemptID, "guest-fail-pre")
		if err != nil || turn.ErrorCode != contracts.ErrCodeUpstreamUnavailable || quota.TurnsUsed != 0 {
			t.Fatalf("expected refunded ERR_UPSTREAM_UNAVAILABLE turn, got turn=%+v quota=%+v err=%v", turn, quota, err)
		}

		lowQ := newTestQdrantServer(t, 0.12)
		okProv := &streamStubLLM{chunks: []string{"should not be called"}}
		hLow := newHandlerWithDeps(askStreamDeps{provider: okProv, vectorStore: &qdrant.Client{BaseURL: lowQ.URL}, store: store}, defaultSyncWaitWindow)
		reqLow := httptest.NewRequest(http.MethodPost, "/v1/ask/stream", bytes.NewReader([]byte(`{"mode":"qa","question":"Can you share confidential NDA client names?"}`)))
		reqLow.Header.Set(internalauth.HeaderName, tok)
		recLow := httptest.NewRecorder()
		hLow.ServeHTTP(recLow, reqLow)
		if recLow.Code != http.StatusOK || okProv.streamCalls.Load() != 0 || !strings.Contains(recLow.Body.String(), `"abstained":true`) {
			t.Fatalf("expected boundary SSE abstention with 0 LLM calls, code=%d calls=%d body=%s", recLow.Code, okProv.streamCalls.Load(), recLow.Body.String())
		}
	})

	t.Run("SSE headers and retrieving status flush before slow embedding cold load completes", func(t *testing.T) {
		embedStarted := make(chan struct{})
		releaseEmbed := make(chan struct{})
		slowEmbedProv := &streamStubLLM{
			chunks:     []string{"Cold-loaded ", "response."},
			tokensUsed: 24,
			onEmbed: func() {
				close(embedStarted)
				<-releaseEmbed
			},
		}
		store := pg.NewMemoryStore()
		h := newHandlerWithDeps(askStreamDeps{provider: slowEmbedProv, vectorStore: &qdrant.Client{BaseURL: qSrv.URL}, store: store, privacyCfg: privCfg}, defaultSyncWaitWindow)
		srv := httptest.NewServer(h)
		defer srv.Close()

		tok := signHeader(t, internalauth.RoleGuest, "guest-cold-load")
		req, err := http.NewRequest(http.MethodPost, srv.URL+"/v1/ask/stream", bytes.NewReader([]byte(`{"mode":"qa","question":"Explain architecture"}`)))
		if err != nil {
			t.Fatalf("NewRequest: %v", err)
		}
		req.Header.Set(internalauth.HeaderName, tok)

		respCh := make(chan *http.Response, 1)
		errCh := make(chan error, 1)
		go func() {
			res, doErr := srv.Client().Do(req)
			if doErr != nil {
				errCh <- doErr
				return
			}
			respCh <- res
		}()

		<-embedStarted
		select {
		case doErr := <-errCh:
			t.Fatalf("HTTP request failed while embed was blocked: %v", doErr)
		case res := <-respCh:
			defer res.Body.Close()
			if res.StatusCode != http.StatusOK {
				t.Fatalf("expected 200 SSE headers before embed finished, got %d", res.StatusCode)
			}
			close(releaseEmbed)
			rawBytes, readErr := io.ReadAll(res.Body)
			if readErr != nil {
				t.Fatalf("ReadAll: %v", readErr)
			}
			raw := string(rawBytes)
			if !strings.Contains(raw, `"stage":"retrieving"`) || !strings.Contains(raw, "event: sources\n") || !strings.Contains(raw, "event: delta\n") || !strings.Contains(raw, "event: done\n") {
				t.Fatalf("expected full retrieving -> sources -> delta -> done SSE sequence, got:\n%s", raw)
			}
		case <-time.After(1 * time.Second):
			close(releaseEmbed)
			t.Fatal("timed out waiting for SSE response headers while embedding cold load was blocked")
		}
	})

	t.Run("Single-port h2c AskService RPCs enforce auth, stream status+preamble race-free, and preserve GetTurn anti-enumeration & Reindex RBAC", func(t *testing.T) {
		provider := &streamStubLLM{chunks: []string{"Go gRPC ", "works end-to-end."}, tokensUsed: 64}
		store := pg.NewMemoryStore()
		deps := askStreamDeps{provider: provider, vectorStore: &qdrant.Client{BaseURL: qSrv.URL}, store: store, privacyCfg: privCfg}
		h := newHandlerWithDeps(deps, defaultSyncWaitWindow)

		srvCtx, srvCancel := context.WithCancel(context.Background())
		readyCh := make(chan string, 1)
		doneCh := make(chan error, 1)
		go func() {
			doneCh <- httpkit.ListenAndServeH2CGraceful(srvCtx, httpkit.H2CServerConfig{
				Addr:            "127.0.0.1:0",
				Handler:         h,
				ShutdownTimeout: 2 * time.Second,
				OnReady:         func(addr string) { readyCh <- addr },
			})
		}()
		addr := <-readyCh
		t.Cleanup(func() {
			srvCancel()
			<-doneCh
		})

		baseURL := "http://" + addr
		h2cHTTP := grpckit.NewH2CClient()
		t.Cleanup(h2cHTTP.CloseIdleConnections)

		guestCfg := grpckit.ClientAuthConfig{Role: internalauth.RoleGuest, Subject: "grpc-guest-1", Secret: secret, TTL: time.Minute}
		client := ai_askv1connect.NewAskServiceClient(
			h2cHTTP,
			baseURL,
			connect.WithGRPC(),
			connect.WithInterceptors(grpckit.NewClientAuthInterceptor(guestCfg)),
		)

		attemptID := "dddddddd-dddd-4ddd-8ddd-ddddddddddd1"
		convID := "dddddddd-dddd-4ddd-8ddd-ddddddddddd2"
		sReq := connect.NewRequest(&ai_askv1.StreamAskRequest{
			Mode:           "qa",
			AttemptId:      attemptID,
			ConversationId: convID,
			VisitorLens:    "engineering-peer",
			Question:       "How does gRPC work?",
		})
		sReq.Header().Set(grpckit.MetadataCorrelationID, "corr-grpc-e2e")
		st, err := client.StreamAsk(context.Background(), sReq)
		if err != nil {
			t.Fatalf("StreamAsk: %v", err)
		}
		defer st.Close()

		var gotStatus, gotMeta, gotSources, gotDone bool
		var deltaText strings.Builder
		for st.Receive() {
			chunk := st.Msg()
			switch p := chunk.Payload.(type) {
			case *ai_askv1.AskStreamChunk_Status:
				if p.Status.GetStage() == "retrieving" {
					gotStatus = true
				}
			case *ai_askv1.AskStreamChunk_Meta:
				gotMeta = p.Meta.GetConversationId() == convID && p.Meta.GetTurnIndex() == 1
			case *ai_askv1.AskStreamChunk_Sources:
				gotSources = len(p.Sources.Sources) > 0
			case *ai_askv1.AskStreamChunk_Delta:
				deltaText.WriteString(p.Delta.Text)
			case *ai_askv1.AskStreamChunk_Done:
				gotDone = p.Done.Grounded && p.Done.ConversationId == convID && p.Done.GetTurnIndex() == 1 && p.Done.TokensUsed >= 64
			}
		}
		if st.Err() != nil {
			t.Fatalf("StreamAsk stream err: %v", st.Err())
		}
		if !gotStatus || !gotMeta || !gotSources || !gotDone || deltaText.String() != "Go gRPC works end-to-end." {
			t.Fatalf("unexpected gRPC stream sequence: status=%v meta=%v sources=%v done=%v text=%q", gotStatus, gotMeta, gotSources, gotDone, deltaText.String())
		}

		// Unary Ask happy path
		unaryResp, err := client.Ask(context.Background(), connect.NewRequest(&ai_askv1.AskRequest{
			Mode:     "qa",
			Question: "Summarize architecture over unary Ask RPC",
		}))
		if err != nil || unaryResp.Msg.GetCompleted() == nil || !unaryResp.Msg.GetCompleted().GetGrounded() {
			t.Fatalf("unexpected unary Ask response: %+v err=%v", unaryResp, err)
		}

		// GetAskStatus returns ready
		statusResp, err := client.GetAskStatus(context.Background(), connect.NewRequest(&ai_askv1.GetAskStatusRequest{}))
		if err != nil || statusResp.Msg.GetStatus() != "ready" {
			t.Fatalf("unexpected GetAskStatus: %+v err=%v", statusResp, err)
		}

		// GetTurn returns conversationId + turnIndex for owning session
		turnResp, err := client.GetTurn(context.Background(), connect.NewRequest(&ai_askv1.GetTurnRequest{AttemptId: attemptID}))
		if err != nil || turnResp.Msg.GetStatus() != contracts.TurnStatusCompleted || turnResp.Msg.GetConversationId() != convID || turnResp.Msg.GetTurnIndex() != 1 {
			t.Fatalf("unexpected GetTurn: %+v err=%v", turnResp, err)
		}

		// Cross-session GetTurn returns CodeNotFound (404 anti-enumeration)
		otherClient := ai_askv1connect.NewAskServiceClient(
			h2cHTTP,
			baseURL,
			connect.WithGRPC(),
			connect.WithInterceptors(grpckit.NewClientAuthInterceptor(grpckit.ClientAuthConfig{
				Role: internalauth.RoleGuest, Subject: "grpc-guest-other", Secret: secret, TTL: time.Minute,
			})),
		)
		_, otherErr := otherClient.GetTurn(context.Background(), connect.NewRequest(&ai_askv1.GetTurnRequest{AttemptId: attemptID}))
		var notFoundErr *connect.Error
		if !errors.As(otherErr, &notFoundErr) || notFoundErr.Code() != connect.CodeNotFound {
			t.Fatalf("expected CodeNotFound on cross-session GetTurn, got %v", otherErr)
		}

		// Non-admin Reindex fails closed with CodePermissionDenied + ErrorDetailEnvelope
		_, reindexGuestErr := client.Reindex(context.Background(), connect.NewRequest(&ai_askv1.ReindexRequest{}))
		var permErr *connect.Error
		if !errors.As(reindexGuestErr, &permErr) || permErr.Code() != connect.CodePermissionDenied || len(permErr.Details()) == 0 {
			t.Fatalf("expected CodePermissionDenied with detail on guest Reindex, got %v", reindexGuestErr)
		}
		val, valErr := permErr.Details()[0].Value()
		env, ok := val.(*commonv1.ErrorDetailEnvelope)
		if valErr != nil || !ok || env.GetError().GetCode() != contracts.ErrCodeForbidden {
			t.Fatalf("expected ERR_FORBIDDEN ErrorDetailEnvelope, got %+v err=%v", val, valErr)
		}

		// Unauthenticated client fails closed
		rawClient := ai_askv1connect.NewAskServiceClient(h2cHTTP, baseURL, connect.WithGRPC())
		_, uErr := rawClient.GetAskStatus(context.Background(), connect.NewRequest(&ai_askv1.GetAskStatusRequest{}))
		var unauthErr *connect.Error
		if !errors.As(uErr, &unauthErr) || unauthErr.Code() != connect.CodeUnauthenticated {
			t.Fatalf("expected CodeUnauthenticated, got %v", uErr)
		}

		// Concurrent preamble + main RAG streams pass -race cleanly
		var wg sync.WaitGroup
		for idx := range 4 {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				c := ai_askv1connect.NewAskServiceClient(
					h2cHTTP,
					baseURL,
					connect.WithGRPC(),
					connect.WithInterceptors(grpckit.NewClientAuthInterceptor(grpckit.ClientAuthConfig{
						Role: internalauth.RoleGuest, Subject: "grpc-race-" + string(rune('a'+i)), Secret: secret, TTL: time.Minute,
					})),
				)
				rStream, rErr := c.StreamAsk(context.Background(), connect.NewRequest(&ai_askv1.StreamAskRequest{
					Mode:     "qa",
					Question: "Explain concurrent preamble streaming safety",
				}))
				if rErr != nil {
					t.Errorf("concurrent StreamAsk %d: %v", i, rErr)
					return
				}
				defer rStream.Close()
				for rStream.Receive() {
				}
				if rStream.Err() != nil {
					t.Errorf("concurrent StreamAsk %d recv: %v", i, rStream.Err())
				}
			}(idx)
		}
		wg.Wait()
	})

	t.Run("Active stream renews lease and returns 409 on concurrent in-flight duplicate attemptId", func(t *testing.T) {
		store := pg.NewMemoryStore()
		slowProv := &streamStubLLM{chunks: []string{"part one ", "part two"}, chunkDelay: 70 * time.Millisecond, tokensUsed: 42}
		deps := askStreamDeps{
			provider:           slowProv,
			vectorStore:        &qdrant.Client{BaseURL: qSrv.URL},
			store:              store,
			privacyCfg:         privCfg,
			leaseRenewInterval: 25 * time.Millisecond,
		}
		h := newHandlerWithDeps(deps, defaultSyncWaitWindow)
		tok := signHeader(t, internalauth.RoleGuest, "guest-inflight")
		att := "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1"
		body := []byte(`{"mode":"qa","attemptId":"` + att + `","question":"Long streaming answer"}`)

		done1 := make(chan int, 1)
		go func() {
			req1 := httptest.NewRequest(http.MethodPost, "/v1/ask/stream", bytes.NewReader(body))
			req1.Header.Set(internalauth.HeaderName, tok)
			rec1 := httptest.NewRecorder()
			h.ServeHTTP(rec1, req1)
			done1 <- rec1.Code
		}()

		time.Sleep(45 * time.Millisecond)
		reqDup := httptest.NewRequest(http.MethodPost, "/v1/ask/stream", bytes.NewReader(body))
		reqDup.Header.Set(internalauth.HeaderName, tok)
		recDup := httptest.NewRecorder()
		h.ServeHTTP(recDup, reqDup)
		if recDup.Code != http.StatusConflict {
			t.Fatalf("expected 409 Conflict on in-flight duplicate attemptId, got %d: %s", recDup.Code, recDup.Body.String())
		}

		if code1 := <-done1; code1 != http.StatusOK {
			t.Fatalf("expected primary stream 200 OK, got %d", code1)
		}
	})
}

type recordingBudgetLLM struct {
	mu            sync.Mutex
	streamReqs    []llm.ChatStreamRequest
	chatMaxTokens []int
	chatReplies   []string
}

func (r *recordingBudgetLLM) Name() string { return "recording-budget-llm" }

func (r *recordingBudgetLLM) Chat(_ context.Context, _ []llm.ChatMessage, maxTokens int) (llm.Completion, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.chatMaxTokens = append(r.chatMaxTokens, maxTokens)
	reply := "Grounded answer."
	if len(r.chatReplies) > 0 {
		reply = r.chatReplies[0]
		r.chatReplies = r.chatReplies[1:]
	}
	return llm.Completion{Text: reply, TokensUsed: 40, Model: "gemini-3.8-flash"}, nil
}

func (r *recordingBudgetLLM) Embed(_ context.Context, _ string) ([]float32, error) {
	v := make([]float32, llm.ExpectedEmbeddingDims)
	for i := range v {
		v[i] = 0.25
	}
	return v, nil
}

func (r *recordingBudgetLLM) ChatStream(_ context.Context, req llm.ChatStreamRequest, onChunk func(llm.ChatStreamChunk) error) (llm.ChatStreamResult, error) {
	r.mu.Lock()
	r.streamReqs = append(r.streamReqs, req)
	r.mu.Unlock()
	if onChunk != nil {
		if err := onChunk(llm.ChatStreamChunk{Delta: "Grounded stream."}); err != nil {
			return llm.ChatStreamResult{}, err
		}
	}
	return llm.ChatStreamResult{Text: "Grounded stream.", TokensUsed: 40, Model: "gemini-3.8-flash", FinishReason: "STOP"}, nil
}

func TestAskGenerationTokenHeadroom(t *testing.T) {
	t.Setenv("INTERNAL_AUTH_SECRET", "unit-test-secret")
	qdrantSrv := newTestQdrantServer(t, 0.92)
	recLLM := &recordingBudgetLLM{}
	store := pg.NewMemoryStore()
	h := newHandlerWithDeps(askStreamDeps{
		provider:    recLLM,
		vectorStore: &qdrant.Client{BaseURL: qdrantSrv.URL},
		store:       store,
	}, defaultSyncWaitWindow)
	tok := signHeader(t, internalauth.RoleGuest, "guest-headroom")

	// 1. Streaming QA -> MaxTokens 1024, IncludeThoughts false
	streamReq := httptest.NewRequest(http.MethodPost, "/v1/ask/stream", bytes.NewReader([]byte(
		`{"mode":"qa","attemptId":"11111111-1111-4111-8111-111111111111","question":"Describe Go architecture"}`,
	)))
	streamReq.Header.Set(internalauth.HeaderName, tok)
	streamRec := httptest.NewRecorder()
	h.ServeHTTP(streamRec, streamReq)
	if streamRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for stream QA, got %d: %s", streamRec.Code, streamRec.Body.String())
	}
	var sawMain1024 bool
	for _, sreq := range recLLM.streamReqs {
		if sreq.IncludeThoughts {
			t.Fatalf("expected IncludeThoughts=false on all stream reqs, got %+v", sreq)
		}
		if sreq.MaxTokens == 1024 {
			sawMain1024 = true
		} else if sreq.MaxTokens != preambleMaxTokens {
			t.Fatalf("unexpected stream MaxTokens=%d (expected 1024 or %d)", sreq.MaxTokens, preambleMaxTokens)
		}
	}
	if !sawMain1024 {
		t.Fatalf("expected main stream MaxTokens=1024 IncludeThoughts=false, got %+v", recLLM.streamReqs)
	}

	// 2. Unary QA -> maxTokens 1024
	unaryReq := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader([]byte(
		`{"mode":"qa","attemptId":"22222222-2222-4222-8222-222222222222","question":"Describe React Router SSR"}`,
	)))
	unaryReq.Header.Set(internalauth.HeaderName, tok)
	unaryRec := httptest.NewRecorder()
	h.ServeHTTP(unaryRec, unaryReq)
	if unaryRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for unary QA, got %d: %s", unaryRec.Code, unaryRec.Body.String())
	}
	if len(recLLM.chatMaxTokens) != 1 || recLLM.chatMaxTokens[0] != 1024 {
		t.Fatalf("expected unary QA maxTokens=1024, got %v", recLLM.chatMaxTokens)
	}

	// 3. JD Match synthesis + repair -> both maxTokens 1024
	jdLLM := &recordingBudgetLLM{
		chatReplies: []string{
			"not valid json",
			`{"answer":"Strong match","matchScore":88,"strengths":["Go"],"gaps":["None"]}`,
		},
	}
	if _, _, err := evaluateJDWithLLM(context.Background(), jdLLM, "Evidence", "Senior Go Engineer"); err != nil {
		t.Fatalf("evaluateJDWithLLM failed: %v", err)
	}
	if len(jdLLM.chatMaxTokens) != 2 || jdLLM.chatMaxTokens[0] != 1024 || jdLLM.chatMaxTokens[1] != 1024 {
		t.Fatalf("expected JD synthesis and repair maxTokens=[1024 1024], got %v", jdLLM.chatMaxTokens)
	}

	// 4. Follow-up rewrite -> 384 tokens, 4s timeout
	if followUpRewriteMaxTokens != 384 {
		t.Fatalf("expected followUpRewriteMaxTokens=384, got %d", followUpRewriteMaxTokens)
	}
	if followUpRewriteTimeout != 4*time.Second {
		t.Fatalf("expected followUpRewriteTimeout=4s, got %v", followUpRewriteTimeout)
	}
}
