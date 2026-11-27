package main

import (
	"bytes"
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/agensi"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	commonv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/common/v1"
	portalv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1/portalv1connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/jackc/pgx/v5/pgconn"
)

type panicRoundTripper struct{}

func (panicRoundTripper) RoundTrip(*http.Request) (*http.Response, error) {
	panic("simulated agensi transport panic")
}

func extractDetailEnvelope(t *testing.T, err error) *commonv1.ErrorDetailEnvelope {
	t.Helper()
	var cErr *connect.Error
	if !errors.As(err, &cErr) {
		t.Fatalf("expected *connect.Error, got %T: %v", err, err)
	}
	for _, det := range cErr.Details() {
		if val, decErr := det.Value(); decErr == nil {
			if env, ok := val.(*commonv1.ErrorDetailEnvelope); ok {
				return env
			}
		}
	}
	t.Fatalf("missing ErrorDetailEnvelope in %v", cErr)
	return nil
}

func TestAgensiSingleflightPanicRecoveryAndLoadBranchSeams(t *testing.T) {
	var logBuf bytes.Buffer
	origOut := log.Writer()
	log.SetOutput(&logBuf)
	t.Cleanup(func() { log.SetOutput(origOut) })

	srv := newAgensiServiceServer(portalServiceDeps{
		store:            pg.NewMemoryStore(),
		agensiHTTPClient: &http.Client{Transport: panicRoundTripper{}},
		nowFn:            func() time.Time { return time.Date(2026, 11, 27, 12, 0, 0, 0, time.UTC) },
	})

	cfg := agensi.Config{
		BaseURL:        "https://www.agensi.io",
		APIPath:        "/creators/aklapper",
		CreatorHandle:  "aklapper",
		TimeoutMs:      1000,
		MaxPages:       1,
		AllowedOrigins: agensi.DefaultAllowedOrigins,
	}

	_, err := srv.runSingleflightSync(context.Background(), cfg, true, "corr-panic-1")
	if err == nil {
		t.Fatal("expected recovered panic to return non-nil error without crashing process")
	}
	if strings.Contains(err.Error(), "simulated agensi transport panic") {
		t.Fatalf("expected sanitized panic recovery error, got %q", err.Error())
	}

	// Ensure inFlight entry was cleaned up cleanly so subsequent calls do not deadlock.
	srv.mu.Lock()
	remaining := len(srv.inFlight)
	srv.mu.Unlock()
	if remaining != 0 {
		t.Fatalf("expected inFlight map empty after panic recovery, got %d", remaining)
	}

	emitAgensiLoadBranch("cache_hit", map[string]any{"correlationId": "corr-ag-branch"})

	logs := logBuf.String()
	for _, expected := range []string{
		`"event":"agensi.sync.panic_recovered"`,
		`"event":"agensi.catalog.load_branch"`,
		`"branch_taken":"cache_hit"`,
	} {
		if !strings.Contains(logs, expected) {
			t.Fatalf("expected seam log %s in:\n%s", expected, logs)
		}
	}
}

func TestStoreErrorMappingSeededContentInternalAndPrivilegeSeam(t *testing.T) {
	var logBuf bytes.Buffer
	origOut := log.Writer()
	log.SetOutput(&logBuf)
	t.Cleanup(func() { log.SetOutput(origOut) })

	for _, sentinel := range []error{
		pg.ErrSiteContentMissing,
		pg.ErrTerminalProfileMissing,
		pg.ErrCadencePresetsEmpty,
	} {
		cErr := mapStoreErrorToConnect(sentinel, "corr-seed-500")
		if connect.CodeOf(cErr) != connect.CodeInternal {
			t.Fatalf("expected CodeInternal for %v, got %v", sentinel, connect.CodeOf(cErr))
		}
		env := extractDetailEnvelope(t, cErr)
		if env.GetError().GetCode() != contracts.ErrCodeInternal || env.GetError().GetStatus() != http.StatusInternalServerError {
			t.Fatalf("expected 500 ERR_INTERNAL envelope for %v, got %+v", sentinel, env.GetError())
		}
	}

	privErr := mapStoreErrorToConnect(&pgconn.PgError{Code: "42501"}, "corr-priv-403")
	if connect.CodeOf(privErr) != connect.CodePermissionDenied {
		t.Fatalf("expected CodePermissionDenied for SQLSTATE 42501, got %v", connect.CodeOf(privErr))
	}
	if !strings.Contains(logBuf.String(), `"event":"portal_app.privilege.boundary_denied"`) {
		t.Fatalf("expected portal_app.privilege.boundary_denied seam log, got:\n%s", logBuf.String())
	}
}

