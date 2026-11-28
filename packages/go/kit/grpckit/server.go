package grpckit

import (
	"context"
	"mime"
	"net/http"
	"strings"

	"connectrpc.com/connect"
	"connectrpc.com/grpchealth"
)

// NewGRPCOnlyMiddleware restricts mounted ConnectRPC service paths strictly to HTTP POST
// requests carrying an exact parsed Content-Type of "application/grpc" or "application/grpc+proto".
// Non-POST methods receive 405 Method Not Allowed (with Allow: POST); disallowed media types
// (including application/grpc-web*, application/grpc+json, and application/connect+*) receive 415.
func NewGRPCOnlyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			logGRPCSeam("UNSOUND_CONDITION", "grpc.protocol.unsupported_media_type", map[string]any{
				"reason": "method_not_allowed",
				"method": r.Method,
				"path":   r.URL.Path,
			})
			w.Header().Set("Allow", http.MethodPost)
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		mediaType, _, parseErr := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if parseErr != nil || (mediaType != "application/grpc" && mediaType != "application/grpc+proto") {
			logGRPCSeam("UNSOUND_CONDITION", "grpc.protocol.unsupported_media_type", map[string]any{
				"reason":    "unsupported_media_type",
				"method":    r.Method,
				"path":      r.URL.Path,
				"mediaType": mediaType,
			})
			http.Error(w, "unsupported media type", http.StatusUnsupportedMediaType)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// NewHandlerOptions builds standard ConnectRPC handler options carrying server HMAC auth
// and x-correlation-id sanitization/echo interceptors.
func NewHandlerOptions(explicitSecret string) []connect.HandlerOption {
	return []connect.HandlerOption{
		connect.WithInterceptors(NewServerAuthInterceptor(explicitSecret)),
	}
}

type checkOnlyChecker struct {
	inner grpchealth.Checker
}

func (c checkOnlyChecker) Check(
	ctx context.Context,
	req *grpchealth.CheckRequest,
) (*grpchealth.CheckResponse, error) {
	return c.inner.Check(ctx, req)
}

// NewHealthHandler constructs a strict gRPC-only /grpc.health.v1.Health/ handler marking ""
// and every non-empty serviceName as SERVING for unary Check without requiring x-internal-auth,
// while leaving streaming Watch unimplemented and auth-gated.
func NewHealthHandler(serviceNames ...string) (string, http.Handler) {
	return NewHealthHandlerWithSecret("", serviceNames...)
}

// NewHealthHandlerWithSecret behaves like NewHealthHandler using explicitSecret on auth-gated procedures.
func NewHealthHandlerWithSecret(explicitSecret string, serviceNames ...string) (string, http.Handler) {
	cleaned := make([]string, 0, len(serviceNames))
	for _, svc := range serviceNames {
		if trimmed := strings.TrimSpace(svc); trimmed != "" {
			cleaned = append(cleaned, trimmed)
		}
	}
	checker := checkOnlyChecker{inner: grpchealth.NewStaticChecker(cleaned...)}
	path, handler := grpchealth.NewHandler(
		checker,
		connect.WithInterceptors(NewServerAuthInterceptor(explicitSecret)),
	)
	return path, NewGRPCOnlyMiddleware(handler)
}

// NewH2CClient returns a Go 1.27 HTTP client configured for cleartext HTTP/2 (h2c) gRPC calls.
func NewH2CClient() *http.Client {
	protocols := new(http.Protocols)
	protocols.SetUnencryptedHTTP2(true)
	return &http.Client{
		Transport: &http.Transport{
			Protocols: protocols,
		},
	}
}
