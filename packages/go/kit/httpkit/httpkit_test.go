package httpkit

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
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

func TestRequireInternalAuth(t *testing.T) {
	t.Setenv("INTERNAL_AUTH_SECRET", "httpkit-test-secret")

	recUnauth := httptest.NewRecorder()
	reqUnauth := httptest.NewRequest(http.MethodGet, "/v1/private", nil)
	if claims, ok := RequireInternalAuth(recUnauth, reqUnauth); ok || claims != nil || recUnauth.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 when header missing, got ok=%v status=%d", ok, recUnauth.Code)
	}

	tok, err := internalauth.Sign(internalauth.RoleService, "portal-ssr", time.Minute, "")
	if err != nil {
		t.Fatalf("sign failed: %v", err)
	}
	recOK := httptest.NewRecorder()
	reqOK := httptest.NewRequest(http.MethodGet, "/v1/private", nil)
	reqOK.Header.Set(internalauth.HeaderName, tok)
	claims, ok := RequireInternalAuth(recOK, reqOK)
	if !ok || claims == nil || claims.Role != internalauth.RoleService || claims.Sub != "portal-ssr" {
		t.Fatalf("expected verified service claims, got ok=%v claims=%+v", ok, claims)
	}
}
