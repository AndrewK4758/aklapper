package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	cadencev1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/cadence/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/gen/cadence/v1/cadencev1connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
)

type streamingStubLLM struct {
	chunks        []string
	thoughtChunks []string
	responses     [][]string
	reqs          []llm.ChatStreamRequest
	calls         int
}

func (s *streamingStubLLM) Name() string                                         { return "stub-streaming-llm" }
func (s *streamingStubLLM) Embed(_ context.Context, _ string) ([]float32, error) { return nil, nil }
func (s *streamingStubLLM) Chat(_ context.Context, _ []llm.ChatMessage, _ int) (llm.Completion, error) {
	return llm.Completion{Text: strings.Join(s.chunks, ""), Model: "stub", TokensUsed: 120}, nil
}
func (s *streamingStubLLM) ChatStream(ctx context.Context, req llm.ChatStreamRequest, onChunk func(llm.ChatStreamChunk) error) (llm.ChatStreamResult, error) {
	s.reqs = append(s.reqs, req)
	for _, th := range s.thoughtChunks {
		if ctx.Err() != nil {
			return llm.ChatStreamResult{}, ctx.Err()
		}
		if err := onChunk(llm.ChatStreamChunk{ThoughtDelta: th}); err != nil {
			return llm.ChatStreamResult{}, err
		}
	}
	activeChunks := s.chunks
	if len(s.responses) > 0 {
		idx := s.calls
		if idx >= len(s.responses) {
			idx = len(s.responses) - 1
		}
		activeChunks = s.responses[idx]
	}
	s.calls++
	var all strings.Builder
	for _, ch := range activeChunks {
		if ctx.Err() != nil {
			return llm.ChatStreamResult{}, ctx.Err()
		}
		if err := onChunk(llm.ChatStreamChunk{Delta: ch}); err != nil {
			return llm.ChatStreamResult{}, err
		}
		all.WriteString(ch)
	}
	return llm.ChatStreamResult{Text: all.String(), Model: "stub", FinishReason: "stop", TokensUsed: 180}, nil
}

