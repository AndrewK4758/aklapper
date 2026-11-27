package grpckit

import (
	"context"
	"errors"
	"io"
	"log"
	"net/http"
	"strings"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	ai_askv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/ai_ask/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/gen/ai_ask/v1/ai_askv1connect"
	commonv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/common/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

type testAskHandler struct {
	ai_askv1connect.UnimplementedAskServiceHandler
	called        bool
	returnPermErr bool
}

func (s *testAskHandler) GetTurn(
	ctx context.Context,
	req *connect.Request[ai_askv1.GetTurnRequest],
) (*connect.Response[ai_askv1.GetTurnResponse], error) {
	s.called = true
	claims, ok := ClaimsFromContext(ctx)
	if !ok || claims == nil {
		return nil, connect.NewError(connect.CodeInternal, errors.New("missing claims"))
	}
	if s.returnPermErr {
		return nil, NewDetailedConnectError(
			connect.CodePermissionDenied,
			ToProtoPublicError(&contracts.PublicAppError{
				Code:          contracts.ErrCodeForbidden,
				Status:        http.StatusForbidden,
				Message:       "Permission denied for action.",
				Action:        "Return home or sign in again.",
				CorrelationID: CorrelationIDFromContext(ctx),
			}),
			nil,
		)
	}
	return connect.NewResponse(&ai_askv1.GetTurnResponse{
		AttemptId:     req.Msg.GetAttemptId(),
		Status:        "completed",
		CorrelationId: CorrelationIDFromContext(ctx),
	}), nil
}

func (s *testAskHandler) StreamAsk(
	ctx context.Context,
	req *connect.Request[ai_askv1.StreamAskRequest],
	stream *connect.ServerStream[ai_askv1.AskStreamChunk],
) error {
	s.called = true
	claims, ok := ClaimsFromContext(ctx)
	if !ok || claims == nil {
		return connect.NewError(connect.CodeInternal, errors.New("missing stream claims"))
	}
	if s.returnPermErr {
		return connect.NewError(connect.CodePermissionDenied, errors.New("stream forbidden"))
	}
	return stream.Send(&ai_askv1.AskStreamChunk{
		Payload: &ai_askv1.AskStreamChunk_Meta{
			Meta: &ai_askv1.AskStreamMeta{
				AttemptId:     req.Msg.GetAttemptId(),
				CorrelationId: CorrelationIDFromContext(ctx),
				Mode:          claims.Role,
			},
		},
	})
}

func startTestH2CServer(t *testing.T, mux *http.ServeMux) string {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	readyCh := make(chan string, 1)
	doneCh := make(chan error, 1)
	go func() {
		doneCh <- httpkit.ListenAndServeH2CGraceful(ctx, httpkit.H2CServerConfig{
			Addr:            "127.0.0.1:0",
			Handler:         mux,
			ShutdownTimeout: 2 * time.Second,
			OnReady:         func(addr string) { readyCh <- addr },
		})
	}()
	addr := <-readyCh
	t.Cleanup(func() {
		cancel()
		<-doneCh
	})
	return addr
}

func TestConnectGRPCAuthMiddlewareAndWireInterop(t *testing.T) {
	const secret = "grpc-unit-secret"
	t.Setenv("INTERNAL_AUTH_SECRET", secret)
	var logs strings.Builder
	prevOut := log.Writer()
	log.SetOutput(&logs)
	defer log.SetOutput(prevOut)

	impl := &testAskHandler{}
	mux := http.NewServeMux()
	healthPath, healthHandler := NewHealthHandler("ai_ask.v1.AskService")
	mux.Handle(healthPath, healthHandler)
	askPath, askHandler := ai_askv1connect.NewAskServiceHandler(impl, NewHandlerOptions(secret)...)
	mux.Handle(askPath, NewGRPCOnlyMiddleware(askHandler))

	addr := startTestH2CServer(t, mux)
	baseURL := "http://" + addr
	h2cHTTP := NewH2CClient()
	t.Cleanup(h2cHTTP.CloseIdleConnections)

	t.Run("Health check succeeds without auth via native grpc-go client", func(t *testing.T) {
		conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			t.Fatalf("grpc.NewClient: %v", err)
		}
		defer conn.Close()

		hc := healthpb.NewHealthClient(conn)
		for _, svc := range []string{"", "ai_ask.v1.AskService"} {
			res, err := hc.Check(context.Background(), &healthpb.HealthCheckRequest{Service: svc})
			if err != nil || res.GetStatus() != healthpb.HealthCheckResponse_SERVING {
				t.Fatalf("expected SERVING for %q without auth, got res=%v err=%v", svc, res, err)
			}
		}
	})

	t.Run("Health Watch fails closed with Unauthenticated without HMAC and Unimplemented with valid HMAC", func(t *testing.T) {
		conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			t.Fatalf("grpc.NewClient: %v", err)
		}
		defer conn.Close()

		hc := healthpb.NewHealthClient(conn)

		// 1. Unauthenticated /grpc.health.v1.Health/Watch must be rejected with Unauthenticated.
		unauthCtx, unauthCancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer unauthCancel()
		unauthStream, watchErr := hc.Watch(unauthCtx, &healthpb.HealthCheckRequest{Service: ""})
		if watchErr == nil {
			_, watchErr = unauthStream.Recv()
		}
		if status.Code(watchErr) != codes.Unauthenticated {
			t.Fatalf("expected Unauthenticated on unauthenticated Health/Watch, got code=%v err=%v", status.Code(watchErr), watchErr)
		}

		// 2. Authenticated /grpc.health.v1.Health/Watch must fail closed with Unimplemented.
		tok, signErr := internalauth.Sign(internalauth.RoleService, "health-watch-probe", time.Minute, secret)
		if signErr != nil {
			t.Fatalf("internalauth.Sign: %v", signErr)
		}
		authCtx, authCancel := context.WithTimeout(
			metadata.AppendToOutgoingContext(context.Background(), MetadataInternalAuth, tok),
			2*time.Second,
		)
		defer authCancel()
		authStream, authWatchErr := hc.Watch(authCtx, &healthpb.HealthCheckRequest{Service: "ai_ask.v1.AskService"})
		if authWatchErr == nil {
			_, authWatchErr = authStream.Recv()
		}
		if status.Code(authWatchErr) != codes.Unimplemented {
			t.Fatalf("expected Unimplemented on authenticated Health/Watch, got code=%v err=%v", status.Code(authWatchErr), authWatchErr)
		}

		// 3. /grpc.health.v1.Health/Check without auth still returns SERVING.
		checkRes, checkErr := hc.Check(context.Background(), &healthpb.HealthCheckRequest{Service: "ai_ask.v1.AskService"})
		if checkErr != nil || checkRes.GetStatus() != healthpb.HealthCheckResponse_SERVING {
			t.Fatalf("expected SERVING on Health/Check after Watch checks, got res=%v err=%v", checkRes, checkErr)
		}
	})

	t.Run("Strict gRPC-only middleware rejects non-POST with 405 and disallowed media types with 415", func(t *testing.T) {
		rpcURL := baseURL + ai_askv1connect.AskServiceGetTurnProcedure
		getRes, err := http.Get(rpcURL)
		if err != nil {
			t.Fatalf("GET rpc: %v", err)
		}
		_, _ = io.Copy(io.Discard, getRes.Body)
		_ = getRes.Body.Close()
		if getRes.StatusCode != http.StatusMethodNotAllowed || getRes.Header.Get("Allow") != http.MethodPost {
			t.Fatalf("expected 405 + Allow: POST on GET, got status=%d allow=%q", getRes.StatusCode, getRes.Header.Get("Allow"))
		}

		disallowed := []string{
			"",
			"application/json",
			"application/connect+json",
			"application/connect+proto",
			"application/grpc-web",
			"application/grpc-web+proto",
			"application/grpc-web-text",
			"application/grpc+json",
		}
		for _, ct := range disallowed {
			impl.called = false
			req, _ := http.NewRequest(http.MethodPost, rpcURL, strings.NewReader("{}"))
			if ct != "" {
				req.Header.Set("Content-Type", ct)
			}
			res, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatalf("POST %q: %v", ct, err)
			}
			_, _ = io.Copy(io.Discard, res.Body)
			_ = res.Body.Close()
			if res.StatusCode != http.StatusUnsupportedMediaType || impl.called {
				t.Fatalf("Content-Type %q: expected 415 without handler invocation, got status=%d called=%v", ct, res.StatusCode, impl.called)
			}
		}
		if !strings.Contains(logs.String(), "grpc.protocol.unsupported_media_type") {
			t.Fatalf("expected UNSOUND_CONDITION grpc.protocol.unsupported_media_type log, got %s", logs.String())
		}
	})

	t.Run("Authenticated unary and streaming RPCs propagate claims and echo x-correlation-id", func(t *testing.T) {
		cfg := ClientAuthConfig{Role: internalauth.RoleGuest, Subject: "guest-1", Secret: secret, TTL: time.Minute}
		client := ai_askv1connect.NewAskServiceClient(
			h2cHTTP,
			baseURL,
			connect.WithGRPC(),
			connect.WithInterceptors(NewClientAuthInterceptor(cfg)),
		)

		req := connect.NewRequest(&ai_askv1.GetTurnRequest{AttemptId: "att-1"})
		req.Header().Set(MetadataCorrelationID, "corr-grpc-01")
		resp, err := client.GetTurn(context.Background(), req)
		if err != nil {
			t.Fatalf("GetTurn failed: %v", err)
		}
		if resp.Msg.GetCorrelationId() != "corr-grpc-01" {
			t.Fatalf("expected corr-grpc-01 in body, got %q", resp.Msg.GetCorrelationId())
		}
		if got := resp.Header().Get(MetadataCorrelationID); got != "corr-grpc-01" {
			t.Fatalf("expected response header x-correlation-id=corr-grpc-01, got %q", got)
		}

		sReq := connect.NewRequest(&ai_askv1.StreamAskRequest{AttemptId: "att-2", Question: "hello"})
		sReq.Header().Set(MetadataCorrelationID, "corr-grpc-02")
		stream, err := client.StreamAsk(context.Background(), sReq)
		if err != nil {
			t.Fatalf("StreamAsk failed: %v", err)
		}
		defer stream.Close()
		if !stream.Receive() {
			t.Fatalf("expected stream chunk, err=%v", stream.Err())
		}
		meta := stream.Msg().GetMeta()
		if meta == nil || meta.GetCorrelationId() != "corr-grpc-02" || meta.GetMode() != "guest" {
			t.Fatalf("unexpected stream meta: %+v", meta)
		}
		if got := stream.ResponseHeader().Get(MetadataCorrelationID); got != "corr-grpc-02" {
			t.Fatalf("expected stream response header x-correlation-id=corr-grpc-02, got %q", got)
		}
	})

	t.Run("Auth failures and handler errors both echo x-correlation-id and attach ErrorDetailEnvelope", func(t *testing.T) {
		rawClient := ai_askv1connect.NewAskServiceClient(h2cHTTP, baseURL, connect.WithGRPC())
		validTok, _ := internalauth.Sign(internalauth.RoleGuest, "g-1", time.Minute, secret)
		expiredTok, _ := internalauth.SignWithClock(internalauth.RoleGuest, "g-1", time.Now().Add(-5*time.Minute), time.Minute, secret)

		cases := []struct {
			name string
			vals []string
		}{
			{"missing", nil},
			{"duplicate", []string{validTok, validTok}},
			{"expired", []string{expiredTok}},
			{"forged", []string{validTok + "tamper"}},
		}
		for _, tc := range cases {
			impl.called = false
			req := connect.NewRequest(&ai_askv1.GetTurnRequest{AttemptId: "att-x"})
			req.Header().Set(MetadataCorrelationID, "corr-auth-"+tc.name)
			for _, v := range tc.vals {
				req.Header().Add(MetadataInternalAuth, v)
			}
			_, err := rawClient.GetTurn(context.Background(), req)
			var cErr *connect.Error
			if !errors.As(err, &cErr) || cErr.Code() != connect.CodeUnauthenticated || impl.called {
				t.Fatalf("case %s unary: expected CodeUnauthenticated without handler call, got err=%v called=%v", tc.name, err, impl.called)
			}
			if got := cErr.Meta().Get(MetadataCorrelationID); got != "corr-auth-"+tc.name {
				t.Fatalf("case %s unary: expected echoed correlation ID in error meta, got %q", tc.name, got)
			}

			impl.called = false
			sReq := connect.NewRequest(&ai_askv1.StreamAskRequest{AttemptId: "att-y"})
			sReq.Header().Set(MetadataCorrelationID, "corr-sauth-"+tc.name)
			for _, v := range tc.vals {
				sReq.Header().Add(MetadataInternalAuth, v)
			}
			st, sErr := rawClient.StreamAsk(context.Background(), sReq)
			if sErr == nil {
				st.Receive()
				sErr = st.Err()
				_ = st.Close()
			}
			var sCErr *connect.Error
			if !errors.As(sErr, &sCErr) || sCErr.Code() != connect.CodeUnauthenticated || impl.called {
				t.Fatalf("case %s stream: expected CodeUnauthenticated without handler call, got err=%v called=%v", tc.name, sErr, impl.called)
			}
			if got := sCErr.Meta().Get(MetadataCorrelationID); got != "corr-sauth-"+tc.name {
				t.Fatalf("case %s stream: expected echoed correlation ID in error meta, got %q", tc.name, got)
			}
		}

		// Handler-returned PermissionDenied also echoes x-correlation-id and decodes ErrorDetailEnvelope.
		impl.returnPermErr = true
		defer func() { impl.returnPermErr = false }()
		authClient := ai_askv1connect.NewAskServiceClient(
			h2cHTTP,
			baseURL,
			connect.WithGRPC(),
			connect.WithInterceptors(NewClientAuthInterceptor(ClientAuthConfig{
				Role: internalauth.RoleGuest, Subject: "g-perm", Secret: secret, TTL: time.Minute,
			})),
		)

		permReq := connect.NewRequest(&ai_askv1.GetTurnRequest{AttemptId: "att-perm"})
		permReq.Header().Set(MetadataCorrelationID, "corr-perm-unary")
		_, err := authClient.GetTurn(context.Background(), permReq)
		var permErr *connect.Error
		if !errors.As(err, &permErr) || permErr.Code() != connect.CodePermissionDenied {
			t.Fatalf("expected CodePermissionDenied, got %v", err)
		}
		if got := permErr.Meta().Get(MetadataCorrelationID); got != "corr-perm-unary" {
			t.Fatalf("expected echoed correlation ID on handler error meta, got %q", got)
		}
		if len(permErr.Details()) != 1 {
			t.Fatalf("expected 1 ErrorDetailEnvelope detail, got %d", len(permErr.Details()))
		}
		val, valErr := permErr.Details()[0].Value()
		env, ok := val.(*commonv1.ErrorDetailEnvelope)
		if valErr != nil || !ok || env.GetError().GetCode() != contracts.ErrCodeForbidden {
			t.Fatalf("expected decoded common.v1.ErrorDetailEnvelope ERR_FORBIDDEN, got %+v err=%v", val, valErr)
		}

		sPermReq := connect.NewRequest(&ai_askv1.StreamAskRequest{AttemptId: "att-sperm"})
		sPermReq.Header().Set(MetadataCorrelationID, "corr-perm-stream")
		sPerm, sPermErr := authClient.StreamAsk(context.Background(), sPermReq)
		if sPermErr == nil {
			sPerm.Receive()
			sPermErr = sPerm.Err()
			_ = sPerm.Close()
		}
		var sPermCErr *connect.Error
		if !errors.As(sPermErr, &sPermCErr) || sPermCErr.Code() != connect.CodePermissionDenied {
			t.Fatalf("expected stream CodePermissionDenied, got %v", sPermErr)
		}
		if got := sPermCErr.Meta().Get(MetadataCorrelationID); got != "corr-perm-stream" {
			t.Fatalf("expected echoed correlation ID on stream handler error meta, got %q", got)
		}
	})

	t.Run("Malformed x-correlation-id is replaced with UUIDv4 and emits UNSOUND_CONDITION", func(t *testing.T) {
		rawClient := ai_askv1connect.NewAskServiceClient(h2cHTTP, baseURL, connect.WithGRPC())
		tok, _ := internalauth.Sign(internalauth.RoleGuest, "g-corr", time.Minute, secret)
		req := connect.NewRequest(&ai_askv1.GetTurnRequest{AttemptId: "att-corr"})
		req.Header().Set(MetadataInternalAuth, tok)
		req.Header().Set(MetadataCorrelationID, "bad header with spaces!!")

		resp, err := rawClient.GetTurn(context.Background(), req)
		if err != nil {
			t.Fatalf("GetTurn failed: %v", err)
		}
		if resp.Msg.GetCorrelationId() == "bad header with spaces!!" || !contracts.ValidateUUID(resp.Msg.GetCorrelationId()) {
			t.Fatalf("expected fresh UUIDv4 correlation ID, got %q", resp.Msg.GetCorrelationId())
		}
		logOut := logs.String()
		if !strings.Contains(logOut, "grpc.auth.rejected") || !strings.Contains(logOut, "grpc.correlation.invalid_header") {
			t.Fatalf("expected grpc.auth.rejected and grpc.correlation.invalid_header logs, got %s", logOut)
		}
	})
}

