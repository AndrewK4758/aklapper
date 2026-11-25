package httpkit

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

const DefaultSSEHeartbeatInterval = 15 * time.Second

// ErrInvalidSSEEventName is returned when an SSE event name contains CR, LF, NUL, or is empty.
var ErrInvalidSSEEventName = errors.New("invalid SSE event name")

// ValidateSSEEventName verifies an SSE event token cannot inject extra header/frame lines.
func ValidateSSEEventName(name string) error {
	if strings.TrimSpace(name) == "" || strings.ContainsAny(name, "\r\n\x00") {
		return ErrInvalidSSEEventName
	}
	return nil
}

// SSEWriter provides mutex-serialized HTTP/2-compliant SSE writes and race-free heartbeats.
type SSEWriter struct {
	w  http.ResponseWriter
	rc *http.ResponseController
	mu sync.Mutex
}

// NewSSEWriter sets RFC 9113-compliant SSE headers (omitting Connection: keep-alive),
// writes HTTP 200, and flushes headers immediately.
func NewSSEWriter(w http.ResponseWriter) *SSEWriter {
	h := w.Header()
	h.Set("Content-Type", "text/event-stream; charset=utf-8")
	h.Set("Cache-Control", "no-cache")
	h.Set("X-Accel-Buffering", "no")
	h.Del("Connection")
	w.WriteHeader(http.StatusOK)

	rc := http.NewResponseController(w)
	_ = rc.Flush()
	return &SSEWriter{w: w, rc: rc}
}

// WriteEvent writes a single JSON-encoded SSE event frame and flushes immediately.
func (s *SSEWriter) WriteEvent(eventName string, payload any) error {
	if err := ValidateSSEEventName(eventName); err != nil {
		return err
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := fmt.Fprintf(s.w, "event: %s\ndata: %s\n\n", eventName, raw); err != nil {
		return err
	}
	if err := s.rc.Flush(); err != nil && !errors.Is(err, http.ErrNotSupported) {
		return err
	}
	return nil
}

// WriteComment writes an SSE comment frame (e.g., ": keepalive\n\n") and flushes immediately.
func (s *SSEWriter) WriteComment(comment string) error {
	sanitized := strings.NewReplacer("\r", " ", "\n", " ").Replace(comment)

	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := fmt.Fprintf(s.w, ": %s\n\n", sanitized); err != nil {
		return err
	}
	if err := s.rc.Flush(); err != nil && !errors.Is(err, http.ErrNotSupported) {
		return err
	}
	return nil
}

// StartHeartbeat periodically emits `: keepalive\n\n` frames until ctx is cancelled or stop is called.
// The returned stop function is idempotent and waits for the heartbeat goroutine to exit cleanly.
func (s *SSEWriter) StartHeartbeat(ctx context.Context, interval time.Duration) func() {
	if interval <= 0 {
		interval = DefaultSSEHeartbeatInterval
	}
	doneCh := make(chan struct{})
	var stopOnce sync.Once
	var wg sync.WaitGroup
	wg.Add(1)

	go func() {
		defer wg.Done()
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-doneCh:
				return
			case <-ticker.C:
				if err := s.WriteComment("keepalive"); err != nil {
					return
				}
			}
		}
	}()

	return func() {
		stopOnce.Do(func() {
			close(doneCh)
		})
		wg.Wait()
	}
}
