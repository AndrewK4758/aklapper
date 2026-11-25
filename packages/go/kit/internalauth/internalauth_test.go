package internalauth

import (
	"bufio"
	"bytes"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

const crossLangExpectedToken = "v1.eyJyb2xlIjoiYWRtaW4iLCJzdWIiOiJ1c2VyLTEiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDAwMDMwMH0.RlpNGuDUf8pZ9CB1C_3_4rtJfy7xmFw8ptVCmk4_FQs"

func TestCrossLanguageVectorMatchesNodeRuntime(t *testing.T) {
	t.Parallel()

	now := time.Unix(1700000000, 0).UTC()
	tok, err := SignWithClock(RoleAdmin, "user-1", now, 300*time.Second, "cross-lang-test-secret")
	if err != nil {
		t.Fatalf("SignWithClock failed: %v", err)
	}
	if tok != crossLangExpectedToken {
		t.Fatalf("token mismatch:\ngot:  %s\nwant: %s", tok, crossLangExpectedToken)
	}

	claims, err := VerifyAt(crossLangExpectedToken, "cross-lang-test-secret", time.Unix(1700000100, 0).UTC())
	if err != nil {
		t.Fatalf("VerifyAt failed: %v", err)
	}
	if claims.Role != RoleAdmin || claims.Sub != "user-1" || claims.Iat != 1700000000 || claims.Exp != 1700000300 {
		t.Fatalf("unexpected claims: %+v", claims)
	}
}

func TestVerifyRejectsExpiredTamperedAndWrongSecret(t *testing.T) {
	t.Parallel()

	now := time.Unix(1700000000, 0).UTC()
	tok, err := SignWithClock(RoleAdmin, "ops-1", now, 60*time.Second, "s3cr3t")
	if err != nil {
		t.Fatalf("SignWithClock failed: %v", err)
	}

	if _, err := VerifyAt(tok, "s3cr3t", now.Add(60*time.Second)); err != ErrExpiredToken {
		t.Fatalf("expected ErrExpiredToken, got %v", err)
	}
	if _, err := VerifyAt(tok, "wrong-secret", now.Add(10*time.Second)); err != ErrInvalidSignature {
		t.Fatalf("expected ErrInvalidSignature, got %v", err)
	}
	tampered := tok[:len(tok)-2] + "AA"
	if _, err := VerifyAt(tampered, "s3cr3t", now.Add(10*time.Second)); err == nil {
		t.Fatal("expected tampered token to fail verification")
	}
}

func TestFailsClosedInProductionWhenSecretMissing(t *testing.T) {
	captureMissingSecretStderr := func(t *testing.T, fn func()) string {
		t.Helper()
		origStderr := os.Stderr
		rPipe, wPipe, err := os.Pipe()
		if err != nil {
			t.Fatalf("pipe failed: %v", err)
		}
		os.Stderr = wPipe
		defer func() { os.Stderr = origStderr }()
		fn()
		_ = wPipe.Close()
		var buf bytes.Buffer
		_, _ = io.Copy(&buf, rPipe)
		_ = rPipe.Close()
		return buf.String()
	}

	t.Run("NODE_ENV=production fails closed and emits seam", func(t *testing.T) {
		t.Setenv("NODE_ENV", "production")
		t.Setenv("APP_ENV", "")
		t.Setenv("INTERNAL_AUTH_SECRET", "")

		out := captureMissingSecretStderr(t, func() {
			if _, err := Sign(RoleAdmin, "admin", time.Minute, ""); err != ErrMissingSecret {
				t.Fatalf("expected ErrMissingSecret in production, got %v", err)
			}
			req := httptest.NewRequest(http.MethodGet, "/v1/admin/status", nil)
			req.Header.Set(HeaderName, crossLangExpectedToken)
			if IsAdminRequest(req) {
				t.Fatal("expected IsAdminRequest to fail closed in production without INTERNAL_AUTH_SECRET")
			}
		})
		if !strings.Contains(out, "k8s.internalauth.prod_secret_missing") || !strings.Contains(out, "UNSOUND_CONDITION") {
			t.Fatalf("expected k8s.internalauth.prod_secret_missing seam on stderr, got: %q", out)
		}
	})

	t.Run("APP_ENV=production fails closed and emits seam without NODE_ENV", func(t *testing.T) {
		t.Setenv("NODE_ENV", "")
		t.Setenv("APP_ENV", "production")
		t.Setenv("INTERNAL_AUTH_SECRET", "")

		out := captureMissingSecretStderr(t, func() {
			if _, err := ResolveSecret(""); err != ErrMissingSecret {
				t.Fatalf("expected ErrMissingSecret under APP_ENV=production, got %v", err)
			}
			req := httptest.NewRequest(http.MethodGet, "/v1/admin/status", nil)
			req.Header.Set(HeaderName, crossLangExpectedToken)
			if IsAdminRequest(req) {
				t.Fatal("expected IsAdminRequest to fail closed under APP_ENV=production without INTERNAL_AUTH_SECRET")
			}
		})
		if !strings.Contains(out, "k8s.internalauth.prod_secret_missing") || !strings.Contains(out, "UNSOUND_CONDITION") {
			t.Fatalf("expected k8s.internalauth.prod_secret_missing seam on stderr under APP_ENV=production, got: %q", out)
		}
	})
}

func TestVerifyRequestRejectsSpoofedAdminRoleHeader(t *testing.T) {
	t.Setenv("NODE_ENV", "test")
	t.Setenv("INTERNAL_AUTH_SECRET", "req-test-secret")

	spoofed := httptest.NewRequest(http.MethodGet, "/v1/admin/status", nil)
	spoofed.Header.Set("X-Admin-Role", "admin")
	if IsAdminRequest(spoofed) {
		t.Fatal("spoofed X-Admin-Role header must not pass IsAdminRequest")
	}

	guestTok, err := Sign(RoleGuest, "guest-1", time.Minute, "")
	if err != nil {
		t.Fatalf("Sign guest failed: %v", err)
	}
	guestReq := httptest.NewRequest(http.MethodGet, "/v1/admin/status", nil)
	guestReq.Header.Set(HeaderName, guestTok)
	if IsAdminRequest(guestReq) {
		t.Fatal("guest internal auth token must not pass IsAdminRequest")
	}

	adminTok, err := Sign(RoleAdmin, "admin-1", time.Minute, "")
	if err != nil {
		t.Fatalf("Sign admin failed: %v", err)
	}
	adminReq := httptest.NewRequest(http.MethodGet, "/v1/admin/status", nil)
	adminReq.Header.Set(HeaderName, adminTok)
	if !IsAdminRequest(adminReq) {
		t.Fatal("valid admin internal auth token must pass IsAdminRequest")
	}
}

func TestVerifyRequestHeaderCardinality(t *testing.T) {
	t.Setenv("NODE_ENV", "test")
	t.Setenv("APP_ENV", "")
	t.Setenv("INTERNAL_AUTH_SECRET", "cardinality-test-secret")

	adminTok, err := Sign(RoleAdmin, "admin-1", time.Minute, "")
	if err != nil {
		t.Fatalf("Sign admin failed: %v", err)
	}
	guestTok, err := Sign(RoleGuest, "guest-1", time.Minute, "")
	if err != nil {
		t.Fatalf("Sign guest failed: %v", err)
	}
	forgedTok := adminTok + "tampered"

	wireMixedDupReq, err := http.ReadRequest(bufio.NewReader(strings.NewReader(
		"GET /v1/admin/status HTTP/1.1\r\nHost: internal\r\nX-Internal-Auth: " + adminTok + "\r\nx-internal-auth: " + forgedTok + "\r\n\r\n",
	)))
	if err != nil {
		t.Fatalf("ReadRequest failed: %v", err)
	}

	cases := []struct {
		name        string
		buildReq    func() *http.Request
		wantErr     error
		wantSub     string
		wantRole    string
		wantIsAdmin bool
	}{
		{
			name:        "nil request fails closed",
			buildReq:    func() *http.Request { return nil },
			wantErr:     ErrInvalidToken,
			wantIsAdmin: false,
		},
		{
			name:        "zero headers fails closed",
			buildReq:    func() *http.Request { return httptest.NewRequest(http.MethodGet, "/v1/private", nil) },
			wantErr:     ErrInvalidToken,
			wantIsAdmin: false,
		},
		{
			name:        "nil header map fails closed",
			buildReq:    func() *http.Request { return &http.Request{} },
			wantErr:     ErrInvalidToken,
			wantIsAdmin: false,
		},
		{
			name: "single empty header fails closed",
			buildReq: func() *http.Request {
				req := httptest.NewRequest(http.MethodGet, "/v1/private", nil)
				req.Header.Set(HeaderName, "   ")
				return req
			},
			wantErr:     ErrInvalidToken,
			wantIsAdmin: false,
		},
		{
			name: "single valid admin token succeeds",
			buildReq: func() *http.Request {
				req := httptest.NewRequest(http.MethodGet, "/v1/private", nil)
				req.Header.Set(HeaderName, adminTok)
				return req
			},
			wantSub:     "admin-1",
			wantRole:    RoleAdmin,
			wantIsAdmin: true,
		},
		{
			name: "single valid guest token verifies claims without admin privilege",
			buildReq: func() *http.Request {
				req := httptest.NewRequest(http.MethodGet, "/v1/private", nil)
				req.Header.Set(HeaderName, guestTok)
				return req
			},
			wantSub:     "guest-1",
			wantRole:    RoleGuest,
			wantIsAdmin: false,
		},
		{
			name: "duplicate valid plus forged fails closed",
			buildReq: func() *http.Request {
				req := httptest.NewRequest(http.MethodGet, "/v1/private", nil)
				req.Header.Add(HeaderName, adminTok)
				req.Header.Add(HeaderName, forgedTok)
				return req
			},
			wantErr:     ErrInvalidToken,
			wantIsAdmin: false,
		},
		{
			name: "duplicate forged plus valid fails closed",
			buildReq: func() *http.Request {
				req := httptest.NewRequest(http.MethodGet, "/v1/private", nil)
				req.Header.Add(HeaderName, forgedTok)
				req.Header.Add(HeaderName, adminTok)
				return req
			},
			wantErr:     ErrInvalidToken,
			wantIsAdmin: false,
		},
		{
			name: "duplicate valid plus valid fails closed",
			buildReq: func() *http.Request {
				req := httptest.NewRequest(http.MethodGet, "/v1/private", nil)
				req.Header.Add(HeaderName, adminTok)
				req.Header.Add(HeaderName, adminTok)
				return req
			},
			wantErr:     ErrInvalidToken,
			wantIsAdmin: false,
		},
		{
			name: "duplicate admin plus guest fails closed",
			buildReq: func() *http.Request {
				req := httptest.NewRequest(http.MethodGet, "/v1/private", nil)
				req.Header.Add(HeaderName, adminTok)
				req.Header.Add(HeaderName, guestTok)
				return req
			},
			wantErr:     ErrInvalidToken,
			wantIsAdmin: false,
		},
		{
			name: "mixed-case duplicate header keys fail closed via Add",
			buildReq: func() *http.Request {
				req := httptest.NewRequest(http.MethodGet, "/v1/private", nil)
				req.Header.Add("X-Internal-Auth", adminTok)
				req.Header.Add("x-internal-auth", forgedTok)
				return req
			},
			wantErr:     ErrInvalidToken,
			wantIsAdmin: false,
		},
		{
			name:        "mixed-case duplicate wire headers fail closed via ReadRequest",
			buildReq:    func() *http.Request { return wireMixedDupReq },
			wantErr:     ErrInvalidToken,
			wantIsAdmin: false,
		},
		{
			name: "three headers fail closed",
			buildReq: func() *http.Request {
				req := httptest.NewRequest(http.MethodGet, "/v1/private", nil)
				req.Header.Add(HeaderName, adminTok)
				req.Header.Add(HeaderName, adminTok)
				req.Header.Add(HeaderName, adminTok)
				return req
			},
			wantErr:     ErrInvalidToken,
			wantIsAdmin: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := tc.buildReq()
			claims, gotErr := VerifyRequest(req)
			if tc.wantErr != nil {
				if !errors.Is(gotErr, tc.wantErr) || claims != nil {
					t.Fatalf("expected (nil, %v), got (%+v, %v)", tc.wantErr, claims, gotErr)
				}
			} else {
				if gotErr != nil || claims == nil {
					t.Fatalf("expected verified claims, got (%+v, %v)", claims, gotErr)
				}
				if claims.Sub != tc.wantSub || claims.Role != tc.wantRole {
					t.Fatalf("unexpected claims: got (%q, %q), want (%q, %q)", claims.Role, claims.Sub, tc.wantRole, tc.wantSub)
				}
			}
			if gotAdmin := IsAdminRequest(req); gotAdmin != tc.wantIsAdmin {
				t.Fatalf("IsAdminRequest() = %v, want %v", gotAdmin, tc.wantIsAdmin)
			}
		})
	}
}
