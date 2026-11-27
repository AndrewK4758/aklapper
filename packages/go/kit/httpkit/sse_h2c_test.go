package httpkit

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestSSEWriterValidationAndRaceFreeHeartbeat(t *testing.T) {
	rec := httptest.NewRecorder()
	sw := NewSSEWriter(rec)

	if rec.Header().Get("Connection") != "" {
		t.Fatalf("SSEWriter must not set RFC 9113 Connection header, got %q", rec.Header().Get("Connection"))
	}
	if rec.Header().Get("X-Accel-Buffering") != "no" {
		t.Fatalf("expected X-Accel-Buffering=no, got %q", rec.Header().Get("X-Accel-Buffering"))
	}
	if err := sw.WriteEvent("bad\r\nevent", map[string]string{"a": "b"}); err == nil {
		t.Fatal("expected CRLF eventName rejection")
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	stopHB := sw.StartHeartbeat(ctx, 10*time.Millisecond)

	var wg sync.WaitGroup
	for i := range 5 {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			_ = sw.WriteEvent("delta", map[string]int{"i": idx})
		}(i)
	}
	time.Sleep(35 * time.Millisecond)
	wg.Wait()
	stopHB()
	stopHB() // idempotent

	body := rec.Body.String()
	if !strings.Contains(body, ": keepalive\n\n") || !strings.Contains(body, "event: delta\n") {
		t.Fatalf("expected keepalive comments and delta events, got:\n%s", body)
	}
}

func TestListenAndServeDualGracefulCancelsBaseContextAndSupportsEmptyGRPC(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	streamCancelled := make(chan struct{}, 1)
	streamStarted := make(chan struct{}, 1)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", NewHealthHandler("dual-test"))
	mux.HandleFunc("GET /stream", func(w http.ResponseWriter, r *http.Request) {
		sw := NewSSEWriter(w)
		_ = sw.WriteEvent("meta", map[string]string{"ok": "1"})
		select {
		case streamStarted <- struct{}{}:
		default:
		}
		<-r.Context().Done()
		select {
		case streamCancelled <- struct{}{}:
		default:
		}
	})

	readyCh := make(chan string, 1)
	doneCh := make(chan error, 1)
	go func() {
		doneCh <- ListenAndServeDualGraceful(ctx, DualServerConfig{
			HTTPAddr:        "127.0.0.1:0",
			HTTPHandler:     mux,
			GRPCAddr:        "",
			ShutdownTimeout: 2 * time.Second,
			OnReady: func(httpAddr, grpcAddr string) {
				if grpcAddr != "" {
					t.Errorf("expected empty grpcAddr when GRPCAddr is empty, got %q", grpcAddr)
				}
				readyCh <- httpAddr
			},
		})
	}()

	httpAddr := <-readyCh
	client := &http.Client{
		Transport: &http.Transport{
			DisableKeepAlives: true,
		},
	}
	defer client.CloseIdleConnections()

	res, err := client.Get("http://" + httpAddr + "/healthz")
	if err != nil || res.StatusCode != http.StatusOK {
		t.Fatalf("healthz failed: res=%v err=%v", res, err)
	}
	_, _ = io.Copy(io.Discard, res.Body)
	_ = res.Body.Close()

	// Hold an active SSE stream open until shutdown cancels BaseContext.
	streamClientDone := make(chan error, 1)
	go func() {
		sRes, sErr := client.Get("http://" + httpAddr + "/stream")
		if sErr != nil {
			streamClientDone <- sErr
			return
		}
		_, _ = io.Copy(io.Discard, sRes.Body)
		_ = sRes.Body.Close()
		streamClientDone <- nil
	}()

	select {
	case <-streamStarted:
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for SSE stream to start")
	}

	cancel()

	select {
	case <-streamCancelled:
	case <-time.After(2 * time.Second):
		t.Fatal("expected BaseContext cancellation to abort active SSE stream")
	}

	if err := <-doneCh; err != nil {
		t.Fatalf("expected clean dual shutdown, got %v", err)
	}

	select {
	case sErr := <-streamClientDone:
		if sErr != nil {
			t.Fatalf("SSE client request failed: %v", sErr)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for SSE client to observe stream EOF")
	}
}
