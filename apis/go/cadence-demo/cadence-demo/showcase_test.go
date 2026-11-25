package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	cadencev1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/cadence/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
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

	t.Run("gRPC CadenceService.StreamRun enforces grpckit HMAC auth and serves health", func(t *testing.T) {
		lis := bufconn.Listen(1024 * 1024)
		srv, _ := grpckit.NewServer(secret, "cadence.v1.CadenceService")
		cadencev1.RegisterCadenceServiceServer(srv, newCadenceGRPCServer(cadenceServiceDeps{
			store: pg.NewMemoryStore(),
		}))
		go func() { _ = srv.Serve(lis) }()
		t.Cleanup(func() { srv.Stop(); _ = lis.Close() })

		conn, err := grpc.NewClient(
			"passthrough:///bufnet",
			grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) { return lis.DialContext(ctx) }),
			grpc.WithTransportCredentials(insecure.NewCredentials()),
		)
		if err != nil {
			t.Fatalf("dial bufconn: %v", err)
		}
		t.Cleanup(func() { _ = conn.Close() })

		// Health check is public SERVING.
		hc := healthpb.NewHealthClient(conn)
		hRes, err := hc.Check(context.Background(), &healthpb.HealthCheckRequest{Service: "cadence.v1.CadenceService"})
		if err != nil || hRes.GetStatus() != healthpb.HealthCheckResponse_SERVING {
			t.Fatalf("expected SERVING health, got err=%v status=%v", err, hRes.GetStatus())
		}

		// Unauthenticated StreamRun fails with codes.Unauthenticated.
		client := cadencev1.NewCadenceServiceClient(conn)
		unauthStream, err := client.StreamRun(context.Background(), &cadencev1.StreamRunRequest{Prompt: "Test gRPC auth"})
		if err == nil {
			_, err = unauthStream.Recv()
		}
		if status.Code(err) != codes.Unauthenticated {
			t.Fatalf("expected Unauthenticated, got %v", err)
		}

		// Authenticated StreamRun emits phase + done frames.
		authCtx := metadata.AppendToOutgoingContext(context.Background(), "x-internal-auth", sessATok)
		stream, err := client.StreamRun(authCtx, &cadencev1.StreamRunRequest{
			Prompt:     "Build a CHORD gRPC verification workbench",
			PresetSlug: "custom",
		})
		if err != nil {
			t.Fatalf("StreamRun: %v", err)
		}
		var gotDone bool
		for {
			msg, recvErr := stream.Recv()
			if recvErr == io.EOF {
				break
			}
			if recvErr != nil {
				t.Fatalf("StreamRun recv: %v", recvErr)
			}
			if done := msg.GetDone(); done != nil {
				gotDone = true
				if done.GetStatus() != contracts.CadenceStatusReady || done.GetArtifactHtml() == "" {
					t.Fatalf("unexpected done event: %+v", done)
				}
			}
		}
		if !gotDone {
			t.Fatal("expected CadenceDoneEvent from gRPC StreamRun")
		}
	})
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
