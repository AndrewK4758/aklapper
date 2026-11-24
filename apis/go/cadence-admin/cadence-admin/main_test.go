package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
)

func TestAdminStatusRequiresSignedInternalAuth(t *testing.T) {
	t.Parallel()

	h := newHandler()

	// Missing header -> 403
	guestReq := httptest.NewRequest(http.MethodGet, "/v1/admin/status", nil)
	guestRec := httptest.NewRecorder()
	h.ServeHTTP(guestRec, guestReq)
	if guestRec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for guest, got %d", guestRec.Code)
	}

	// Spoofed raw X-Admin-Role header without signed X-Internal-Auth -> 403
	spoofReq := httptest.NewRequest(http.MethodGet, "/v1/admin/status", nil)
	spoofReq.Header.Set("X-Admin-Role", "admin")
	spoofRec := httptest.NewRecorder()
	h.ServeHTTP(spoofRec, spoofReq)
	if spoofRec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for spoofed X-Admin-Role header, got %d", spoofRec.Code)
	}

	// Valid signed X-Internal-Auth admin token -> 200
	token, err := internalauth.Sign(internalauth.RoleAdmin, "admin-unit", time.Minute, "")
	if err != nil {
		t.Fatalf("sign admin token: %v", err)
	}
	adminReq := httptest.NewRequest(http.MethodGet, "/v1/admin/status", nil)
	adminReq.Header.Set(internalauth.HeaderName, token)
	adminRec := httptest.NewRecorder()
	h.ServeHTTP(adminRec, adminReq)
	if adminRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for signed admin token, got %d", adminRec.Code)
	}
}
