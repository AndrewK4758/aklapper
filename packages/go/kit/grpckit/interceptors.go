package grpckit

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
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

func sanitizeCorrelationID(vals []string, procedure string) string {
	if len(vals) == 0 {
		return contracts.NewUUIDv4()
	}
	candidate := strings.TrimSpace(vals[0])
	if len(vals) == 1 && correlationIDPattern.MatchString(candidate) {
		return candidate
	}
	fresh := contracts.NewUUIDv4()
	logGRPCSeam("UNSOUND_CONDITION", "grpc.correlation.invalid_header", map[string]any{
		"method":        procedure,
		"correlationId": fresh,
	})
	return fresh
}

func ensureConnectErrorWithCorrelation(err error, corrID string) error {
	if err == nil {
		return nil
	}
	var connectErr *connect.Error
	if !errors.As(err, &connectErr) {
		connectErr = connect.NewError(connect.CodeInternal, err)
	}
	connectErr.Meta().Set(MetadataCorrelationID, corrID)
	return connectErr
}

type serverAuthInterceptor struct {
	explicitSecret string
}

// NewServerAuthInterceptor enforces default-deny HMAC auth and x-correlation-id echo
// across both unary and streaming ConnectRPC procedures, allow-listing only /grpc.health.v1.Health/.
func NewServerAuthInterceptor(explicitSecret string) connect.Interceptor {
	return &serverAuthInterceptor{explicitSecret: explicitSecret}
}

func (i *serverAuthInterceptor) authenticate(
	ctx context.Context,
	procedure string,
	authVals []string,
	corrID string,
) (context.Context, error) {
	ctx = context.WithValue(ctx, correlationIDContextKey, corrID)
	if strings.HasPrefix(procedure, HealthMethodPrefix) {
		return ctx, nil
	}

	if len(authVals) != 1 {
		logGRPCSeam("UNSOUND_CONDITION", "grpc.auth.rejected", map[string]any{
			"method":        procedure,
			"reason":        "missing_or_duplicate_header",
			"headerCount":   len(authVals),
			"correlationId": corrID,
		})
		return nil, ensureConnectErrorWithCorrelation(
			connect.NewError(connect.CodeUnauthenticated, errors.New("signed x-internal-auth metadata required")),
			corrID,
		)
	}

	claims, err := internalauth.Verify(authVals[0], i.explicitSecret)
	if err != nil || claims == nil {
		logGRPCSeam("UNSOUND_CONDITION", "grpc.auth.rejected", map[string]any{
			"method":        procedure,
			"reason":        "invalid_or_expired_token",
			"correlationId": corrID,
		})
		return nil, ensureConnectErrorWithCorrelation(
			connect.NewError(connect.CodeUnauthenticated, errors.New("invalid internal auth token")),
			corrID,
		)
	}

	return context.WithValue(ctx, claimsContextKey, claims), nil
}

func (i *serverAuthInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		procedure := req.Spec().Procedure
		corrID := sanitizeCorrelationID(req.Header().Values(MetadataCorrelationID), procedure)

		authedCtx, authErr := i.authenticate(ctx, procedure, req.Header().Values(MetadataInternalAuth), corrID)
		if authErr != nil {
			return nil, authErr
		}

		res, err := next(authedCtx, req)
		if err != nil {
			return nil, ensureConnectErrorWithCorrelation(err, corrID)
		}
		if res != nil {
			res.Header().Set(MetadataCorrelationID, corrID)
		}
		return res, nil
	}
}

func (i *serverAuthInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return next
}

func (i *serverAuthInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return func(ctx context.Context, conn connect.StreamingHandlerConn) error {
		procedure := conn.Spec().Procedure
		corrID := sanitizeCorrelationID(conn.RequestHeader().Values(MetadataCorrelationID), procedure)
		conn.ResponseHeader().Set(MetadataCorrelationID, corrID)

		authedCtx, authErr := i.authenticate(ctx, procedure, conn.RequestHeader().Values(MetadataInternalAuth), corrID)
		if authErr != nil {
			return authErr
		}

		if err := next(authedCtx, conn); err != nil {
			return ensureConnectErrorWithCorrelation(err, corrID)
		}
		return nil
	}
}

type clientAuthInterceptor struct {
	cfg ClientAuthConfig
}

// NewClientAuthInterceptor signs x-internal-auth and ensures valid x-correlation-id on outgoing RPCs.
func NewClientAuthInterceptor(cfg ClientAuthConfig) connect.Interceptor {
	return &clientAuthInterceptor{cfg: cfg}
}

func (c *clientAuthInterceptor) attachHeaders(header interface {
	Values(string) []string
	Set(string, string)
}) error {
	ttl := c.cfg.TTL
	if ttl <= 0 {
		ttl = defaultClientTokenTTL
	}
	token, err := internalauth.Sign(c.cfg.Role, c.cfg.Subject, ttl, c.cfg.Secret)
	if err != nil {
		return connect.NewError(connect.CodeInternal, fmt.Errorf("sign internal auth metadata: %w", err))
	}
	header.Set(MetadataInternalAuth, token)

	corrVals := header.Values(MetadataCorrelationID)
	if len(corrVals) != 1 || !correlationIDPattern.MatchString(strings.TrimSpace(corrVals[0])) {
		header.Set(MetadataCorrelationID, contracts.NewUUIDv4())
	}
	return nil
}

func (c *clientAuthInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		if err := c.attachHeaders(req.Header()); err != nil {
			return nil, err
		}
		return next(ctx, req)
	}
}

type authStreamingClientConn struct {
	connect.StreamingClientConn
	interceptor *clientAuthInterceptor
	attached    bool
}

func (a *authStreamingClientConn) Send(msg any) error {
	if !a.attached {
		a.attached = true
		if err := a.interceptor.attachHeaders(a.RequestHeader()); err != nil {
			return err
		}
	}
	return a.StreamingClientConn.Send(msg)
}

func (c *clientAuthInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return func(ctx context.Context, spec connect.Spec) connect.StreamingClientConn {
		return &authStreamingClientConn{
			StreamingClientConn: next(ctx, spec),
			interceptor:         c,
		}
	}
}

func (c *clientAuthInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return next
}