func TestGetAskContentGuestOwnershipAndLiveSeams(t *testing.T) {
	const testSecret = "ask-ownership-test-secret-0123456789"
	contentSrv := newContentServiceServer(portalServiceDeps{
		store:             pg.NewMemoryStore(),
		explicitSecret:    testSecret,
		explicitDailySalt: "unit-daily-salt",
	})
	// Missing seeded content maps to CodeInternal (500 ERR_INTERNAL).
	_, missingErr := contentSrv.GetAskContent(context.Background(), connect.NewRequest(&portalv1.GetAskContentRequest{}))
	if connect.CodeOf(missingErr) != connect.CodeInternal {
		t.Fatalf("expected CodeInternal when portal-ask content is missing, got %v", connect.CodeOf(missingErr))
	}

	portalDSN := strings.TrimSpace(os.Getenv("PORTAL_DATABASE_URL"))
	if portalDSN == "" {
		return
	}
	store, err := pg.OpenLazyPool(context.Background(), portalDSN, 2, true)
	if err != nil {
		t.Fatalf("OpenLazyPool portal_app: %v", err)
	}
	t.Cleanup(store.Close)

	var logBuf bytes.Buffer
	origOut := log.Writer()
	log.SetOutput(&logBuf)
	t.Cleanup(func() { log.SetOutput(origOut) })

	t.Setenv("ANALYTICS_INGEST_RATE_LIMIT_MAX", "1")
	ts := startTestH2CServer(t, portalServiceDeps{
		store:             store,
		explicitSecret:    testSecret,
		explicitDailySalt: "live-seams-salt",
		nowFn:             func() time.Time { return time.Date(2026, 11, 27, 15, 0, 0, 0, time.UTC) },
	})

	h2cClient := grpckit.NewH2CClient()
	guestClient := portalv1connect.NewPortalContentServiceClient(
		h2cClient,
		ts.URL,
		connect.WithGRPC(),
		connect.WithInterceptors(grpckit.NewClientAuthInterceptor(grpckit.ClientAuthConfig{
			Role: internalauth.RoleGuest, Subject: "guest_owner_123", Secret: testSecret,
		})),
	)
	if _, err := guestClient.GetAskContent(context.Background(), connect.NewRequest(&portalv1.GetAskContentRequest{
		SessionId: "guest_other_456",
	})); connect.CodeOf(err) != connect.CodePermissionDenied {
		t.Fatalf("expected CodePermissionDenied for mismatched guest session_id, got %v", err)
	}
	if _, err := guestClient.GetAboutContent(context.Background(), connect.NewRequest(&portalv1.GetAboutContentRequest{})); err != nil {
		t.Fatalf("GetAboutContent failed: %v", err)
	}

	svcAnalytics := portalv1connect.NewAnalyticsServiceClient(
		h2cClient,
		ts.URL,
		connect.WithGRPC(),
		connect.WithInterceptors(grpckit.NewClientAuthInterceptor(grpckit.ClientAuthConfig{
			Role: internalauth.RoleService, Subject: "portal-seams", Secret: testSecret,
		})),
	)
	const probeIP = "198.51.100.219"
	for i := 0; i < 2; i++ {
		req := connect.NewRequest(&portalv1.IngestAnalyticsRequest{
			SessionId: "sess_rl_seam",
			Events: []*portalv1.AnalyticsEvent{{
				Type: "interaction", Name: "rl_probe", Path: "/about",
				Timestamp: time.Date(2026, 11, 27, 15, 0, 0, 0, time.UTC).Format(time.RFC3339Nano),
			}},
		})
		req.Header().Set(grpckit.MetadataInternalClientIP, signClientIPToken(t, probeIP, testSecret))
		_, err := svcAnalytics.IngestAnalytics(context.Background(), req)
		if i == 1 && connect.CodeOf(err) != connect.CodeResourceExhausted {
			t.Fatalf("expected CodeResourceExhausted on second ingest with max=1, got %v", err)
		}
	}

	logs := logBuf.String()
	for _, expected := range []string{
		`"event":"portal.about.loader_source_branch"`,
		`"event":"analytics.ingest.rate_limit_branch"`,
		`"branch":"rate_limited_429"`,
	} {
		if !strings.Contains(logs, expected) {
			t.Fatalf("expected live seam log %s in:\n%s", expected, logs)
		}
	}
}

