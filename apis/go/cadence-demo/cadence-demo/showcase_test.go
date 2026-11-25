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
	chunks []string
}

func (s *streamingStubLLM) Name() string                                             { return "stub-streaming-llm" }
func (s *streamingStubLLM) Embed(_ context.Context, _ string) ([]float32, error)     { return nil, nil }
func (s *streamingStubLLM) Chat(_ context.Context, _ []llm.ChatMessage, _ int) (llm.Completion, error) {
	return llm.Completion{Text: strings.Join(s.chunks, ""), Model: "stub", TokensUsed: 120}, nil
}
func (s *streamingStubLLM) ChatStream(ctx context.Context, _ llm.ChatStreamRequest, onChunk func(llm.ChatStreamChunk) error) (llm.ChatStreamResult, error) {
	var all strings.Builder
	for _, ch := range s.chunks {
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
			"gateChecks":   []map[string]any{{"id": "c1", "label": "Check", "status": "pass", "detail": "ok"}},
			"artifactHtml": "<!doctype html><html><body><p>Hello</p></body></html>",
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
