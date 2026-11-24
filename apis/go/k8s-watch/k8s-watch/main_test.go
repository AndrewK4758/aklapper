package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
)

func TestClusterStreamRedactsAdminForGuestsAndSpoofedHeaders(t *testing.T) {
	t.Parallel()

	h := newHandler()
	req := httptest.NewRequest(http.MethodGet, "/v1/cluster/stream", nil)
	req.Header.Set("X-Admin-Role", "admin")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	body := rec.Body.String()
	if strings.Contains(body, "cadence-admin") {
		t.Fatalf("spoofed X-Admin-Role header leaked cadence-admin: %s", body)
	}
	if !strings.Contains(body, "cadence-demo") {
		t.Fatalf("expected cadence-demo in stream: %s", body)
	}
}

func TestWakeEnforcesSignedInternalAuthForAdminWorkload(t *testing.T) {
	t.Parallel()

	h := newHandler()

	// Spoofed raw X-Admin-Role must fail with 403
	spoofReq := httptest.NewRequest(http.MethodPost, "/v1/cluster/wake/cadence-admin", nil)
	spoofReq.Header.Set("X-Admin-Role", "admin")
	spoofRec := httptest.NewRecorder()
	h.ServeHTTP(spoofRec, spoofReq)

	if spoofRec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for spoofed header, got %d", spoofRec.Code)
	}

	// Signed internal auth admin token succeeds with 202
	token, err := internalauth.Sign(internalauth.RoleAdmin, "admin-unit", time.Minute, "")
	if err != nil {
		t.Fatalf("sign admin token: %v", err)
	}
	adminReq := httptest.NewRequest(http.MethodPost, "/v1/cluster/wake/cadence-admin", nil)
	adminReq.Header.Set(internalauth.HeaderName, token)
	adminRec := httptest.NewRecorder()
	h.ServeHTTP(adminRec, adminReq)

	if adminRec.Code != http.StatusAccepted {
		t.Fatalf("expected 202 for signed admin token, got %d", adminRec.Code)
	}
}
