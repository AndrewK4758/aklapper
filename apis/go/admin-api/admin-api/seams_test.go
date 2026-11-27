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

	"connectrpc.com/connect"
	adminv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestValidateProductionAdminStartupConfigFailsClosed(t *testing.T) {
	t.Setenv("NODE_ENV", "production")
	t.Setenv("ADMIN_DATABASE_URL", "")
	t.Setenv("ADMIN_INTERNAL_AUTH_SECRET", "")
	t.Setenv("TOTP_ENCRYPTION_KEY", "")
	t.Setenv("ANALYTICS_DAILY_SALT", "")

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