func TestCadenceShowcaseCacheGoldenPrivacyAndGRPC(t *testing.T) {
	t.Setenv("INTERNAL_AUTH_SECRET", "showcase-unit-secret")
	secret := "showcase-unit-secret"
	sessATok, _ := internalauth.Sign(internalauth.RoleGuest, "sess-A", time.Minute, secret)
	sessBTok, _ := internalauth.Sign(internalauth.RoleGuest, "sess-B", time.Minute, secret)

	t.Run("scoped custom prompt_hash cache isolates sessions and clones at $0 quota", func(t *testing.T) {
		store := pg.NewMemoryStore()
		h := newHandler(&stubBuildLLM{html: "invalid-json"}, nil, store)

		// Session A creates a custom fast run.
		reqA1 := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs", bytes.NewReader([]byte(`{"prompt":"Build custom isolation verifier","presetSlug":"custom","sessionId":"sess-A","mode":"fast"}`)))
		reqA1.Header.Set(internalauth.HeaderName, sessATok)
		recA1 := httptest.NewRecorder()
		h.ServeHTTP(recA1, reqA1)
		if recA1.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", recA1.Code, recA1.Body.String())
		}
		var runA1 contracts.CadenceRunResult
		_ = json.Unmarshal(recA1.Body.Bytes(), &runA1)
		if runA1.ExecutionMode != contracts.CadenceExecutionModeFast || runA1.Quota.TurnsUsed != 1 {
			t.Fatalf("unexpected runA1: mode=%q quota=%+v", runA1.ExecutionMode, runA1.Quota)
		}

		// Session A repeats same prompt (different casing/whitespace) -> $0 cached clone!
		reqA2 := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs", bytes.NewReader([]byte(`{"prompt":"  BUILD   CUSTOM  isolation verifier ","presetSlug":"custom","sessionId":"sess-A","mode":"fast"}`)))
		reqA2.Header.Set(internalauth.HeaderName, sessATok)
		recA2 := httptest.NewRecorder()
		h.ServeHTTP(recA2, reqA2)
		if recA2.Code != http.StatusCreated {
			t.Fatalf("expected 201 cached hit, got %d", recA2.Code)
		}
		var runA2 contracts.CadenceRunResult
		_ = json.Unmarshal(recA2.Body.Bytes(), &runA2)
		if runA2.ExecutionMode != contracts.CadenceExecutionModeCached || runA2.TokensIn != 0 || runA2.TokensOut != 0 || runA2.Quota.TurnsUsed != 1 {
			t.Fatalf("expected $0 cached hit with unchanged quota=1, got mode=%q tokens=(%d,%d) quota=%+v", runA2.ExecutionMode, runA2.TokensIn, runA2.TokensOut, runA2.Quota)
		}

		// Session B submits identical custom prompt -> MUST MISS sess-A private cache!
		reqB := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs", bytes.NewReader([]byte(`{"prompt":"Build custom isolation verifier","presetSlug":"custom","sessionId":"sess-B","mode":"fast"}`)))
		reqB.Header.Set(internalauth.HeaderName, sessBTok)
		recB := httptest.NewRecorder()
		h.ServeHTTP(recB, reqB)
		var runB contracts.CadenceRunResult
		_ = json.Unmarshal(recB.Body.Bytes(), &runB)
		if runB.ExecutionMode == contracts.CadenceExecutionModeCached || runB.RunID == runA1.RunID {
			t.Fatalf("expected sess-B to miss sess-A custom cache, got mode=%q runId=%q", runB.ExecutionMode, runB.RunID)
		}
	})

	t.Run("Golden Showcase row returns HTTP 409 on gate mutation and RefundSandboxRunQuotaTx refunds pending run", func(t *testing.T) {
		store := pg.NewMemoryStore()
		goldenID, err := store.CreateSandboxRun(context.Background(), pg.SandboxRunInput{
			SessionID:     "golden-showcase",
			MenuSlug:      "chord-decomposition-workbench",
			Prompt:        "Golden test",
			Status:        contracts.CadenceStatusReady,
			GateVerdict:   "approved",
			IsGolden:      true,
			ExecutionMode: contracts.CadenceExecutionModeGolden,
		})
		if err != nil {
			t.Fatalf("create golden run: %v", err)
		}
		goldenTok, _ := internalauth.Sign(internalauth.RoleGuest, "golden-showcase", time.Minute, secret)
		h := newHandler(nil, nil, store)
		gateReq := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs/"+goldenID+"/gate", bytes.NewReader([]byte(`{"verdict":"rejected"}`)))
		gateReq.Header.Set(internalauth.HeaderName, goldenTok)
		gateRec := httptest.NewRecorder()
		h.ServeHTTP(gateRec, gateReq)
		if gateRec.Code != http.StatusConflict {
			t.Fatalf("expected 409 for Golden gate mutation, got %d: %s", gateRec.Code, gateRec.Body.String())
		}

		pending, q1, allowed, err := store.CreatePendingSandboxRunWithQuota(context.Background(), contracts.RoleGuest, "refund-sess", 1, 800, pg.PendingSandboxRunInput{
			SessionID: "refund-sess",
			Prompt:    "Refund me on disconnect",
			Mode:      contracts.CadenceModeLLM,
		})
		if err != nil || !allowed || q1.TurnsUsed != 1 {
			t.Fatalf("expected pending run with turnsUsed=1, got err=%v allowed=%v quota=%+v", err, allowed, q1)
		}
		refunded, err := store.RefundSandboxRunQuotaTx(context.Background(), pending.RunID)
		if err != nil || !refunded {
			t.Fatalf("expected refund=true, got err=%v refunded=%v", err, refunded)
		}
		q2, _ := store.GetQuotaStatus(context.Background(), contracts.RoleGuest, "refund-sess")
		if q2.TurnsUsed != 0 || q2.TokensUsed != 0 {
			t.Fatalf("expected quota refunded to (0,0), got %+v", q2)
		}
	})

	t.Run("live llm mode bypasses cache and runs two-stage Spec -> Build producing fresh output each time", func(t *testing.T) {
		spec1, _ := json.Marshal(map[string]any{
			"triage": "First live angle",
			"spec": map[string]any{
				"title":      "Variant Alpha Scorecard",
				"summary":    "First live spec summary",
				"conditions": []string{"Prompt alpha received"},
				"handling":   []string{"Render split KPI matrix"},
				"outcomes":   []string{"Interactive alpha dashboard"},
				"rules":      []string{"Zero inline scripts"},
				"deltas":     []string{"Emits alpha spec"},
			},
		})
		build1, _ := json.Marshal(map[string]any{
			"gateChecks":   []map[string]any{{"id": "c1", "label": "Alpha Check", "status": "pass", "detail": "ok"}},
			"artifactHtml": "<!doctype html><html><body><h1>Variant Alpha</h1></body></html>",
		})
		spec2, _ := json.Marshal(map[string]any{
			"triage": "Second live angle",
			"spec": map[string]any{
				"title":      "Variant Beta Timeline",
				"summary":    "Second live spec summary",
				"conditions": []string{"Prompt beta received"},
				"handling":   []string{"Render accordion timeline"},
				"outcomes":   []string{"Interactive beta timeline"},
				"rules":      []string{"Zero inline scripts"},
				"deltas":     []string{"Emits beta spec"},
			},
		})
		build2, _ := json.Marshal(map[string]any{
			"gateChecks":   []map[string]any{{"id": "c2", "label": "Beta Check", "status": "pass", "detail": "ok"}},
			"artifactHtml": "<!doctype html><html><body><h1>Variant Beta</h1></body></html>",
		})
		stub := &streamingStubLLM{
			responses: [][]string{{string(spec1)}, {string(build1)}, {string(spec2)}, {string(build2)}},
		}
		store := pg.NewMemoryStore()
		h := newHandler(stub, nil, store)

		body := []byte(`{"prompt":"Build an architecture scorecard","presetSlug":"custom","sessionId":"sess-A","mode":"llm"}`)
		req1 := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs", bytes.NewReader(body))
		req1.Header.Set(internalauth.HeaderName, sessATok)
		rec1 := httptest.NewRecorder()
		h.ServeHTTP(rec1, req1)
		if rec1.Code != http.StatusCreated {
			t.Fatalf("expected 201 for live run 1, got %d: %s", rec1.Code, rec1.Body.String())
		}
		var run1 contracts.CadenceRunResult
		_ = json.Unmarshal(rec1.Body.Bytes(), &run1)

		req2 := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs", bytes.NewReader(body))
		req2.Header.Set(internalauth.HeaderName, sessATok)
		rec2 := httptest.NewRecorder()
		h.ServeHTTP(rec2, req2)
		if rec2.Code != http.StatusCreated {
			t.Fatalf("expected 201 for live run 2, got %d: %s", rec2.Code, rec2.Body.String())
		}
		var run2 contracts.CadenceRunResult
		_ = json.Unmarshal(rec2.Body.Bytes(), &run2)

		if run1.ExecutionMode != contracts.CadenceExecutionModeLive || run2.ExecutionMode != contracts.CadenceExecutionModeLive {
			t.Fatalf("expected both runs to execute live without cache cloning, got (%q, %q)", run1.ExecutionMode, run2.ExecutionMode)
		}
		if run1.Spec == nil || run2.Spec == nil || run1.Spec.Title == run2.Spec.Title {
			t.Fatalf("expected distinct live specs across identical prompts, got (%+v, %+v)", run1.Spec, run2.Spec)
		}
		if !strings.Contains(run1.ArtifactHTML, "Variant Alpha") || !strings.Contains(run2.ArtifactHTML, "Variant Beta") {
			t.Fatalf("expected distinct live HTML artifacts across runs")
		}
		if stub.calls != 4 {
			t.Fatalf("expected 4 LLM calls (2 Spec + 2 Build), got %d", stub.calls)
		}
	})

	t.Run("human spec gate pauses at awaiting_approval and resumes Build on POST /spec-gate at $0 extra quota", func(t *testing.T) {
		specJSON, _ := json.Marshal(map[string]any{
			"triage": "Human gated spec",
			"spec": map[string]any{
				"title":      "Human-Approved Telemetry Spec",
				"summary":    "Spec paused for operator sign-off before Build.",
				"conditions": []string{"Prompt requires human spec gate"},
				"handling":   []string{"Pause after Phase 2 spec"},
				"outcomes":   []string{"Build executes only after approval"},
				"rules":      []string{"Zero inline scripts"},
				"deltas":     []string{"Transitions awaiting_approval -> build_queued -> ready"},
			},
		})
		buildJSON, _ := json.Marshal(map[string]any{
			"gateChecks":   []map[string]any{{"id": "c1", "label": "Spec Check", "status": "pass", "detail": "ok"}},
			"artifactHtml": "<!doctype html><html><body><h1>Built From Approved Spec</h1></body></html>",
		})
		stub := &streamingStubLLM{
			responses: [][]string{{string(specJSON)}, {string(buildJSON)}},
		}
		store := pg.NewMemoryStore()
		h := newHandler(stub, nil, store)

		// 1. Initialize deferred run requiring human spec approval.
		initReq := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs", bytes.NewReader([]byte(`{"prompt":"Build a gated telemetry workbench","presetSlug":"custom","sessionId":"sess-A","mode":"llm","deferExecution":true,"requireSpecApproval":true}`)))
		initReq.Header.Set(internalauth.HeaderName, sessATok)
		initRec := httptest.NewRecorder()
		h.ServeHTTP(initRec, initReq)
		if initRec.Code != http.StatusAccepted {
			t.Fatalf("expected 202 init, got %d: %s", initRec.Code, initRec.Body.String())
		}
		var initRun contracts.CadenceRunResult
		_ = json.Unmarshal(initRec.Body.Bytes(), &initRun)

		// 2. Stream 1 runs Triage + Spec only and pauses at awaiting_approval.
		stream1Req := httptest.NewRequest(http.MethodGet, "/v1/cadence/runs/"+initRun.RunID+"/stream", nil)
		stream1Req.Header.Set(internalauth.HeaderName, sessATok)
		stream1Req.Header.Set("X-Session-Id", "sess-A")
		stream1Rec := httptest.NewRecorder()
		h.ServeHTTP(stream1Rec, stream1Req)
		if stream1Rec.Code != http.StatusOK {
			t.Fatalf("expected 200 stream1, got %d", stream1Rec.Code)
		}
		if stub.calls != 1 {
			t.Fatalf("expected exactly 1 LLM call (Spec only) before human approval, got %d", stub.calls)
		}
		pausedRow, _ := store.GetSandboxRun(context.Background(), initRun.RunID)
		if pausedRow.Status != contracts.CadenceStatusAwaitingApproval || pausedRow.SpecJSON == nil || pausedRow.SpecJSON.Title != "Human-Approved Telemetry Spec" {
			t.Fatalf("expected paused awaiting_approval with real spec, got status=%q spec=%+v", pausedRow.Status, pausedRow.SpecJSON)
		}

		// 3. Human approves spec -> 202 build_queued, quota unchanged (turnsUsed still 1).
		approveReq := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs/"+initRun.RunID+"/spec-gate", bytes.NewReader([]byte(`{"approved":true}`)))
		approveReq.Header.Set(internalauth.HeaderName, sessATok)
		approveReq.Header.Set("X-Session-Id", "sess-A")
		approveRec := httptest.NewRecorder()
		h.ServeHTTP(approveRec, approveReq)
		if approveRec.Code != http.StatusAccepted {
			t.Fatalf("expected 202 spec-gate approval, got %d: %s", approveRec.Code, approveRec.Body.String())
		}

		// 4. Stream 2 runs Build + Gate -> ready!
		stream2Req := httptest.NewRequest(http.MethodGet, "/v1/cadence/runs/"+initRun.RunID+"/stream", nil)
		stream2Req.Header.Set(internalauth.HeaderName, sessATok)
		stream2Req.Header.Set("X-Session-Id", "sess-A")
		stream2Rec := httptest.NewRecorder()
		h.ServeHTTP(stream2Rec, stream2Req)
		if stream2Rec.Code != http.StatusOK {
			t.Fatalf("expected 200 stream2, got %d", stream2Rec.Code)
		}
		if stub.calls != 2 {
			t.Fatalf("expected 2 total LLM calls (Spec + Build), got %d", stub.calls)
		}
		finalRow, _ := store.GetSandboxRun(context.Background(), initRun.RunID)
		if finalRow.Status != contracts.CadenceStatusReady || !strings.Contains(finalRow.ArtifactHTML, "Built From Approved Spec") {
			t.Fatalf("expected ready run with built HTML, got status=%q html=%q", finalRow.Status, finalRow.ArtifactHTML)
		}
		q, _ := store.GetQuotaStatus(context.Background(), contracts.RoleGuest, "sess-A")
		if q.TurnsUsed != 1 {
			t.Fatalf("expected 1 total turn charged across gated Spec->Build run, got %d", q.TurnsUsed)
		}
	})

	t.Run("live stream forwards StreamGuard-filtered ThoughtDelta and Delta into SSE log lines", func(t *testing.T) {
		specJSON, _ := json.Marshal(map[string]any{
			"triage": "Live stream test",
			"spec": map[string]any{
				"title":      "Live Streamed Spec",
				"summary":    "Verifies live token forwarding.",
				"conditions": []string{"c1"},
				"handling":   []string{"h1"},
				"outcomes":   []string{"o1"},
				"rules":      []string{"r1"},
				"deltas":     []string{"d1"},
			},
		})
		stub := &streamingStubLLM{
			thoughtChunks: []string{"Evaluating user prompt...\n"},
			chunks:        []string{string(specJSON)},
		}
		privacyCfg, _ := privacy.LoadConfig(privacy.ConfigInput{})
		var logs []string
		_, _, err := invokeLLMSpecStage(
			context.Background(),
			stub,
			privacyCfg,
			"corr-live-log",
			"custom",
			"Build a live monitor",
			nil,
			func(line string) { logs = append(logs, line) },
		)
		if err != nil {
			t.Fatalf("invokeLLMSpecStage: %v", err)
		}
		joined := strings.Join(logs, "\n")
		if !strings.Contains(joined, "[spec:thought] Evaluating user prompt...") {
			t.Fatalf("expected live thought log line, got:\n%s", joined)
		}
		if !strings.Contains(joined, "[spec:out] ") || !strings.Contains(joined, "Stream complete via stub") {
			t.Fatalf("expected live output + completion telemetry lines, got:\n%s", joined)
		}
	})

	t.Run("post-parse StreamGuard ActionAbort fails closed without fallback", func(t *testing.T) {
		// Synthetic credentialed URL matching built-in secret rule (not a real credential).
		fakeSecret := "postgres://demo_user:synthetic_secret_val@db.invalid:5432/app"
		payload := map[string]any{
			"triage": "Leaked " + fakeSecret,
			"spec": map[string]any{
				"title":      "Leaky Spec",
				"summary":    "Summary",
				"conditions": []string{"c1"},
				"handling":   []string{"h1"},
				"outcomes":   []string{"o1"},
				"rules":      []string{"r1"},
				"deltas":     []string{"d1"},
			},
		}
		raw, _ := json.Marshal(payload)
		privacyCfg, _ := privacy.LoadConfig(privacy.ConfigInput{})
		h := newHandlerWithDeps(cadenceServiceDeps{
			provider:   &streamingStubLLM{chunks: []string{string(raw)}},
			store:      pg.NewMemoryStore(),
			privacyCfg: privacyCfg,
		})

		req := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs", bytes.NewReader([]byte(`{"prompt":"Trigger privacy abort","presetSlug":"custom","sessionId":"sess-A","mode":"llm"}`)))
		req.Header.Set(internalauth.HeaderName, sessATok)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusForbidden {
			t.Fatalf("expected 403 fail-closed on built-in secret ActionAbort, got %d: %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("Single-port h2c CadenceService 5-RPC workflow, immediate initial log frame, ip_hash parity, and llm disconnect semantics", func(t *testing.T) {
		logs := &syncLogBuffer{}
		prevOut := log.Writer()
		log.SetOutput(logs)
		defer log.SetOutput(prevOut)

		store := pg.NewMemoryStore()
		blockLLM := make(chan struct{})
		llmEntered := make(chan struct{}, 2)
		stub := &blockingStreamLLM{
			entered: llmEntered,
			release: blockLLM,
		}
		h := newHandlerWithDeps(cadenceServiceDeps{
			provider: stub,
			store:    store,
		})

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
			close(blockLLM)
			srvCancel()
			<-doneCh
		})

		baseURL := "http://" + addr
		h2cHTTP := grpckit.NewH2CClient()
		t.Cleanup(h2cHTTP.CloseIdleConnections)

		// Unauthenticated CreateRun fails closed.
		rawClient := cadencev1connect.NewCadenceServiceClient(h2cHTTP, baseURL, connect.WithGRPC())
		_, uErr := rawClient.CreateRun(context.Background(), connect.NewRequest(&cadencev1.CreateRunRequest{Prompt: "Test gRPC auth"}))
		var unauthErr *connect.Error
		if !errors.As(uErr, &unauthErr) || unauthErr.Code() != connect.CodeUnauthenticated {
			t.Fatalf("expected CodeUnauthenticated, got %v", uErr)
		}

		clientA := cadencev1connect.NewCadenceServiceClient(
			h2cHTTP,
			baseURL,
			connect.WithGRPC(),
			connect.WithInterceptors(grpckit.NewClientAuthInterceptor(grpckit.ClientAuthConfig{
				Role: internalauth.RoleGuest, Subject: "sess-grpc-A", Secret: secret, TTL: time.Minute,
			})),
		)

		// 1. Deferred fast-mode run with requireSpecApproval=true -> StreamRun -> awaiting_approval -> ApproveSpecGate -> StreamRun -> ready -> SubmitGateVerdict -> ListRuns
		createRes, err := clientA.CreateRun(context.Background(), connect.NewRequest(&cadencev1.CreateRunRequest{
			Prompt:              "Build a CHORD single-port gRPC verification workbench",
			PresetSlug:          "custom",
			Mode:                contracts.CadenceModeFast,
			DeferExecution:      true,
			RequireSpecApproval: true,
		}))
		if err != nil || createRes.Msg.GetCreatedImmediately() || createRes.Msg.GetRun().GetRunStatus() != contracts.CadenceStatusPending {
			t.Fatalf("unexpected CreateRun: %+v err=%v", createRes, err)
		}
		runID := createRes.Msg.GetRun().GetRunId()

		// Verify unified proxy ip_hash constant and persisted pending status.
		storedRun, getErr := store.GetSandboxRun(context.Background(), runID)
		if getErr != nil || storedRun == nil || storedRun.Status != contracts.CadenceStatusPending || unifiedProxyIPHash != "portal-proxy" {
			t.Fatalf("expected pending run with unified ip_hash=portal-proxy, got run=%+v err=%v", storedRun, getErr)
		}

		// Stream spec phase: verify first frame is an immediate CadenceStreamLogEvent and final frame is complete (awaiting_approval).
		specStream, err := clientA.StreamRun(context.Background(), connect.NewRequest(&cadencev1.StreamRunRequest{RunId: runID}))
		if err != nil {
			t.Fatalf("StreamRun spec: %v", err)
		}
		var firstWasLog, sawPhase, sawSpecComplete bool
		frameIdx := 0
		for specStream.Receive() {
			msg := specStream.Msg()
			if frameIdx == 0 && msg.GetLog() != nil {
				firstWasLog = true
			}
			frameIdx++
			if msg.GetPhase() != nil {
				sawPhase = true
			}
			if comp := msg.GetComplete(); comp != nil && comp.GetRun().GetRunStatus() == contracts.CadenceStatusAwaitingApproval {
				sawSpecComplete = true
			}
		}
		_ = specStream.Close()
		if !firstWasLog || !sawPhase || !sawSpecComplete {
			t.Fatalf("unexpected spec stream frames: firstWasLog=%v sawPhase=%v sawSpecComplete=%v err=%v", firstWasLog, sawPhase, sawSpecComplete, specStream.Err())
		}

		// ApproveSpecGate -> build_queued
		approveRes, err := clientA.ApproveSpecGate(context.Background(), connect.NewRequest(&cadencev1.ApproveSpecGateRequest{RunId: runID}))
		if err != nil || approveRes.Msg.GetRun().GetRunStatus() != contracts.CadenceStatusBuildQueued {
			t.Fatalf("unexpected ApproveSpecGate: %+v err=%v", approveRes, err)
		}

		// Stream build phase -> ready with sanitized HTML
		buildStream, err := clientA.StreamRun(context.Background(), connect.NewRequest(&cadencev1.StreamRunRequest{RunId: runID}))
		if err != nil {
			t.Fatalf("StreamRun build: %v", err)
		}
		var sawBuildComplete bool
		for buildStream.Receive() {
			if comp := buildStream.Msg().GetComplete(); comp != nil && comp.GetRun().GetRunStatus() == contracts.CadenceStatusReady && comp.GetRun().GetArtifactHtml() != "" {
				sawBuildComplete = true
			}
		}
		_ = buildStream.Close()
		if !sawBuildComplete {
			t.Fatalf("expected build complete ready event, err=%v", buildStream.Err())
		}

		// Cross-session SubmitGateVerdict fails closed with CodePermissionDenied + echoed correlation ID.
		clientB := cadencev1connect.NewCadenceServiceClient(
			h2cHTTP,
			baseURL,
			connect.WithGRPC(),
			connect.WithInterceptors(grpckit.NewClientAuthInterceptor(grpckit.ClientAuthConfig{
				Role: internalauth.RoleGuest, Subject: "sess-grpc-B", Secret: secret, TTL: time.Minute,
			})),
		)
		crossReq := connect.NewRequest(&cadencev1.SubmitGateVerdictRequest{RunId: runID, Verdict: "approved"})
		crossReq.Header().Set(grpckit.MetadataCorrelationID, "corr-cross-sess")
		_, crossErr := clientB.SubmitGateVerdict(context.Background(), crossReq)
		var permErr *connect.Error
		if !errors.As(crossErr, &permErr) || permErr.Code() != connect.CodePermissionDenied || permErr.Meta().Get(grpckit.MetadataCorrelationID) != "corr-cross-sess" {
			t.Fatalf("expected CodePermissionDenied with echoed correlation ID, got err=%v", crossErr)
		}

		// Owning session SubmitGateVerdict -> approved
		verdictRes, err := clientA.SubmitGateVerdict(context.Background(), connect.NewRequest(&cadencev1.SubmitGateVerdictRequest{RunId: runID, Verdict: "approved"}))
		if err != nil || verdictRes.Msg.GetRun().GetGateVerdict() != "approved" {
			t.Fatalf("unexpected SubmitGateVerdict: %+v err=%v", verdictRes, err)
		}

		// ListRuns returns CadenceRunResult + QuotaStatus
		listRes, err := clientA.ListRuns(context.Background(), connect.NewRequest(&cadencev1.ListRunsRequest{SessionId: "sess-grpc-A", Limit: 10}))
		if err != nil || len(listRes.Msg.GetRuns()) != 1 || listRes.Msg.GetRuns()[0].GetRunStatus() != contracts.CadenceStatusReady || listRes.Msg.GetQuota() == nil {
			t.Fatalf("unexpected ListRuns: %+v err=%v", listRes, err)
		}

		// 2. LLM full-run disconnect refunds quota and emits DELTA_AUDIT_GAP cadence.run.cancellation_reconciled (refunded: true).
		llmClient := cadencev1connect.NewCadenceServiceClient(
			h2cHTTP,
			baseURL,
			connect.WithGRPC(),
			connect.WithInterceptors(grpckit.NewClientAuthInterceptor(grpckit.ClientAuthConfig{
				Role: internalauth.RoleGuest, Subject: "sess-llm-cancel", Secret: secret, TTL: time.Minute,
			})),
		)
		llmRunRes, err := llmClient.CreateRun(context.Background(), connect.NewRequest(&cadencev1.CreateRunRequest{
			Prompt:         "Build live LLM telemetry card for disconnect refund test",
			PresetSlug:     "custom",
			Mode:           contracts.CadenceModeLLM,
			DeferExecution: true,
		}))
		if err != nil {
			t.Fatalf("CreateRun llm: %v", err)
		}
		llmRunID := llmRunRes.Msg.GetRun().GetRunId()

		cancelCtx, cancelStream := context.WithCancel(context.Background())
		llmStream, err := llmClient.StreamRun(cancelCtx, connect.NewRequest(&cadencev1.StreamRunRequest{RunId: llmRunID}))
		if err != nil {
			t.Fatalf("StreamRun llm: %v", err)
		}
		// Immediate initial log frame arrives before blocking LLM stage.
		if !llmStream.Receive() || llmStream.Msg().GetLog() == nil {
			t.Fatalf("expected immediate initial log frame before LLM blocks, err=%v", llmStream.Err())
		}
		select {
		case <-llmEntered:
		case <-time.After(2 * time.Second):
			t.Fatal("timed out waiting for LLM stage to start")
		}
		cancelStream()
		_ = llmStream.Close()

		// Wait briefly for detached 5s refund cleanup to commit.
		deadline := time.Now().Add(2 * time.Second)
		for time.Now().Before(deadline) {
			r, _ := store.GetSandboxRun(context.Background(), llmRunID)
			q, _ := store.GetQuotaStatus(context.Background(), contracts.RoleGuest, "sess-llm-cancel")
			if r != nil && r.Status == contracts.CadenceStatusFailed && q.TurnsUsed == 0 {
				break
			}
			time.Sleep(25 * time.Millisecond)
		}
		finalRun, _ := store.GetSandboxRun(context.Background(), llmRunID)
		finalQuota, _ := store.GetQuotaStatus(context.Background(), contracts.RoleGuest, "sess-llm-cancel")
		if finalRun == nil || finalRun.Status != contracts.CadenceStatusFailed || finalQuota.TurnsUsed != 0 {
			t.Fatalf("expected llm cancel failed + refunded quota=0, got run=%+v quota=%+v", finalRun, finalQuota)
		}
		if !strings.Contains(logs.String(), "cadence.run.cancellation_reconciled") {
			t.Fatalf("expected DELTA_AUDIT_GAP cadence.run.cancellation_reconciled log, got:\n%s", logs.String())
		}

		// 3. Post-spec-approval LLM build-phase disconnect marks failed WITHOUT refunding quota (phase="build", refunded=false).
		buildSess := "sess-llm-build-cancel"
		pendingBuildRun, _, allowed, pErr := store.CreatePendingSandboxRunWithQuota(
			context.Background(), contracts.RoleGuest, buildSess, 1, 800,
			pg.PendingSandboxRunInput{
				SessionID:           buildSess,
				IPHash:              unifiedProxyIPHash,
				PresetSlug:          "custom",
				Prompt:              "Build-phase cancellation quota retention test",
				Mode:                contracts.CadenceModeLLM,
				RequireSpecApproval: true,
			},
		)
		if pErr != nil || !allowed {
			t.Fatalf("CreatePendingSandboxRunWithQuota: %v allowed=%v", pErr, allowed)
		}
		if _, ok, cErr := store.ClaimPendingSandboxRun(context.Background(), pendingBuildRun.RunID, buildSess); cErr != nil || !ok {
			t.Fatalf("ClaimPendingSandboxRun: %v ok=%v", cErr, ok)
		}
		if _, pSpecErr := store.PauseSandboxRunForSpecApproval(context.Background(), pg.PauseSpecApprovalInput{
			RunID:         pendingBuildRun.RunID,
			TokensIn:      10,
			TokensOut:     20,
			ExecutionMode: contracts.CadenceExecutionModeLive,
			SpecJSON: &contracts.CadenceSpecArtifact{
				Title: "Build Cancel Spec", Summary: "Spec summary",
				Conditions: []string{"c1"}, Handling: []string{"h1"}, Outcomes: []string{"o1"}, Rules: []string{"r1"}, Deltas: []string{"d1"},
			},
		}); pSpecErr != nil {
			t.Fatalf("PauseSandboxRunForSpecApproval: %v", pSpecErr)
		}
		if _, apErr := store.ApproveSandboxRunSpecForSession(context.Background(), pendingBuildRun.RunID, buildSess); apErr != nil {
			t.Fatalf("ApproveSandboxRunSpecForSession: %v", apErr)
		}

		buildClient := cadencev1connect.NewCadenceServiceClient(
			h2cHTTP, baseURL, connect.WithGRPC(),
			connect.WithInterceptors(grpckit.NewClientAuthInterceptor(grpckit.ClientAuthConfig{
				Role: internalauth.RoleGuest, Subject: buildSess, Secret: secret, TTL: time.Minute,
			})),
		)
		buildCancelCtx, buildCancel := context.WithCancel(context.Background())
		bStream, bErr := buildClient.StreamRun(buildCancelCtx, connect.NewRequest(&cadencev1.StreamRunRequest{RunId: pendingBuildRun.RunID}))
		if bErr != nil {
			t.Fatalf("StreamRun build cancel: %v", bErr)
		}
		if !bStream.Receive() || bStream.Msg().GetLog() == nil {
			t.Fatalf("expected immediate initial log frame on build stream, err=%v", bStream.Err())
		}
		select {
		case <-llmEntered:
		case <-time.After(2 * time.Second):
			t.Fatal("timed out waiting for LLM build stage to enter")
		}
		buildCancel()
		_ = bStream.Close()

		buildDeadline := time.Now().Add(2 * time.Second)
		for time.Now().Before(buildDeadline) {
			r, _ := store.GetSandboxRun(context.Background(), pendingBuildRun.RunID)
			if r != nil && r.Status == contracts.CadenceStatusFailed {
				break
			}
			time.Sleep(25 * time.Millisecond)
		}
		finalBuildRun, _ := store.GetSandboxRun(context.Background(), pendingBuildRun.RunID)
		finalBuildQuota, _ := store.GetQuotaStatus(context.Background(), contracts.RoleGuest, buildSess)
		if finalBuildRun == nil || finalBuildRun.Status != contracts.CadenceStatusFailed || finalBuildQuota.TurnsUsed != 1 {
			t.Fatalf("expected build cancel failed with retained quota=1, got run=%+v quota=%+v", finalBuildRun, finalBuildQuota)
		}
		if !strings.Contains(logs.String(), `"phase":"build"`) || !strings.Contains(logs.String(), `"refunded":false`) {
			t.Fatalf("expected build-phase cancellation_reconciled log with refunded=false, got:\n%s", logs.String())
		}
	})
}

