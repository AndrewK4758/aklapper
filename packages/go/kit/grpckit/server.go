package grpckit

import (
	"os"
	"strings"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/keepalive"
)

// GRPCListenAddr resolves GRPC_PORT from the environment. An empty or unset GRPC_PORT returns ""
// so single-port runtimes (such as Cloud Run) disable the gRPC listener cleanly.
func GRPCListenAddr() string {
	raw := strings.TrimSpace(os.Getenv("GRPC_PORT"))
	if raw == "" {
		return ""
	}
	if strings.Contains(raw, ":") {
		return raw
	}
	return ":" + raw
}

// NewServer builds a configured *grpc.Server with keepalive parameters, HMAC auth + correlation
// interceptors, and grpc.health.v1 registered as SERVING for "" and each listed serviceName.
func NewServer(explicitSecret string, serviceNames ...string) (*grpc.Server, *health.Server) {
	srv := grpc.NewServer(
		grpc.KeepaliveParams(keepalive.ServerParameters{
			Time:    30 * time.Second,
			Timeout: 10 * time.Second,
		}),
		grpc.KeepaliveEnforcementPolicy(keepalive.EnforcementPolicy{
			MinTime:             10 * time.Second,
			PermitWithoutStream: true,
		}),
		grpc.UnaryInterceptor(UnaryServerAuthInterceptor(explicitSecret)),
		grpc.StreamInterceptor(StreamServerAuthInterceptor(explicitSecret)),
	)

	hs := health.NewServer()
	hs.SetServingStatus("", healthpb.HealthCheckResponse_SERVING)
	for _, svc := range serviceNames {
		if trimmed := strings.TrimSpace(svc); trimmed != "" {
			hs.SetServingStatus(trimmed, healthpb.HealthCheckResponse_SERVING)
		}
	}
	healthpb.RegisterHealthServer(srv, hs)
	return srv, hs
}