func TestExtractSignedClientIPAndErrorDetails(t *testing.T) {
	const secret = "client-ip-test-secret"
	var logs strings.Builder
	prevOut := log.Writer()
	log.SetOutput(&logs)
	defer log.SetOutput(prevOut)

	validIPv4Tok, err := internalauth.Sign(internalauth.RoleService, "client-ip:198.51.100.42", time.Minute, secret)
	if err != nil {
		t.Fatalf("sign ipv4: %v", err)
	}
	validIPv6Tok, err := internalauth.Sign(internalauth.RoleService, "client-ip:2001:db8::42", time.Minute, secret)
	if err != nil {
		t.Fatalf("sign ipv6: %v", err)
	}
	expiredTok, _ := internalauth.SignWithClock(internalauth.RoleService, "client-ip:198.51.100.99", time.Now().Add(-5*time.Minute), time.Minute, secret)
	wrongRoleTok, _ := internalauth.Sign(internalauth.RoleGuest, "client-ip:198.51.100.42", time.Minute, secret)
	wrongPrefixTok, _ := internalauth.Sign(internalauth.RoleService, "portal-ssr", time.Minute, secret)
	badIPTok, _ := internalauth.Sign(internalauth.RoleService, "client-ip:not-an-ip", time.Minute, secret)

	hdrOK := http.Header{}
	hdrOK.Set(MetadataInternalClientIP, validIPv4Tok)
	ip, err := ExtractSignedClientIP(hdrOK, secret)
	if err != nil || ip != "198.51.100.42" {
		t.Fatalf("expected 198.51.100.42, got ip=%q err=%v", ip, err)
	}

	hdrV6 := http.Header{}
	hdrV6.Set(MetadataInternalClientIP, validIPv6Tok)
	ipv6, err := ExtractSignedClientIP(hdrV6, secret)
	if err != nil || ipv6 != "2001:db8::42" {
		t.Fatalf("expected 2001:db8::42, got ip=%q err=%v", ipv6, err)
	}

	rejectCases := []struct {
		name string
		vals []string
	}{
		{"missing", nil},
		{"duplicate", []string{validIPv4Tok, validIPv4Tok}},
		{"expired", []string{expiredTok}},
		{"forged", []string{validIPv4Tok + "tamper"}},
		{"wrong_role", []string{wrongRoleTok}},
		{"wrong_prefix", []string{wrongPrefixTok}},
		{"invalid_ip", []string{badIPTok}},
	}
	for _, tc := range rejectCases {
		h := http.Header{}
		for _, v := range tc.vals {
			h.Add(MetadataInternalClientIP, v)
		}
		_, rejErr := ExtractSignedClientIP(h, secret)
		var cErr *connect.Error
		if !errors.As(rejErr, &cErr) || cErr.Code() != connect.CodeUnauthenticated {
			t.Fatalf("case %s: expected CodeUnauthenticated, got %v", tc.name, rejErr)
		}
	}

	logText := logs.String()
	if !strings.Contains(logText, "portal_api.client_ip.untrusted") {
		t.Fatalf("expected UNSOUND_CONDITION portal_api.client_ip.untrusted log, got %s", logText)
	}
	if strings.Contains(logText, "198.51.100.42") || strings.Contains(logText, "198.51.100.99") || strings.Contains(logText, validIPv4Tok) {
		t.Fatalf("client IP or signed token leaked into logs: %s", logText)
	}

	retryAfter := int32(45)
	detailed := NewDetailedConnectErrorWithRetryAfter(
		connect.CodeFailedPrecondition,
		ToProtoPublicError(&contracts.PublicAppError{
			Code:          contracts.ErrCodeConstraint,
			Status:        http.StatusUnprocessableEntity,
			Message:       "Data failed storage validation.",
			Action:        "Check highlighted fields and retry.",
			CorrelationID: "corr-detail-01",
			FieldErrors:   map[string][]string{"message": {"Message too short."}},
		}),
		nil,
		&retryAfter,
	)
	if len(detailed.Details()) != 1 {
		t.Fatalf("expected 1 detail envelope, got %d", len(detailed.Details()))
	}
	rawVal, err := detailed.Details()[0].Value()
	if err != nil {
		t.Fatalf("decode detail: %v", err)
	}
	env, ok := rawVal.(*commonv1.ErrorDetailEnvelope)
	if !ok || env.GetRetryAfterSeconds() != 45 {
		t.Fatalf("expected retry_after_seconds=45, got %+v", rawVal)
	}
	msgs := env.GetError().GetFieldErrors()["message"].GetMessages()
	if len(msgs) != 1 || msgs[0] != "Message too short." {
		t.Fatalf("expected mapped field_errors, got %+v", env.GetError().GetFieldErrors())
	}
}
