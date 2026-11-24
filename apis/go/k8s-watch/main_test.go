package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestClusterStreamRedactsAdminForGuests(t *testing.T) {
	t.Parallel()

	h := newHandler()
	req := httptest.NewRequest(http.MethodGet, "/v1/cluster/stream", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	body := rec.Body.String()
	if strings.Contains(body, "cadence-admin") {
		t.Fatalf("guest stream leaked cadence-admin: %s", body)
	}
	if !strings.Contains(body, "cadence-demo") {
		t.Fatalf("expected cadence-demo in stream: %s", body)
	}
}

func TestWakeRejectsGuestForAdminWorkload(t *testing.T) {
	t.Parallel()

	h := newHandler()
	req := httptest.NewRequest(http.MethodPost, "/v1/cluster/wake/cadence-admin", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
}
