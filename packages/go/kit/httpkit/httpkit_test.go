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

	forgedTok := tok + "tampered"
	multiCases := []struct {
		name   string
		values [][2]string
		wantOK bool
	}{
		{
			name:   "0 headers returns 401",
			values: nil,
			wantOK: false,
		},
		{
			name:   "1 valid header returns claims",
			values: [][2]string{{internalauth.HeaderName, tok}},
			wantOK: true,
		},
		{
			name:   "1 invalid header returns 401",
			values: [][2]string{{internalauth.HeaderName, forgedTok}},
			wantOK: false,
		},
		{
			name:   "2 headers valid plus invalid returns 401",
			values: [][2]string{{internalauth.HeaderName, tok}, {internalauth.HeaderName, forgedTok}},
			wantOK: false,
		},
		{
			name:   "2 headers invalid plus valid returns 401",
			values: [][2]string{{internalauth.HeaderName, forgedTok}, {internalauth.HeaderName, tok}},
			wantOK: false,
		},
		{
			name:   "2 headers valid plus valid returns 401",
			values: [][2]string{{internalauth.HeaderName, tok}, {internalauth.HeaderName, tok}},
			wantOK: false,
		},
		{
			name:   "2 headers mixed-case keys returns 401",
			values: [][2]string{{"X-Internal-Auth", tok}, {"x-internal-auth", forgedTok}},
			wantOK: false,
		},
		{
			name:   "3 headers returns 401",
			values: [][2]string{{internalauth.HeaderName, tok}, {internalauth.HeaderName, tok}, {internalauth.HeaderName, forgedTok}},
			wantOK: false,
		},
	}

	for _, tc := range multiCases {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/v1/private", nil)
			for _, kv := range tc.values {
				req.Header.Add(kv[0], kv[1])
			}
			gotClaims, gotOK := RequireInternalAuth(rec, req)
			if gotOK != tc.wantOK {
				t.Fatalf("RequireInternalAuth ok=%v, want %v (status=%d body=%s)", gotOK, tc.wantOK, rec.Code, rec.Body.String())
			}
			if tc.wantOK {
				if gotClaims == nil || gotClaims.Role != internalauth.RoleService || gotClaims.Sub != "portal-ssr" {
					t.Fatalf("expected verified service claims, got %+v", gotClaims)
				}
				return
			}
			if gotClaims != nil || rec.Code != http.StatusUnauthorized {
				t.Fatalf("expected (nil, 401), got (%+v, %d)", gotClaims, rec.Code)
			}
			var errRes ErrorResponse
			if err := json.NewDecoder(rec.Body).Decode(&errRes); err != nil || errRes.Error == "" {
				t.Fatalf("expected JSON ErrorResponse on 401, got err=%v body=%q", err, rec.Body.String())
			}
		})
	}
}
