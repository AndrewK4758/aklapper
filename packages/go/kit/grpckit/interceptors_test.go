package grpckit

import (
	"context"
	"log"
	"net"
	"strings"
	"testing"
	"time"

	ai_askv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/ai_ask/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
)

type testAskServer struct {
	ai_askv1.UnimplementedAskServiceServer
	called bool
}

func (s *testAskServer) GetTurn(ctx context.Context, req *ai_askv1.GetTurnRequest) (*ai_askv1.GetTurnResponse, error) {
	s.called = true
	claims, ok := ClaimsFromContext(ctx)
	if !ok || claims == nil {
		return nil, status.Error(codes.Internal, "missing claims")
	}
	return &ai_askv1.GetTurnResponse{
		AttemptId:     req.GetAttemptId(),
		Status:        "completed",
		CorrelationId: CorrelationIDFromContext(ctx),
	}, nil
}

func (s *testAskServer) StreamAsk(req *ai_askv1.StreamAskRequest, stream grpc.ServerStreamingServer[ai_askv1.AskStreamChunk]) error {
	s.called = true
	claims, ok := ClaimsFromContext(stream.Context())
	if !ok || claims == nil {
		return status.Error(codes.Internal, "missing stream claims")
	}
	return stream.Send(&ai_askv1.AskStreamChunk{
		Payload: &ai_askv1.AskStreamChunk_Meta{
			Meta: &ai_askv1.AskStreamMeta{
				AttemptId:     req.GetAttemptId(),
				CorrelationId: CorrelationIDFromContext(stream.Context()),
				Mode:          claims.Role,
			},
		},
	})
}