type syncLogBuffer struct {
	mu  sync.Mutex
	buf strings.Builder
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

type blockingStreamLLM struct {
	entered chan struct{}
	release chan struct{}
}

func (b *blockingStreamLLM) Name() string { return "blocking-llm" }
func (b *blockingStreamLLM) Embed(_ context.Context, _ string) ([]float32, error) {
	return nil, nil
}
func (b *blockingStreamLLM) Chat(ctx context.Context, _ []llm.ChatMessage, _ int) (llm.Completion, error) {
	select {
	case b.entered <- struct{}{}:
	default:
	}
	select {
	case <-ctx.Done():
		return llm.Completion{}, ctx.Err()
	case <-b.release:
		return llm.Completion{Text: "done", TokensUsed: 10}, nil
	}
}
func (b *blockingStreamLLM) ChatStream(ctx context.Context, _ llm.ChatStreamRequest, _ func(llm.ChatStreamChunk) error) (llm.ChatStreamResult, error) {
	select {
	case b.entered <- struct{}{}:
	default:
	}
	select {
	case <-ctx.Done():
		return llm.ChatStreamResult{}, ctx.Err()
	case <-b.release:
		return llm.ChatStreamResult{Text: "done", TokensUsed: 10}, nil
	}
}

func TestCadenceStructuredStagesEnableIncludeThoughts(t *testing.T) {
	stub := &streamingStubLLM{
		responses: [][]string{
			{`{"triage":"Feature tier Medium","spec":{"title":"Test Spec","summary":"Summary","conditions":["c1"],"handling":["h1"],"outcomes":["o1"],"rules":["r1"],"deltas":["d1"]}}`},
			{`{"gateChecks":[{"name":"security","status":"pass","detail":"ok"}],"artifactHtml":"<html><body><main><h1>OK</h1></main></body></html>"}`},
		},
	}
	specOut, _, err := invokeLLMSpecStage(context.Background(), stub, nil, "corr-1", "custom", "Build widget", nil, nil)
	if err != nil {
		t.Fatalf("invokeLLMSpecStage failed: %v", err)
	}
	if _, _, err := invokeLLMBuildStage(context.Background(), stub, nil, "corr-1", "custom", "Build widget", &specOut.Spec, nil, nil); err != nil {
		t.Fatalf("invokeLLMBuildStage failed: %v", err)
	}
	if len(stub.reqs) != 2 || !stub.reqs[0].IncludeThoughts || !stub.reqs[1].IncludeThoughts {
		t.Fatalf("expected IncludeThoughts=true for both spec and build stages, got %+v", stub.reqs)
	}
}
