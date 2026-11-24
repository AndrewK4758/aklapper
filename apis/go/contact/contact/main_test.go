package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
)

func TestContactNotifyEndpoint(t *testing.T) {
	t.Setenv("INTERNAL_AUTH_SECRET", "contact-unit-secret")
	serviceTok, err := internalauth.Sign(internalauth.RoleService, "portal-contact", time.Minute, "contact-unit-secret")
	if err != nil {
		t.Fatalf("sign service token: %v", err)
	}
	h := newHandler()

	t.Run("rejects unauthenticated notify requests", func(t *testing.T) {
		body := []byte(`{"submissionId":"sub-123","name":"Grace Hopper","email":"grace@example.com","hasAttachment":true,"receivedAt":"2026-11-24T12:00:00Z"}`)
		req := httptest.NewRequest(http.MethodPost, "/v1/contact/notify", bytes.NewReader(body))
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", rec.Code)
		}
	})

	t.Run("accepts valid notification payload", func(t *testing.T) {
		body := []byte(`{"submissionId":"sub-123","name":"Grace Hopper","email":"grace@example.com","hasAttachment":true,"receivedAt":"2026-11-24T12:00:00Z"}`)
		req := httptest.NewRequest(http.MethodPost, "/v1/contact/notify", bytes.NewReader(body))
		req.Header.Set(internalauth.HeaderName, serviceTok)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusAccepted {
			t.Fatalf("expected 202, got %d: %s", rec.Code, rec.Body.String())
		}
		var out map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if out["accepted"] != true || out["submissionId"] != "sub-123" || !strings.HasPrefix(out["notificationId"].(string), "ntf-") {
			t.Fatalf("unexpected notify response: %+v", out)
		}
	})

	t.Run("rejects invalid notification payload", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/v1/contact/notify", bytes.NewReader([]byte(`{"submissionId":"","name":"A","email":"bad"}`)))
		req.Header.Set(internalauth.HeaderName, serviceTok)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", rec.Code)
		}
	})
}
