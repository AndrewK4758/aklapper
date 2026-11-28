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
	stopHB()

	body := rec.Body.String()
	if !strings.Contains(body, ": keepalive\n\n") || !strings.Contains(body, "event: delta\n") {
		t.Fatalf("expected keepalive comments and delta events, got:\n%s", body)
	}
}

func TestNewH2CServerKeepaliveAndZeroWriteTimeout(t *testing.T) {
	srv := NewH2CServer(":0", http.NewServeMux(), context.Background())
	if srv.WriteTimeout != 0 {
		t.Fatalf("expected WriteTimeout=0 for long-lived streams, got %v", srv.WriteTimeout)
	}
	if srv.HTTP2 == nil || srv.HTTP2.SendPingTimeout != 30*time.Second || srv.HTTP2.PingTimeout != 10*time.Second {
		t.Fatalf("expected HTTP2 SendPingTimeout=30s PingTimeout=10s, got %+v", srv.HTTP2)
	}
}

func TestListenAndServeH2CGracefulMultiplexesHTTP1AndH2CAndDrains(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	streamCancelled := make(chan struct{}, 1)
	streamStarted := make(chan struct{}, 1)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", NewHealthHandler("h2c-test"))
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
		doneCh <- ListenAndServeH2CGraceful(ctx, H2CServerConfig{
			Addr:            "127.0.0.1:0",
			Handler:         mux,
			ShutdownTimeout: 2 * time.Second,
			OnReady: func(addr string) {
				readyCh <- addr
			},
		})
	}()

	addr := <-readyCh
	http1Client := &http.Client{
		Transport: &http.Transport{DisableKeepAlives: true},
	}
	defer http1Client.CloseIdleConnections()

	res, err := http1Client.Get("http://" + addr + "/healthz")
	if err != nil || res.StatusCode != http.StatusOK {
		t.Fatalf("HTTP/1.1 healthz failed: res=%v err=%v", res, err)
	}
	_, _ = io.Copy(io.Discard, res.Body)
	_ = res.Body.Close()

	// Verify h2c HTTP/2 request on the exact same port.
	h2Protocols := new(http.Protocols)
	h2Protocols.SetUnencryptedHTTP2(true)
	h2Client := &http.Client{Transport: &http.Transport{Protocols: h2Protocols}}
	defer h2Client.CloseIdleConnections()
	h2Res, h2Err := h2Client.Get("http://" + addr + "/healthz")
	if h2Err != nil || h2Res.StatusCode != http.StatusOK || h2Res.ProtoMajor != 2 {
		t.Fatalf("h2c healthz failed: res=%v err=%v", h2Res, h2Err)
	}
	_, _ = io.Copy(io.Discard, h2Res.Body)
	_ = h2Res.Body.Close()

	// Hold an active SSE stream open until shutdown cancels BaseContext.
	streamClientDone := make(chan error, 1)
	go func() {
		sRes, sErr := http1Client.Get("http://" + addr + "/stream")
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
		t.Fatal("expected BaseContext cancellation to abort active stream")
	}

	if err := <-doneCh; err != nil {
		t.Fatalf("expected clean H2C shutdown, got %v", err)
	}

	select {
	case sErr := <-streamClientDone:
		if sErr != nil {
			t.Fatalf("SSE client request failed: %v", sErr)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for SSE client to observe EOF")
	}
}