func TestAnalyticsBotClassificationRateLimitPayloadRejectedAndContactSeams(t *testing.T) {
	const testSecret = "unit-seams-secret-value-0123456789"
	const testSalt = "unit-seams-salt-2026"
	const rawIP = "198.51.100.88"

	var logBuf bytes.Buffer
	origOut := log.Writer()
	log.SetOutput(&logBuf)
	t.Cleanup(func() { log.SetOutput(origOut) })

	now := time.Date(2026, 11, 27, 14, 0, 0, 0, time.UTC)
	deps := portalServiceDeps{
		store:             pg.NewMemoryStore(),
		explicitSecret:    testSecret,
		explicitDailySalt: testSalt,
		nowFn:             func() time.Time { return now },
	}
	analyticsSrv := newAnalyticsServiceServer(deps)

	// 1. Trigger payload_rejected seam.
	badReq := connect.NewRequest(&portalv1.IngestAnalyticsRequest{SessionId: "", Events: nil})
	badReq.Header().Set(grpckit.MetadataInternalClientIP, signClientIPToken(t, rawIP, testSecret))
	if _, err := analyticsSrv.IngestAnalytics(context.Background(), badReq); connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("expected CodeInvalidArgument, got %v", err)
	}

	// 2. Trigger bot_classification_branch (human, bot_isbot, bot_headless_or_missing_ua) + rate_limit_branch (allowed).
	for _, ua := range []string{
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/131.0.0.0 Safari/537.36",
		"Googlebot/2.1 (+http://www.google.com/bot.html)",
		"curl/8.7.1",
	} {
		req := connect.NewRequest(&portalv1.IngestAnalyticsRequest{
			SessionId: "sess_bot_seam",
			Events: []*portalv1.AnalyticsEvent{{
				Type:      "page_view",
				Name:      "portal_page_view",
				Path:      "/",
				Timestamp: now.Format(time.RFC3339Nano),
			}},
			ClientContext: &portalv1.ClientRequestContext{UserAgent: ua},
		})
		req.Header().Set(grpckit.MetadataInternalClientIP, signClientIPToken(t, rawIP, testSecret))
		if _, err := analyticsSrv.IngestAnalytics(context.Background(), req); err != nil {
			t.Fatalf("IngestAnalytics(%q) failed: %v", ua, err)
		}
	}

	// 3. Contact NUL byte validation rejects message/name/email/phone with fieldErrors.
	badPhone := "+1555\x001234"
	_, nulErrs := validateContactRequest(contactFormDefinition{}, &portalv1.SubmitContactRequest{
		Name:    "Ada\x00Lovelace",
		Phone:   &badPhone,
		Email:   "ada\x00@example.com",
		Message: "Valid length message with embedded\x00nul byte.",
	})
	for _, field := range []string{"name", "phone", "email", "message"} {
		if len(nulErrs[field]) == 0 {
			t.Fatalf("expected NUL rejection fieldError for %q, got %+v", field, nulErrs)
		}
	}

	// 4. Contact FK 23503 retry emits portal.contact.analytics_link_failed + portal.contact.analytics_link_committed.
	sessID := "sess_fk_1"
	finalizeContactAnalyticsLink(
		context.Background(),
		deps.store,
		"sub-123",
		pg.ContactLinkResult{
			AnalyticsSessionID: &sessID,
			LinkMethod:         pg.LinkMethodVerifiedClient,
		},
		true,
		"corr-fk-retry",
		now,
	)

	logs := logBuf.String()
	for _, expected := range []string{
		`"event":"analytics.ingest.payload_rejected"`,
		`"event":"analytics.ingest.rate_limit_branch"`,
		`"branch":"allowed"`,
		`"event":"analytics.ingest.bot_classification_branch"`,
		`"branch":"human"`,
		`"branch":"bot_isbot"`,
		`"branch":"bot_headless_or_missing_ua"`,
		`"event":"portal.contact.analytics_link_failed"`,
		`"reason":"fk_23503_retry_null"`,
		`"event":"portal.contact.analytics_link_committed"`,
		`"linkMethod":"fail_open_null"`,
	} {
		if !strings.Contains(logs, expected) {
			t.Fatalf("expected seam log %s in:\n%s", expected, logs)
		}
	}
	if strings.Contains(logs, rawIP) || strings.Contains(logs, "Googlebot/2.1") || strings.Contains(logs, "curl/8.7.1") {
		t.Fatalf("raw IP or User-Agent leaked into seam logs:\n%s", logs)
	}
}
