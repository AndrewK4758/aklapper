package httpkit

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"
)

const defaultDualShutdownTimeout = 10 * time.Second

// GRPCGracefulServer captures the lifecycle surface of *grpc.Server without coupling httpkit to grpc-go.
type GRPCGracefulServer interface {
	Serve(net.Listener) error
	GracefulStop()
	Stop()
}

// DualServerConfig configures an HTTP/1.1+h2c server paired with an optional native gRPC server.
// Setting GRPCAddr to "" cleanly disables the gRPC listener (single-port Cloud Run compatibility).
type DualServerConfig struct {
	HTTPAddr        string
	HTTPHandler     http.Handler
	GRPCAddr        string
	GRPCServer      GRPCGracefulServer
	ShutdownTimeout time.Duration
	OnReady         func(httpAddr, grpcAddr string)
}

// NewH2CServer creates a Go 1.27 HTTP/1.1 + unencrypted HTTP/2 (h2c) server bound to baseCtx
// so shutdown immediately cancels active SSE request contexts.
func NewH2CServer(addr string, handler http.Handler, baseCtx context.Context) *http.Server {
	if baseCtx == nil {
		baseCtx = context.Background()
	}
	protocols := new(http.Protocols)
	protocols.SetHTTP1(true)
	protocols.SetUnencryptedHTTP2(true)
	return &http.Server{
		Addr:              addr,
		Handler:           handler,
		Protocols:         protocols,
		ReadHeaderTimeout: 5 * time.Second,
		BaseContext: func(net.Listener) context.Context {
			return baseCtx
		},
	}
}

// ListenAndServeDualGraceful pre-binds both HTTP and optional gRPC sockets before serving traffic,
// cancels BaseContext on shutdown, and drains both servers concurrently with forced gRPC Stop fallback.
func ListenAndServeDualGraceful(ctx context.Context, cfg DualServerConfig) error {
	if cfg.HTTPHandler == nil {
		return errors.New("HTTPHandler is required")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	shutdownTimeout := cfg.ShutdownTimeout
	if shutdownTimeout <= 0 {
		shutdownTimeout = defaultDualShutdownTimeout
	}

	httpLn, err := net.Listen("tcp", cfg.HTTPAddr)
	if err != nil {
		return fmt.Errorf("bind http listener %s: %w", cfg.HTTPAddr, err)
	}

	var grpcLn net.Listener
	grpcAddr := strings.TrimSpace(cfg.GRPCAddr)
	if grpcAddr != "" && cfg.GRPCServer != nil {
		grpcLn, err = net.Listen("tcp", grpcAddr)
		if err != nil {
			_ = httpLn.Close()
			return fmt.Errorf("bind grpc listener %s: %w", grpcAddr, err)
		}
	}

	runCtx, cancelRun := context.WithCancel(ctx)
	defer cancelRun()

	httpSrv := NewH2CServer(httpLn.Addr().String(), cfg.HTTPHandler, runCtx)
	errCh := make(chan error, 2)

	go func() {
		if serveErr := httpSrv.Serve(httpLn); serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			errCh <- fmt.Errorf("http server error: %w", serveErr)
		}
	}()

	boundGRPCAddr := ""
	if grpcLn != nil {
		boundGRPCAddr = grpcLn.Addr().String()
		go func() {
			if serveErr := cfg.GRPCServer.Serve(grpcLn); serveErr != nil {
				errCh <- fmt.Errorf("grpc server error: %w", serveErr)
			}
		}()
	}

	if cfg.OnReady != nil {
		cfg.OnReady(httpLn.Addr().String(), boundGRPCAddr)
	}

	var firstErr error
	select {
	case <-ctx.Done():
	case firstErr = <-errCh:
	}

	// Cancel BaseContext so active long-lived SSE streams terminate promptly.
	cancelRun()

	drainCtx, cancelDrain := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancelDrain()

	var wg sync.WaitGroup
	var httpShutdownErr error
	wg.Add(1)
	go func() {
		defer wg.Done()
		httpShutdownErr = httpSrv.Shutdown(drainCtx)
	}()

	if grpcLn != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			stopped := make(chan struct{})
			go func() {
				cfg.GRPCServer.GracefulStop()
				close(stopped)
			}()
			select {
			case <-stopped:
			case <-drainCtx.Done():
				cfg.GRPCServer.Stop()
				<-stopped
			}
		}()
	}

	wg.Wait()
	if firstErr != nil {
		return firstErr
	}
	return httpShutdownErr
}

// ListenAndServeDualGracefulSignals wraps ListenAndServeDualGraceful with SIGINT/SIGTERM handling.
func ListenAndServeDualGracefulSignals(cfg DualServerConfig) error {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	return ListenAndServeDualGraceful(ctx, cfg)
}
