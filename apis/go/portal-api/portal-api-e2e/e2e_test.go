package portalapi_e2e_test

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"connectrpc.com/connect"
	commonv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/common/v1"
	portalv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1/portalv1connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit/e2etest"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/jackc/pgx/v5"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
)

func requirePortalDatabaseURL(t *testing.T) string {
	t.Helper()
	dsn := strings.TrimSpace(os.Getenv("PORTAL_DATABASE_URL"))
	if dsn == "" {
		t.Fatal("PORTAL_DATABASE_URL must be set for portal-api-e2e (live PG19 portal_app)")
	}
	return dsn
}

func signClientIP(t *testing.T, ip, secret string) string {
	t.Helper()
	tok, err := internalauth.Sign(internalauth.RoleService, "client-ip:"+ip, time.Minute, secret)
	if err != nil {
		t.Fatalf("sign client IP: %v", err)
	}
	return tok
}

func extractErrorDetail(t *testing.T, err error) *commonv1.ErrorDetailEnvelope {
	t.Helper()
	var cErr *connect.Error
	if !errors.As(err, &cErr) {
		t.Fatalf("expected *connect.Error, got %T: %v", err, err)
	}
	for _, det := range cErr.Details() {
		v, decErr := det.Value()
		if decErr == nil {
			if env, ok := v.(*commonv1.ErrorDetailEnvelope); ok {
				return env
			}
		}
	}
	t.Fatalf("missing ErrorDetailEnvelope in connect error: %v", cErr)
	return nil
}

