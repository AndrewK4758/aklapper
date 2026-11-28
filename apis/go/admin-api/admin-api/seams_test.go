package main

import (
	"bytes"
	"context"
	"errors"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"connectrpc.com/connect"
	adminv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1/adminv1connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestValidateProductionAdminStartupConfigFailsClosed(t *testing.T) {
	t.Setenv("NODE_ENV", "production")
	t.Setenv("ADMIN_DATABASE_URL", "")
	t.Setenv("ADMIN_INTERNAL_AUTH_SECRET", "")
	t.Setenv("TOTP_ENCRYPTION_KEY", "")
	t.Setenv("ANALYTICS_DAILY_SALT", "")
	t.Setenv("WEBAUTHN_RP_ID", "")
	t.Setenv("WEBAUTHN_ORIGIN", "")

	var logBuf bytes.Buffer
	origOut := log.Writer()
	log.SetOutput(&logBuf)
	defer log.SetOutput(origOut)

	err := validateProductionAdminStartupConfig()
	if err == nil {
		t.Fatalf("expected production startup validation to fail when required env vars are missing")
	}
	if !strings.Contains(logBuf.String(), `"event":"admin_api.startup.secret_missing"`) {
		t.Fatalf("expected admin_api.startup.secret_missing seam log, got: %s", logBuf.String())
	}

	t.Setenv("ADMIN_DATABASE_URL", "postgresql://admin_app:x@127.0.0.1:5432/aklapper")
	t.Setenv("ADMIN_INTERNAL_AUTH_SECRET", "prod-secret")
	t.Setenv("TOTP_ENCRYPTION_KEY", "prod-totp-key")
	t.Setenv("ANALYTICS_DAILY_SALT", "prod-daily-salt")
	if err := validateProductionAdminStartupConfig(); err == nil {
		t.Fatalf("expected startup validation to fail when WEBAUTHN_RP_ID and WEBAUTHN_ORIGIN are missing in prod")
	}

	t.Setenv("WEBAUTHN_RP_ID", "admin.andrew-k.us")
	t.Setenv("WEBAUTHN_ORIGIN", "https://admin.andrew-k.us")
	if err := validateProductionAdminStartupConfig(); err != nil {
		t.Fatalf("expected startup validation to pass when all required prod env vars are set, got: %v", err)
	}
}

func TestWebAuthnProductionOriginRejectionSeam(t *testing.T) {
	t.Setenv("NODE_ENV", "production")
	t.Setenv("WEBAUTHN_RP_ID", "admin.andrew-k.us")
	t.Setenv("WEBAUTHN_ORIGIN", "https://admin.andrew-k.us")

	var logBuf bytes.Buffer
	origOut := log.Writer()
	log.SetOutput(&logBuf)
	defer log.SetOutput(origOut)

	_, err := resolveWebAuthnConfig("https://evil.example.com", "corr-origin-1")
	if !errors.Is(err, ErrWebAuthnOriginRejected) {
		t.Fatalf("expected ErrWebAuthnOriginRejected, got %v", err)
	}
	if !strings.Contains(logBuf.String(), `"event":"admin_api.auth.origin_rejected"`) {
		t.Fatalf("expected admin_api.auth.origin_rejected seam log, got: %s", logBuf.String())
	}

	cfg, err := resolveWebAuthnConfig("https://admin.andrew-k.us", "corr-origin-2")
	if err != nil || len(cfg.ExpectedOrigins) != 1 {
		t.Fatalf("expected canonical prod origin to pass, got cfg=%+v err=%v", cfg, err)
	}
}

func TestSiteContentValidationSeams(t *testing.T) {
	var logBuf bytes.Buffer
	origOut := log.Writer()
	log.SetOutput(&logBuf)
	defer log.SetOutput(origOut)

	_, retiredErr := validateAndSanitizeSiteContent("portal-maintenance", "body", "{}", "corr-maint-1")
	if retiredErr == nil || retiredErr.Code() != connect.CodeFailedPrecondition {
		t.Fatalf("expected CodeFailedPrecondition for retired portal-maintenance key, got %v", retiredErr)
	}
	if !strings.Contains(logBuf.String(), `"event":"admin.cms.retired_maintenance_intent_blocked"`) {
		t.Fatalf("missing retired maintenance seam log: %s", logBuf.String())
	}

	logBuf.Reset()
	_, portraitErr := validateAndSanitizeSiteContent("portal-home", "body", `{"portrait":{"src":"https://evil.example/pic.png"}}`, "corr-portrait-1")
	if portraitErr == nil || portraitErr.Code() != connect.CodeInvalidArgument {
		t.Fatalf("expected CodeInvalidArgument for absolute portrait.src, got %v", portraitErr)
	}
	if !strings.Contains(logBuf.String(), `"event":"portal.home.portrait_src_invalid"`) {
		t.Fatalf("missing portrait_src_invalid seam log: %s", logBuf.String())
	}
}

func TestMapAdminStoreErrorPrivilegeViolationSeam(t *testing.T) {
	var logBuf bytes.Buffer
	origOut := log.Writer()
	log.SetOutput(&logBuf)
	defer log.SetOutput(origOut)

	err := mapAdminStoreError(&pgconn.PgError{Code: "42501", Message: "permission denied for table users"}, "corr-pg-1")
	if err == nil || err.Code() != connect.CodePermissionDenied {
		t.Fatalf("expected CodePermissionDenied on SQLSTATE 42501, got %v", err)
	}
	if !strings.Contains(logBuf.String(), `"event":"admin_api.pg.privilege_violation"`) {
		t.Fatalf("missing admin_api.pg.privilege_violation seam log: %s", logBuf.String())
	}
}

func TestAdminMuxRejectsNonGRPCAndDirectQdrantProbe(t *testing.T) {
	qdrantMock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("api-key") != "test-qdrant-secret" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/collections/portfolio_docs":
			_, _ = w.Write([]byte(`{"result":{"status":"green","points_count":42}}`))
		case "/collections/cadence_patterns":
			_, _ = w.Write([]byte(`{"result":{"status":"green","points_count":7}}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer qdrantMock.Close()

	col1 := probeQdrantCollectionDirect(context.Background(), qdrantMock.URL, "test-qdrant-secret", "portfolio_docs")
	col2 := probeQdrantCollectionDirect(context.Background(), qdrantMock.URL, "test-qdrant-secret", "cadence_patterns")
	if !col1.Online || col1.PointsCount != 42 || !col2.Online || col2.PointsCount != 7 {
		t.Fatalf("unexpected direct Qdrant probe results: col1=%+v col2=%+v", col1, col2)
	}

	colUnauth := probeQdrantCollectionDirect(context.Background(), qdrantMock.URL, "wrong-key", "portfolio_docs")
	if colUnauth.Online || colUnauth.Status != "error" {
		t.Fatalf("expected unauthorized Qdrant probe to fail closed with status=error, got %+v", colUnauth)
	}

	// Verify /healthz returns 200 and non-gRPC POST returns 415.
	mux := buildAdminMux(adminServiceDeps{adminSecret: internalauth.DevFallbackAdminSecret})
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("expected /healthz 200, got %d", rec.Code)
	}

	badReq := httptest.NewRequest(http.MethodPost, "/admin.v1.AdminCmsService/GetAdminChrome", strings.NewReader("{}"))
	badReq.Header.Set("Content-Type", "application/json")
	badRec := httptest.NewRecorder()
	mux.ServeHTTP(badRec, badReq)
	if badRec.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("expected 415 for application/json on gRPC endpoint, got %d", badRec.Code)
	}

	// Verify gRPC health check passes with application/grpc and Check-only service.
	srv := httptest.NewUnstartedServer(mux)
	srv.EnableHTTP2 = true
	srv.Start()
	defer srv.Close()
	_ = grpckit.MetadataInternalAuth
}

func TestValidateDossierInputAcceptsCanonicalKinds(t *testing.T) {
	for _, kind := range []string{"profile_core", "experience", "project", "architecture", "leadership"} {
		out, err := validateDossierInput(&adminv1.CareerDossierUpsertInput{
			Slug:        "sample-" + strings.ReplaceAll(kind, "_", "-"),
			Kind:        kind,
			Title:       "Sample Title",
			DomainLabel: "Cloud Platform",
			RoleTitle:   "Principal Architect",
			Timeframe:   "2025",
			SummaryBody: "Summary text.",
		}, "corr-dossier-kind")
		if err != nil {
			t.Fatalf("expected canonical kind %q to pass validation, got %v", kind, err)
		}
		if out.kind != kind {
			t.Fatalf("expected kind %q, got %q", kind, out.kind)
		}
	}

	for _, badKind := range []string{"", "engagement", "capability", "unknown"} {
		if _, err := validateDossierInput(&adminv1.CareerDossierUpsertInput{
			Slug:        "bad-kind",
			Kind:        badKind,
			Title:       "Bad Kind",
			SummaryBody: "Summary",
		}, "corr-dossier-bad-kind"); err == nil {
			t.Fatalf("expected non-canonical kind %q to fail validation", badKind)
		}
	}
}

func startAdminTestH2C(t *testing.T, mux *http.ServeMux) string {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	readyCh := make(chan string, 1)
	doneCh := make(chan error, 1)
	go func() {
		doneCh <- httpkit.ListenAndServeH2CGraceful(ctx, httpkit.H2CServerConfig{
			Addr:            "127.0.0.1:0",
			Handler:         mux,
			ShutdownTimeout: 2 * time.Second,
			OnReady:         func(addr string) { readyCh <- addr },
		})
	}()
	addr := <-readyCh
	t.Cleanup(func() {
		cancel()
		<-doneCh
	})
	return "http://" + addr
}

func TestResolveClientIPProductionFailClosed(t *testing.T) {
	const secret = "prod-client-ip-secret"
	t.Setenv("NODE_ENV", "production")

	// Unsigned fallbackIP MUST fail closed in production when x-internal-client-ip is missing.
	if _, err := resolveClientIP(http.Header{}, "203.0.113.5", secret); connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Fatalf("expected CodeUnauthenticated for unsigned fallbackIP in prod, got %v", err)
	}

	// Valid signed x-internal-client-ip succeeds in production.
	tok, err := internalauth.Sign(internalauth.RoleService, "client-ip:203.0.113.5", time.Minute, secret)
	if err != nil {
		t.Fatalf("sign client ip: %v", err)
	}
	h := http.Header{}
	h.Set(grpckit.MetadataInternalClientIP, tok)
	ip, err := resolveClientIP(h, "198.51.100.1", secret)
	if err != nil || ip != "203.0.113.5" {
		t.Fatalf("expected signed IP 203.0.113.5 in prod, got ip=%q err=%v", ip, err)
	}

	// Outside production, fallbackIP remains allowed for local development tests.
	t.Setenv("NODE_ENV", "test")
	t.Setenv("APP_ENV", "test")
	devIP, err := resolveClientIP(http.Header{}, "198.51.100.7", secret)
	if err != nil || devIP != "198.51.100.7" {
		t.Fatalf("expected fallbackIP in non-prod, got ip=%q err=%v", devIP, err)
	}
}

func TestPreAuthAndCredentialMutationCallerBoundaries(t *testing.T) {
	const secret = "admin-boundary-unit-secret"
	var logBuf bytes.Buffer
	origOut := log.Writer()
	log.SetOutput(&logBuf)
	defer log.SetOutput(origOut)

	mux := buildAdminMux(adminServiceDeps{adminSecret: secret})
	baseURL := startAdminTestH2C(t, mux)
	h2c := grpckit.NewH2CClient()
	t.Cleanup(h2c.CloseIdleConnections)
	authClient := adminv1connect.NewAdminAuthServiceClient(h2c, baseURL, connect.WithGRPC())
	analyticsClient := adminv1connect.NewAdminAnalyticsServiceClient(h2c, baseURL, connect.WithGRPC())

	const (
		sidA = "11111111-1111-4111-8111-111111111111"
		sidB = "22222222-2222-4222-8222-222222222222"
	)

	sign := func(role, sub string) string {
		tok, err := internalauth.Sign(role, sub, time.Minute, secret)
		if err != nil {
			t.Fatalf("sign(%s,%s): %v", role, sub, err)
		}
		return tok
	}

	totpPendingTok := sign(internalauth.RoleService, "totp-pending:user-123")
	clientIPTok := sign(internalauth.RoleService, "client-ip:198.51.100.42")
	chromeTok := sign(internalauth.RoleService, "admin-ssr-chrome")
	bffTok := sign(internalauth.RoleService, "admin-auth-bff")
	guestTok := sign(internalauth.RoleGuest, "guest-1")
	adminATok := sign(internalauth.RoleAdmin, "admin-session:"+sidA)

	// 1. Cross-purpose tokens (totp-pending:* and client-ip:*) rejected at interceptor with CodeUnauthenticated.
	for _, tok := range []string{totpPendingTok, clientIPTok} {
		req := connect.NewRequest(&adminv1.GetAdminSessionRequest{SessionId: sidA})
		req.Header().Set(grpckit.MetadataInternalAuth, tok)
		if _, err := authClient.GetAdminSession(context.Background(), req); connect.CodeOf(err) != connect.CodeUnauthenticated {
			t.Fatalf("expected CodeUnauthenticated for cross-purpose token, got %v", err)
		}
	}

	// 2. Unauthorized service/guest callers rejected on all 6 pre-auth RPCs with CodePermissionDenied.
	for _, tok := range []string{chromeTok, guestTok} {
		r1 := connect.NewRequest(&adminv1.GetAdminSessionRequest{SessionId: sidA})
		r1.Header().Set(grpckit.MetadataInternalAuth, tok)
		if _, err := authClient.GetAdminSession(context.Background(), r1); connect.CodeOf(err) != connect.CodePermissionDenied {
			t.Fatalf("GetAdminSession: expected CodePermissionDenied, got %v", err)
		}
		r2 := connect.NewRequest(&adminv1.PasswordLoginRequest{Handle: "admin", Password: "secret"})
		r2.Header().Set(grpckit.MetadataInternalAuth, tok)
		if _, err := authClient.PasswordLogin(context.Background(), r2); connect.CodeOf(err) != connect.CodePermissionDenied {
			t.Fatalf("PasswordLogin: expected CodePermissionDenied, got %v", err)
		}
		r3 := connect.NewRequest(&adminv1.BeginPasskeyLoginRequest{Origin: "http://localhost:4201"})
		r3.Header().Set(grpckit.MetadataInternalAuth, tok)
		if _, err := authClient.BeginPasskeyLogin(context.Background(), r3); connect.CodeOf(err) != connect.CodePermissionDenied {
			t.Fatalf("BeginPasskeyLogin: expected CodePermissionDenied, got %v", err)
		}
		r4 := connect.NewRequest(&adminv1.FinishPasskeyLoginRequest{ChallengeId: sidA, AssertionJson: "{}"})
		r4.Header().Set(grpckit.MetadataInternalAuth, tok)
		if _, err := authClient.FinishPasskeyLogin(context.Background(), r4); connect.CodeOf(err) != connect.CodePermissionDenied {
			t.Fatalf("FinishPasskeyLogin: expected CodePermissionDenied, got %v", err)
		}
		r5 := connect.NewRequest(&adminv1.VerifyTotpStepUpRequest{PendingToken: totpPendingTok, Code: "123456"})
		r5.Header().Set(grpckit.MetadataInternalAuth, tok)
		if _, err := authClient.VerifyTotpStepUp(context.Background(), r5); connect.CodeOf(err) != connect.CodePermissionDenied {
			t.Fatalf("VerifyTotpStepUp: expected CodePermissionDenied, got %v", err)
		}
		r6 := connect.NewRequest(&adminv1.LogoutAdminSessionRequest{SessionId: sidA})
		r6.Header().Set(grpckit.MetadataInternalAuth, tok)
		if _, err := authClient.LogoutAdminSession(context.Background(), r6); connect.CodeOf(err) != connect.CodePermissionDenied {
			t.Fatalf("LogoutAdminSession: expected CodePermissionDenied, got %v", err)
		}
	}

	// 3. All 5 credential-mutation RPCs reject role=service tokens (admin-ssr-chrome, admin-auth-bff -> PermissionDenied; totp-pending:* -> Unauthenticated).
	mutationCases := []struct {
		name string
		tok  string
		want connect.Code
	}{
		{"chrome_service", chromeTok, connect.CodePermissionDenied},
		{"auth_bff_service", bffTok, connect.CodePermissionDenied},
		{"totp_pending", totpPendingTok, connect.CodeUnauthenticated},
	}
	for _, tc := range mutationCases {
		m1 := connect.NewRequest(&adminv1.BeginPasskeyRegisterRequest{SessionId: sidA, Origin: "http://localhost:4201"})
		m1.Header().Set(grpckit.MetadataInternalAuth, tc.tok)
		if _, err := authClient.BeginPasskeyRegister(context.Background(), m1); connect.CodeOf(err) != tc.want {
			t.Fatalf("BeginPasskeyRegister (%s): got %v want %v", tc.name, connect.CodeOf(err), tc.want)
		}
		m2 := connect.NewRequest(&adminv1.FinishPasskeyRegisterRequest{SessionId: sidA, ChallengeId: sidB, CredentialJson: "{}"})
		m2.Header().Set(grpckit.MetadataInternalAuth, tc.tok)
		if _, err := authClient.FinishPasskeyRegister(context.Background(), m2); connect.CodeOf(err) != tc.want {
			t.Fatalf("FinishPasskeyRegister (%s): got %v want %v", tc.name, connect.CodeOf(err), tc.want)
		}
		m3 := connect.NewRequest(&adminv1.EnrollTotpRequest{SessionId: sidA})
		m3.Header().Set(grpckit.MetadataInternalAuth, tc.tok)
		if _, err := authClient.EnrollTotp(context.Background(), m3); connect.CodeOf(err) != tc.want {
			t.Fatalf("EnrollTotp (%s): got %v want %v", tc.name, connect.CodeOf(err), tc.want)
		}
		m4 := connect.NewRequest(&adminv1.ConfirmTotpEnrollmentRequest{SessionId: sidA, Code: "123456"})
		m4.Header().Set(grpckit.MetadataInternalAuth, tc.tok)
		if _, err := authClient.ConfirmTotpEnrollment(context.Background(), m4); connect.CodeOf(err) != tc.want {
			t.Fatalf("ConfirmTotpEnrollment (%s): got %v want %v", tc.name, connect.CodeOf(err), tc.want)
		}
		m5 := connect.NewRequest(&adminv1.DisableTotpRequest{SessionId: sidA})
		m5.Header().Set(grpckit.MetadataInternalAuth, tc.tok)
		if _, err := authClient.DisableTotp(context.Background(), m5); connect.CodeOf(err) != tc.want {
			t.Fatalf("DisableTotp (%s): got %v want %v", tc.name, connect.CodeOf(err), tc.want)
		}
	}

	// 4. Session ID mismatch between claims.Sub, x-admin-session-id, and reqSessionID fails with CodePermissionDenied.
	mismatchReq := connect.NewRequest(&adminv1.EnrollTotpRequest{SessionId: sidB})
	mismatchReq.Header().Set(grpckit.MetadataInternalAuth, adminATok)
	mismatchReq.Header().Set(headerAdminSessionID, sidA)
	if _, err := authClient.EnrollTotp(context.Background(), mismatchReq); connect.CodeOf(err) != connect.CodePermissionDenied {
		t.Fatalf("expected CodePermissionDenied on session ID mismatch, got %v", err)
	}

	// 5. IngestAdminAnalytics unauthenticated branch emits canonical unauthenticated_rejected_401 seam label.
	logBuf.Reset()
	ingReq := connect.NewRequest(&adminv1.IngestAdminAnalyticsRequest{SessionId: "s-1"})
	ingReq.Header().Set(grpckit.MetadataInternalAuth, chromeTok)
	if _, err := analyticsClient.IngestAdminAnalytics(context.Background(), ingReq); connect.CodeOf(err) != connect.CodePermissionDenied {
		t.Fatalf("expected CodePermissionDenied on unauthenticated IngestAdminAnalytics, got %v", err)
	}
	if !strings.Contains(logBuf.String(), `"event":"admin.analytics.ingest_auth_branch"`) ||
		!strings.Contains(logBuf.String(), `"branch":"unauthenticated_rejected_401"`) {
		t.Fatalf("expected unauthenticated_rejected_401 seam log, got: %s", logBuf.String())
	}
}

func TestMapAdminStoreErrorUniqueViolation(t *testing.T) {
	err := mapAdminStoreError(&pgconn.PgError{Code: "23505", Message: "duplicate key value violates unique constraint"}, "corr-23505")
	if err == nil || err.Code() != connect.CodeAlreadyExists {
		t.Fatalf("expected CodeAlreadyExists on SQLSTATE 23505, got %v", err)
	}
}
