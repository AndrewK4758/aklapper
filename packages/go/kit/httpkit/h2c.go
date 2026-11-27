package httpkit

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os/signal"
	"syscall"
	"time"
)

const (
	defaultShutdownTimeout  = 10 * time.Second
	defaultH2ReadIdle       = 30 * time.Second
	defaultH2PingTimeout    = 10 * time.Second
	defaultReadHeaderTimout = 5 * time.Second
)

// H2CServerConfig configures a single-port HTTP/1.1 + unencrypted HTTP/2 (h2c) server.
type H2CServerConfig struct {
	Addr            string
	Handler         http.Handler
	ShutdownTimeout time.Duration
	OnReady         func(addr string)
}

// NewH2CServer creates a Go 1.27 HTTP/1.1 + unencrypted HTTP/2 (h2c) server bound to baseCtx
// with WriteTimeout=0 for long-lived streams and explicit HTTP/2 keepalive pings.
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
		ReadHeaderTimeout: defaultReadHeaderTimout,
		WriteTimeout:      0,
		HTTP2: &http.HTTP2Config{
			SendPingTimeout: defaultH2ReadIdle,
			PingTimeout:     defaultH2PingTimeout,
		},
		BaseContext: func(net.Listener) context.Context {
			return baseCtx
		},
	}
}

// ListenAndServeH2CGraceful pre-binds a single TCP socket serving HTTP/1.1 + h2c traffic,
// cancels BaseContext on ctx cancellation so active streams run detached cleanup, and drains cleanly.
func ListenAndServeH2CGraceful(ctx context.Context, cfg H2CServerConfig) error {
	if cfg.Handler == nil {
		return errors.New("Handler is required")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	shutdownTimeout := cfg.ShutdownTimeout
	if shutdownTimeout <= 0 {
		shutdownTimeout = defaultShutdownTimeout
	}

	ln, err := net.Listen("tcp", cfg.Addr)
	if err != nil {
		return fmt.Errorf("bind listener %s: %w", cfg.Addr, err)
	}

	runCtx, cancelRun := context.WithCancel(ctx)
	defer cancelRun()

	srv := NewH2CServer(ln.Addr().String(), cfg.Handler, runCtx)
	errCh := make(chan error, 1)

	go func() {
		if serveErr := srv.Serve(ln); serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			errCh <- fmt.Errorf("http server error: %w", serveErr)
		}
	}()

	if cfg.OnReady != nil {
		cfg.OnReady(ln.Addr().String())
	}

	var firstErr error
	select {
	case <-ctx.Done():
	case firstErr = <-errCh:
	}

	// Cancel BaseContext so active long-lived gRPC and SSE streams terminate promptly.
	cancelRun()

	drainCtx, cancelDrain := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancelDrain()

	shutdownErr := srv.Shutdown(drainCtx)
	if firstErr != nil {
		return firstErr
	}
	return shutdownErr
}

// ListenAndServeH2CGracefulSignals wraps ListenAndServeH2CGraceful with SIGINT/SIGTERM handling.
func ListenAndServeH2CGracefulSignals(addr string, handler http.Handler, shutdownTimeout time.Duration) error {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	return ListenAndServeH2CGraceful(ctx, H2CServerConfig{
		Addr:            addr,
		Handler:         handler,
		ShutdownTimeout: shutdownTimeout,
	})
}