func TestGRPCAuthAndCorrelationInterceptors(t *testing.T) {
	const secret = "grpc-unit-secret"
	var logs strings.Builder
	prevOut := log.Writer()
	log.SetOutput(&logs)
	defer log.SetOutput(prevOut)

	lis := bufconn.Listen(1024 * 1024)
	srv, _ := NewServer(secret, "ai_ask.v1.AskService")
	impl := &testAskServer{}
	ai_askv1.RegisterAskServiceServer(srv, impl)
	go func() { _ = srv.Serve(lis) }()
	t.Cleanup(srv.Stop)

	dial := func(opts ...grpc.DialOption) *grpc.ClientConn {
		base := []grpc.DialOption{
			grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) { return lis.Dial() }),
			grpc.WithTransportCredentials(insecure.NewCredentials()),
		}
		conn, err := grpc.NewClient("passthrough:///bufnet", append(base, opts...)...)
		if err != nil {
			t.Fatalf("grpc.NewClient: %v", err)
		}
		t.Cleanup(func() { _ = conn.Close() })
		return conn
	}

	t.Run("Health check succeeds without auth", func(t *testing.T) {
		conn := dial()
		hc := healthpb.NewHealthClient(conn)
		res, err := hc.Check(context.Background(), &healthpb.HealthCheckRequest{Service: "ai_ask.v1.AskService"})
		if err != nil || res.GetStatus() != healthpb.HealthCheckResponse_SERVING {
			t.Fatalf("expected SERVING without auth, got res=%v err=%v", res, err)
		}
	})

	t.Run("Authenticated client interceptors propagate claims and correlation ID", func(t *testing.T) {
		cfg := ClientAuthConfig{Role: internalauth.RoleGuest, Subject: "guest-1", Secret: secret, TTL: time.Minute}
		conn := dial(
			grpc.WithUnaryInterceptor(UnaryClientAuthInterceptor(cfg)),
			grpc.WithStreamInterceptor(StreamClientAuthInterceptor(cfg)),
		)
		client := ai_askv1.NewAskServiceClient(conn)

		ctx := metadata.NewOutgoingContext(context.Background(), metadata.Pairs(MetadataCorrelationID, "corr-grpc-01"))
		var header metadata.MD
		resp, err := client.GetTurn(ctx, &ai_askv1.GetTurnRequest{AttemptId: "att-1"}, grpc.Header(&header))
		if err != nil {
			t.Fatalf("GetTurn failed: %v", err)
		}
		if resp.GetCorrelationId() != "corr-grpc-01" {
			t.Fatalf("expected corr-grpc-01, got %q", resp.GetCorrelationId())
		}
		if got := header.Get(MetadataCorrelationID); len(got) != 1 || got[0] != "corr-grpc-01" {
			t.Fatalf("expected response header x-correlation-id=corr-grpc-01, got %#v", got)
		}

		stream, err := client.StreamAsk(ctx, &ai_askv1.StreamAskRequest{AttemptId: "att-2", Question: "hello"})
		if err != nil {
			t.Fatalf("StreamAsk failed: %v", err)
		}
		chunk, err := stream.Recv()
		if err != nil || chunk.GetMeta().GetCorrelationId() != "corr-grpc-01" || chunk.GetMeta().GetMode() != "guest" {
			t.Fatalf("unexpected stream chunk: %+v err=%v", chunk, err)
		}
	})

	t.Run("Missing, duplicate, expired, and forged x-internal-auth fail closed with Unauthenticated", func(t *testing.T) {
		conn := dial()
		client := ai_askv1.NewAskServiceClient(conn)
		validTok, _ := internalauth.Sign(internalauth.RoleGuest, "g-1", time.Minute, secret)
		expiredTok, _ := internalauth.SignWithClock(internalauth.RoleGuest, "g-1", time.Now().Add(-5*time.Minute), time.Minute, secret)

		cases := []struct {
			name string
			md   metadata.MD
		}{
			{"missing", metadata.New(nil)},
			{"duplicate", metadata.Pairs(MetadataInternalAuth, validTok, MetadataInternalAuth, validTok)},
			{"expired", metadata.Pairs(MetadataInternalAuth, expiredTok)},
			{"forged", metadata.Pairs(MetadataInternalAuth, validTok+"tamper")},
		}
		for _, tc := range cases {
			impl.called = false
			ctx := metadata.NewOutgoingContext(context.Background(), tc.md)
			_, err := client.GetTurn(ctx, &ai_askv1.GetTurnRequest{AttemptId: "att-x"})
			if status.Code(err) != codes.Unauthenticated || impl.called {
				t.Fatalf("case %s unary: expected Unauthenticated without handler call, got err=%v called=%v", tc.name, err, impl.called)
			}

			impl.called = false
			st, sErr := client.StreamAsk(ctx, &ai_askv1.StreamAskRequest{AttemptId: "att-y"})
			if sErr == nil {
				_, sErr = st.Recv()
			}
			if status.Code(sErr) != codes.Unauthenticated || impl.called {
				t.Fatalf("case %s stream: expected Unauthenticated without handler call, got err=%v called=%v", tc.name, sErr, impl.called)
			}
		}
	})

	t.Run("Malformed x-correlation-id is replaced with UUIDv4 and emits UNSOUND_CONDITION", func(t *testing.T) {
		conn := dial()
		client := ai_askv1.NewAskServiceClient(conn)
		tok, _ := internalauth.Sign(internalauth.RoleGuest, "g-corr", time.Minute, secret)
		ctx := metadata.NewOutgoingContext(context.Background(), metadata.Pairs(
			MetadataInternalAuth, tok,
			MetadataCorrelationID, "bad header with spaces!!",
		))
		resp, err := client.GetTurn(ctx, &ai_askv1.GetTurnRequest{AttemptId: "att-corr"})
		if err != nil {
			t.Fatalf("GetTurn failed: %v", err)
		}
		if resp.GetCorrelationId() == "bad header with spaces!!" || len(resp.GetCorrelationId()) != 36 {
			t.Fatalf("expected fresh UUIDv4 correlation ID, got %q", resp.GetCorrelationId())
		}
		logOut := logs.String()
		if !strings.Contains(logOut, "grpc.auth.rejected") || !strings.Contains(logOut, "grpc.correlation.invalid_header") {
			t.Fatalf("expected grpc.auth.rejected and grpc.correlation.invalid_header logs, got %s", logOut)
		}
	})

	t.Run("GRPCListenAddr returns empty when GRPC_PORT is unset", func(t *testing.T) {
		t.Setenv("GRPC_PORT", "")
		if got := GRPCListenAddr(); got != "" {
			t.Fatalf("expected empty listen addr when GRPC_PORT is empty, got %q", got)
		}
		t.Setenv("GRPC_PORT", "9090")
		if got := GRPCListenAddr(); got != ":9090" {
			t.Fatalf("expected :9090, got %q", got)
		}
	})
}
