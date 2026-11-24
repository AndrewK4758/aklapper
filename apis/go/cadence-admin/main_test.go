package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAdminStatusRequiresAdminHeader(t *testing.T) {
	t.Parallel()

	h := newHandler()

	guestReq := httptest.NewRequest(http.MethodGet, "/v1/admin/status", nil)
	guestRec := httptest.NewRecorder()
	h.ServeHTTP(guestRec, guestReq)
	if guestRec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for guest, got %d", guestRec.Code)
	}

	adminReq := httptest.NewRequest(http.MethodGet, "/v1/admin/status", nil)
	adminReq.Header.Set("X-Admin-Role", "admin")
	adminRec := httptest.NewRecorder()
	h.ServeHTTP(adminRec, adminReq)
	if adminRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for admin, got %d", adminRec.Code)
	}
}