func TestPortalAPIEndToEndLivePG19(t *testing.T) {
	portalDSN := requirePortalDatabaseURL(t)
	adminDSN := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	const testSecret = "portal-api-e2e-internal-auth-secret-0123456789"
	const testSalt = "portal-api-e2e-daily-salt"

	// Mock Agensi upstream server supporting live TSR/JSON storefront + outage toggle.
	var agensiFail atomic.Bool
	mockAgensi := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if agensiFail.Load() {
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte("upstream down"))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("ETag", `"e2e-v1"`)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"items": []map[string]any{
				{
					"slug":          "e2e-live-skill",
					"name":          "E2E Live Skill",
					"summary":       "Verified from Go portal-api E2E mock storefront.",
					"tags":          []string{"go", "grpc"},
					"url":           "https://agensi.io/skills/e2e-live-skill",
					"sortOrder":     1,
					"creatorHandle": "aklapper",
					"isPublished":   true,
				},
				{
					"slug":          "foreign-creator-skill",
					"name":          "Foreign Skill",
					"summary":       "Must be excluded by creatorHandle filter.",
					"tags":          []string{"foreign"},
					"url":           "https://agensi.io/skills/foreign-creator-skill",
					"sortOrder":     2,
					"creatorHandle": "other-creator",
					"isPublished":   true,
				},
			},
		})
	}))
	t.Cleanup(mockAgensi.Close)

	baseURL := e2etest.StartBinary(
		t,
		"../portal-api",
		"PORTAL_DATABASE_URL="+portalDSN,
		"DATABASE_URL=",
		"INTERNAL_AUTH_SECRET="+testSecret,
		"ANALYTICS_DAILY_SALT="+testSalt,
		"ANALYTICS_INGEST_RATE_LIMIT_MAX=5",
		"CONTACT_RATE_LIMIT_MAX=3",
		"AGENSI_API_BASE_URL="+mockAgensi.URL,
		"AGENSI_API_PATH=/creators/aklapper",
		"AGENSI_CREATOR_HANDLE=aklapper",
		"AGENSI_CACHE_TTL_SECONDS=60",
		"AGENSI_FETCH_TIMEOUT_MS=1000",
	)

	// 1. Health endpoints (/health, /healthz, /grpc.health.v1.Health/Check)
	t.Run("Health probes succeed over HTTP and gRPC h2c", func(t *testing.T) {
		res, health := e2etest.DoJSON[httpkit.HealthResponse](t, http.MethodGet, baseURL+"/health", nil, nil)
		if res.StatusCode != http.StatusOK || !health.OK || health.Service != "portal-api" {
			t.Fatalf("unexpected /health: status=%d payload=%+v", res.StatusCode, health)
		}
		target := strings.TrimPrefix(baseURL, "http://")
		conn, err := grpc.NewClient(target, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			t.Fatalf("grpc.NewClient: %v", err)
		}
		defer conn.Close()
		hc := healthpb.NewHealthClient(conn)
		hcRes, err := hc.Check(context.Background(), &healthpb.HealthCheckRequest{Service: "portal.v1.PortalContentService"})
		if err != nil || hcRes.GetStatus() != healthpb.HealthCheckResponse_SERVING {
			t.Fatalf("expected SERVING from /grpc.health.v1.Health/Check, got status=%v err=%v", hcRes, err)
		}
	})

	h2cClient := grpckit.NewH2CClient()
	authInterceptor := grpckit.NewClientAuthInterceptor(grpckit.ClientAuthConfig{
		Role:    internalauth.RoleService,
		Subject: "portal-api-e2e",
		Secret:  testSecret,
	})
	clientOpts := []connect.ClientOption{
		connect.WithGRPC(),
		connect.WithInterceptors(authInterceptor),
	}

	contentClient := portalv1connect.NewPortalContentServiceClient(h2cClient, baseURL, clientOpts...)
	agensiClient := portalv1connect.NewAgensiServiceClient(h2cClient, baseURL, clientOpts...)
	analyticsClient := portalv1connect.NewAnalyticsServiceClient(h2cClient, baseURL, clientOpts...)
	contactClient := portalv1connect.NewContactServiceClient(h2cClient, baseURL, clientOpts...)

	// 2. PortalContentService RPCs
	t.Run("PortalContentService loads root, home, about, ask, cadence, and contact", func(t *testing.T) {
		ctx := context.Background()

		rootRes, err := contentClient.GetRootContent(ctx, connect.NewRequest(&portalv1.GetRootContentRequest{}))
		if err != nil {
			t.Fatalf("GetRootContent: %v", err)
		}
		if rootRes.Msg.GetChromeJson() == "" || rootRes.Msg.GetTerminal().GetSlug() != "portal-home" || rootRes.Msg.GetContactFormJson() == "" {
			t.Fatalf("incomplete GetRootContent response")
		}

		homeRes, err := contentClient.GetHomeContent(ctx, connect.NewRequest(&portalv1.GetHomeContentRequest{}))
		if err != nil || homeRes.Msg.GetTerminal() == nil {
			t.Fatalf("GetHomeContent failed: %v", err)
		}

		aboutRes, err := contentClient.GetAboutContent(ctx, connect.NewRequest(&portalv1.GetAboutContentRequest{}))
		if err != nil {
			t.Fatalf("GetAboutContent: %v", err)
		}
		if len(aboutRes.Msg.GetDossiers()) == 0 {
			t.Fatal("expected seeded published career dossiers from GetAboutContent")
		}
		for _, d := range aboutRes.Msg.GetDossiers() {
			if d.GetPublishStatus() != "published" || d.GetSanitizationVerifiedAt() == "" {
				t.Fatalf("unexpected non-published/unverified dossier returned: %+v", d)
			}
		}

		askRes, err := contentClient.GetAskContent(ctx, connect.NewRequest(&portalv1.GetAskContentRequest{
			SessionId: "e2e-guest-ask-session",
		}))
		if err != nil || askRes.Msg.GetQuota().GetMaxTurns() <= 0 {
			t.Fatalf("GetAskContent failed: err=%v quota=%+v", err, askRes)
		}

		cadRes, err := contentClient.GetCadenceContent(ctx, connect.NewRequest(&portalv1.GetCadenceContentRequest{}))
		if err != nil || len(cadRes.Msg.GetPresets()) == 0 {
			t.Fatalf("GetCadenceContent failed: err=%v", err)
		}

		contactRes, err := contentClient.GetContactContent(ctx, connect.NewRequest(&portalv1.GetContactContentRequest{}))
		if err != nil || !strings.Contains(contactRes.Msg.GetContentJson(), "form") {
			t.Fatalf("GetContactContent failed: err=%v", err)
		}
	})

	// 3. AgensiService live sync, creator filtering, cache hit, and outage fallback
	t.Run("AgensiService syncs live creator catalog and falls back cleanly on outage", func(t *testing.T) {
		ctx := context.Background()

		liveRes, err := agensiClient.GetCatalog(ctx, connect.NewRequest(&portalv1.GetCatalogRequest{ForceRefresh: true}))
		if err != nil {
			t.Fatalf("GetCatalog live sync: %v", err)
		}
		if liveRes.Msg.GetCatalogMeta().GetMode() != "live" || len(liveRes.Msg.GetSkills()) != 1 || liveRes.Msg.GetSkills()[0].GetSlug() != "e2e-live-skill" {
			t.Fatalf("unexpected live Agensi catalog: mode=%s skills=%+v", liveRes.Msg.GetCatalogMeta().GetMode(), liveRes.Msg.GetSkills())
		}

		// Subsequent non-forced call hits TTL cache.
		cacheRes, err := agensiClient.GetCatalog(ctx, connect.NewRequest(&portalv1.GetCatalogRequest{ForceRefresh: false}))
		if err != nil || cacheRes.Msg.GetCatalogMeta().GetMode() != "cache" {
			t.Fatalf("expected TTL cache hit, got mode=%v err=%v", cacheRes, err)
		}

		// Upstream outage on forced refresh degrades cleanly to cached_fallback with badge override.
		agensiFail.Store(true)
		fbRes, err := agensiClient.GetCatalog(ctx, connect.NewRequest(&portalv1.GetCatalogRequest{ForceRefresh: true}))
		if err != nil {
			t.Fatalf("GetCatalog fallback failed: %v", err)
		}
		if fbRes.Msg.GetCatalogMeta().GetMode() != "cached_fallback" ||
			len(fbRes.Msg.GetSkills()) != 1 ||
			fbRes.Msg.GetStatusBadgeOverride().GetLabel() != "catalog · cached fallback" {
			t.Fatalf("unexpected fallback catalog: mode=%s badge=%+v skills=%d",
				fbRes.Msg.GetCatalogMeta().GetMode(), fbRes.Msg.GetStatusBadgeOverride(), len(fbRes.Msg.GetSkills()))
		}
	})

	// 4. AnalyticsService: SSR hit + 15s dedup, BindGuestSession, IngestAnalytics, ipHash, 429 rate limit
	t.Run("AnalyticsService persists SSR/client dedup, returns ipHash, and enforces 429 rate limit", func(t *testing.T) {
		ctx := context.Background()
		const visitorIP = "198.51.100.25"
		const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36"

		ssrReq := connect.NewRequest(&portalv1.RecordSsrHitRequest{
			Pathname: "/about",
			ClientContext: &portalv1.ClientRequestContext{
				UserAgent:  ua,
				RequestUrl: "https://andrew-k.us/about?ref=e2e",
			},
		})
		ssrReq.Header().Set(grpckit.MetadataInternalClientIP, signClientIP(t, visitorIP, testSecret))
		ssrRes, err := analyticsClient.RecordSsrHit(ctx, ssrReq)
		if err != nil || ssrRes.Msg.GetSessionId() == "" {
			t.Fatalf("RecordSsrHit failed: res=%v err=%v", ssrRes, err)
		}

		// Client initial page_view within 15s of SSR hit on /about must be deduplicated (accepted == 0).
		dedupReq := connect.NewRequest(&portalv1.IngestAnalyticsRequest{
			SessionId: ssrRes.Msg.GetSessionId(),
			Events: []*portalv1.AnalyticsEvent{{
				Type: "page_view",
				Name: "page_view",
				Path: "/about",
				Metadata: map[string]*portalv1.AnalyticsMetadataValue{
					"navigation": {Kind: &portalv1.AnalyticsMetadataValue_StringValue{StringValue: "initial"}},
				},
				Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
			}},
			ClientContext: &portalv1.ClientRequestContext{UserAgent: ua},
		})
		dedupReq.Header().Set(grpckit.MetadataInternalClientIP, signClientIP(t, visitorIP, testSecret))
		dedupRes, err := analyticsClient.IngestAnalytics(ctx, dedupReq)
		if err != nil {
			t.Fatalf("IngestAnalytics dedup failed: %v", err)
		}
		if dedupRes.Msg.GetAccepted() != 0 || dedupRes.Msg.GetSessionId() != ssrRes.Msg.GetSessionId() || len(dedupRes.Msg.GetIpHash()) != 24 {
			t.Fatalf("expected deduplicated accepted=0 same session + 24-hex ipHash, got %+v", dedupRes.Msg)
		}

		// BindGuestSession converges onto the same session.
		bindReq := connect.NewRequest(&portalv1.BindGuestSessionRequest{
			GuestSessionId: "e2e-bound-guest-1",
			LandingPath:    "/about",
			ClientContext:  &portalv1.ClientRequestContext{UserAgent: ua},
		})
		bindReq.Header().Set(grpckit.MetadataInternalClientIP, signClientIP(t, visitorIP, testSecret))
		bindRes, err := analyticsClient.BindGuestSession(ctx, bindReq)
		if err != nil || bindRes.Msg.GetSessionId() != ssrRes.Msg.GetSessionId() {
			t.Fatalf("BindGuestSession expected same session %q, got %q err=%v", ssrRes.Msg.GetSessionId(), bindRes.Msg.GetSessionId(), err)
		}

		// Trigger ANALYTICS_INGEST_RATE_LIMIT_MAX=5 (already used 1 call above -> 4 more succeed, 6th returns 429).
		var rateLimitErr error
		for i := 0; i < 6; i++ {
			r := connect.NewRequest(&portalv1.IngestAnalyticsRequest{
				SessionId: ssrRes.Msg.GetSessionId(),
				Events: []*portalv1.AnalyticsEvent{{
					Type:      "interaction",
					Name:      "click",
					Path:      "/about",
					Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
				}},
				ClientContext: &portalv1.ClientRequestContext{UserAgent: ua},
			})
			r.Header().Set(grpckit.MetadataInternalClientIP, signClientIP(t, visitorIP, testSecret))
			_, err := analyticsClient.IngestAnalytics(ctx, r)
			if err != nil {
				rateLimitErr = err
				break
			}
		}
		if connect.CodeOf(rateLimitErr) != connect.CodeResourceExhausted {
			t.Fatalf("expected CodeResourceExhausted on 6th analytics ingest, got %v", rateLimitErr)
		}
		env := extractErrorDetail(t, rateLimitErr)
		if env.GetRetryAfterSeconds() <= 0 || env.GetError().GetStatus() != 429 {
			t.Fatalf("expected 429 + retry_after_seconds > 0, got %+v", env)
		}

		// Forged x-internal-client-ip fails closed with CodeUnauthenticated.
		forged := connect.NewRequest(&portalv1.RecordSsrHitRequest{Pathname: "/"})
		forged.Header().Set(grpckit.MetadataInternalClientIP, "forged.token.value")
		if _, err := analyticsClient.RecordSsrHit(ctx, forged); connect.CodeOf(err) != connect.CodeUnauthenticated {
			t.Fatalf("expected CodeUnauthenticated on forged x-internal-client-ip, got %v", err)
		}
	})

	// 5. ContactService: 4.8 MiB attachment (>4 MiB gRPC default), validation field_errors, rate limit
	t.Run("ContactService handles 4.8 MiB raw attachment upload, field_errors, and rate limit", func(t *testing.T) {
		ctx := context.Background()
		const contactIP = "203.0.113.88"

		payload := make([]byte, 4800*1024) // 4.8 MiB (> default 4 MiB gRPC cap, <= 5 MiB file cap)
		copy(payload, []byte("%PDF-1.7\nE2E-TEST-PAYLOAD\n"))
		expectedSum := sha256.Sum256(payload)
		expectedHex := hex.EncodeToString(expectedSum[:])

		req := connect.NewRequest(&portalv1.SubmitContactRequest{
			Name:    "Ada Lovelace",
			Email:   "ada@analytical-engine.org",
			Message: "Testing a 4.8 MiB PDF attachment upload over h2c gRPC as portal_app.",
			Attachment: &portalv1.ContactAttachmentUpload{
				Filename: "architecture-spec.pdf",
				MimeType: "application/pdf",
				Content:  payload,
			},
			ClientContext: &portalv1.ClientRequestContext{
				UserAgent:  "Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0.0.0",
				RequestUrl: "https://andrew-k.us/contact",
			},
		})
		req.Header().Set(grpckit.MetadataInternalClientIP, signClientIP(t, contactIP, testSecret))

		res, err := contactClient.SubmitContact(ctx, req)
		if err != nil {
			t.Fatalf("SubmitContact 4.8 MiB PDF failed: %v", err)
		}
		sub := res.Msg.GetSubmission()
		if sub.GetId() == "" || sub.GetAttachmentSizeBytes() != int32(len(payload)) || sub.GetAttachmentSha256() != expectedHex {
			t.Fatalf("unexpected submission summary: %+v", sub)
		}

		// Verify persisted row via admin DSN if available (portal_app intentionally has ZERO SELECT on contact_submissions!).
		if adminDSN != "" {
			adminConn, err := pgx.Connect(ctx, adminDSN)
			if err != nil {
				t.Fatalf("connect admin DB to verify contact row: %v", err)
			}
			defer adminConn.Close(ctx)
			var storedSHA string
			var storedSize int
			if err := adminConn.QueryRow(
				ctx,
				`SELECT attachment_sha256, attachment_size_bytes FROM contact_submissions WHERE id = $1::uuid`,
				sub.GetId(),
			).Scan(&storedSHA, &storedSize); err != nil {
				t.Fatalf("verify persisted contact row via admin DB: %v", err)
			}
			if storedSHA != expectedHex || storedSize != len(payload) {
				t.Fatalf("persisted attachment mismatch: sha=%q size=%d", storedSHA, storedSize)
			}
		}

		// Invalid submission returns CodeInvalidArgument with structured field_errors.
		badReq := connect.NewRequest(&portalv1.SubmitContactRequest{
			Name:    "A",
			Email:   "bad-email",
			Message: "tiny",
		})
		badReq.Header().Set(grpckit.MetadataInternalClientIP, signClientIP(t, contactIP, testSecret))
		_, valErr := contactClient.SubmitContact(ctx, badReq)
		if connect.CodeOf(valErr) != connect.CodeInvalidArgument {
			t.Fatalf("expected CodeInvalidArgument, got %v", valErr)
		}
		valEnv := extractErrorDetail(t, valErr)
		if len(valEnv.GetError().GetFieldErrors()["email"].GetMessages()) == 0 {
			t.Fatalf("expected field_errors.email in detail envelope, got %+v", valEnv.GetError().GetFieldErrors())
		}

		// Hit CONTACT_RATE_LIMIT_MAX=3 (2 calls used above -> 1 more + 4th returns 429).
		var rlErr error
		for i := 0; i < 3; i++ {
			r := connect.NewRequest(&portalv1.SubmitContactRequest{
				Name:    "Ada Lovelace",
				Email:   "ada@analytical-engine.org",
				Message: "Rate limit probe message with valid length.",
			})
			r.Header().Set(grpckit.MetadataInternalClientIP, signClientIP(t, contactIP, testSecret))
			_, err := contactClient.SubmitContact(ctx, r)
			if err != nil {
				rlErr = err
				break
			}
		}
		if connect.CodeOf(rlErr) != connect.CodeResourceExhausted {
			t.Fatalf("expected CodeResourceExhausted on contact rate limit, got %v", rlErr)
		}
		rlEnv := extractErrorDetail(t, rlErr)
		if rlEnv.GetRetryAfterSeconds() <= 0 {
			t.Fatalf("expected retry_after_seconds > 0 on contact 429, got %+v", rlEnv)
		}
	})
}
