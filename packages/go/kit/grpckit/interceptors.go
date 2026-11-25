package grpckit

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

const (
	MetadataInternalAuth  = "x-internal-auth"
	MetadataCorrelationID = "x-correlation-id"
	HealthMethodPrefix    = "/grpc.health.v1.Health/"
	defaultClientTokenTTL = 60 * time.Second
)

var correlationIDPattern = regexp.MustCompile(`^[A-Za-z0-9._:-]{1,128}$`)

type contextKey int

const (
	claimsContextKey contextKey = iota + 1
	correlationIDContextKey
)

// ClientAuthConfig configures outgoing client-side HMAC internal auth injection.
type ClientAuthConfig struct {
	Role    string
	Subject string
	Secret  string
	TTL     time.Duration
}

// ClaimsFromContext extracts verified *internalauth.Claims attached by grpckit server interceptors.
func ClaimsFromContext(ctx context.Context) (*internalauth.Claims, bool) {
	if ctx == nil {
		return nil, false
	}
	claims, ok := ctx.Value(claimsContextKey).(*internalauth.Claims)
	return claims, ok && claims != nil
}

// CorrelationIDFromContext extracts the validated correlation ID attached by grpckit interceptors.
func CorrelationIDFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	corrID, _ := ctx.Value(correlationIDContextKey).(string)
	return corrID
}

type wrappedServerStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (w *wrappedServerStream) Context() context.Context {
	return w.ctx
}

func newUUIDv4() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func logGRPCSeam(seamType, event string, fields map[string]any) {
	payload := make(map[string]any, len(fields)+2)
	for k, v := range fields {
		payload[k] = v
	}
	payload["seam_type"] = seamType
	payload["event"] = event
	if raw, err := json.Marshal(payload); err == nil {
		log.Println(string(raw))
	}
}

func sanitizeCorrelationID(md metadata.MD, method string) string {
	vals := md.Get(MetadataCorrelationID)
	if len(vals) == 0 {
		return newUUIDv4()
	}
	candidate := strings.TrimSpace(vals[0])
	if len(vals) == 1 && correlationIDPattern.MatchString(candidate) {
		return candidate
	}
	fresh := newUUIDv4()
	logGRPCSeam("UNSOUND_CONDITION", "grpc.correlation.invalid_header", map[string]any{
		"method":        method,
		"correlationId": fresh,
	})
	return fresh
}

func authorizeAndAttachContext(ctx context.Context, fullMethod, explicitSecret string) (context.Context, error) {
	md, _ := metadata.FromIncomingContext(ctx)
	corrID := sanitizeCorrelationID(md, fullMethod)
	_ = grpc.SetHeader(ctx, metadata.Pairs(MetadataCorrelationID, corrID))
	ctx = context.WithValue(ctx, correlationIDContextKey, corrID)

	// Strict unauthenticated allow-list: health service only.
	if strings.HasPrefix(fullMethod, HealthMethodPrefix) {
		return ctx, nil
	}

	authVals := md.Get(MetadataInternalAuth)
	if len(authVals) != 1 {
		logGRPCSeam("UNSOUND_CONDITION", "grpc.auth.rejected", map[string]any{
			"method":        fullMethod,
			"reason":        "missing_or_duplicate_header",
			"headerCount":   len(authVals),
			"correlationId": corrID,
		})
		return nil, status.Error(codes.Unauthenticated, "signed x-internal-auth metadata required")
	}

	claims, err := internalauth.Verify(authVals[0], explicitSecret)
	if err != nil || claims == nil {
		logGRPCSeam("UNSOUND_CONDITION", "grpc.auth.rejected", map[string]any{
			"method":        fullMethod,
			"reason":        "invalid_or_expired_token",
			"correlationId": corrID,
		})
		return nil, status.Error(codes.Unauthenticated, "invalid internal auth token")
	}

	return context.WithValue(ctx, claimsContextKey, claims), nil
}

// UnaryServerAuthInterceptor enforces default-deny HMAC auth and correlation hygiene for unary RPCs.
func UnaryServerAuthInterceptor(explicitSecret string) grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req any,
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (any, error) {
		authedCtx, err := authorizeAndAttachContext(ctx, info.FullMethod, explicitSecret)
		if err != nil {
			return nil, err
		}
		return handler(authedCtx, req)
	}
}

// StreamServerAuthInterceptor enforces default-deny HMAC auth and correlation hygiene for streaming RPCs.
func StreamServerAuthInterceptor(explicitSecret string) grpc.StreamServerInterceptor {
	return func(
		srv any,
		ss grpc.ServerStream,
		info *grpc.StreamServerInfo,
		handler grpc.StreamHandler,
	) error {
		authedCtx, err := authorizeAndAttachContext(ss.Context(), info.FullMethod, explicitSecret)
		if err != nil {
			return err
		}
		return handler(srv, &wrappedServerStream{ServerStream: ss, ctx: authedCtx})
	}
}

func attachOutgoingAuth(ctx context.Context, cfg ClientAuthConfig) (context.Context, error) {
	ttl := cfg.TTL
	if ttl <= 0 {
		ttl = defaultClientTokenTTL
	}
	token, err := internalauth.Sign(cfg.Role, cfg.Subject, ttl, cfg.Secret)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "sign internal auth metadata: %v", err)
	}

	md, ok := metadata.FromOutgoingContext(ctx)
	if ok {
		md = md.Copy()
	} else {
		md = metadata.New(nil)
	}
	md.Set(MetadataInternalAuth, token)

	corrVals := md.Get(MetadataCorrelationID)
	if len(corrVals) != 1 || !correlationIDPattern.MatchString(strings.TrimSpace(corrVals[0])) {
		md.Set(MetadataCorrelationID, newUUIDv4())
	}
	return metadata.NewOutgoingContext(ctx, md), nil
}

// UnaryClientAuthInterceptor signs x-internal-auth and propagates x-correlation-id on unary calls.
func UnaryClientAuthInterceptor(cfg ClientAuthConfig) grpc.UnaryClientInterceptor {
	return func(
		ctx context.Context,
		method string,
		req, reply any,
		cc *grpc.ClientConn,
		invoker grpc.UnaryInvoker,
		opts ...grpc.CallOption,
	) error {
		outCtx, err := attachOutgoingAuth(ctx, cfg)
		if err != nil {
			return err
		}
		return invoker(outCtx, method, req, reply, cc, opts...)
	}
}

// StreamClientAuthInterceptor signs x-internal-auth and propagates x-correlation-id on streaming calls.
func StreamClientAuthInterceptor(cfg ClientAuthConfig) grpc.StreamClientInterceptor {
	return func(
		ctx context.Context,
		desc *grpc.StreamDesc,
		cc *grpc.ClientConn,
		method string,
		streamer grpc.Streamer,
		opts ...grpc.CallOption,
	) (grpc.ClientStream, error) {
		outCtx, err := attachOutgoingAuth(ctx, cfg)
		if err != nil {
			return nil, err
		}
		return streamer(outCtx, desc, cc, method, opts...)
	}
}
