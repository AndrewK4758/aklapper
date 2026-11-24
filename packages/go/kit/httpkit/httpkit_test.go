package httpkit

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNewHealthHandler(t *testing.T) {
	t.Parallel()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	NewHealthHandler("test-svc")(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var res HealthResponse
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if !res.OK || res.Service != "test-svc" {
		t.Fatalf("unexpected health response: %+v", res)
	}
}

func TestWriteSSEEvent(t *testing.T) {
	t.Parallel()

	rec := httptest.NewRecorder()
	if err := WriteSSEEvent(rec, "status", map[string]string{"state": "ready"}); err != nil {
		t.Fatalf("WriteSSEEvent failed: %v", err)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "event: status\n") || !strings.Contains(body, `"state":"ready"`) {
		t.Fatalf("unexpected SSE payload: %q", body)
	}
}
