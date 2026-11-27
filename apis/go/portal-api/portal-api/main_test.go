package main

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/analytics"
	commonv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/common/v1"
	portalv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1/portalv1connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
)

func signClientIPToken(t *testing.T, ip, secret string) string {
	t.Helper()
	tok, err := internalauth.Sign(internalauth.RoleService, "client-ip:"+ip, time.Minute, secret)
	if err != nil {
		t.Fatalf("sign client IP token: %v", err)
	}
	return tok
}

func startTestH2CServer(t *testing.T, deps portalServiceDeps) *httptest.Server {
	t.Helper()
	h := h2c.NewHandler(newHandler(deps), &http2.Server{})
	ts := httptest.NewUnstartedServer(h)
	ts.EnableHTTP2 = true
	ts.Start()
	t.Cleanup(ts.Close)
	return ts
}

func TestValidateStartupConfigFailsClosedInProduction(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("INTERNAL_AUTH_SECRET", "")
	t.Setenv("ANALYTICS_DAILY_SALT", "")
	t.Setenv("PORTAL_DATABASE_URL", "")

	var logBuf bytes.Buffer
	origOut := log.Writer()
	log.SetOutput(&logBuf)
	t.Cleanup(func() { log.SetOutput(origOut) })

	if _, err := validateStartupConfig(); err == nil {
		t.Fatal("expected validateStartupConfig to fail closed in production when required secrets are missing")
	}
	logged := logBuf.String()
	if !strings.Contains(logged, "portal_api.startup.config_missing") ||
		!strings.Contains(logged, "INTERNAL_AUTH_SECRET") ||
		!strings.Contains(logged, "ANALYTICS_DAILY_SALT") ||
		!strings.Contains(logged, "PORTAL_DATABASE_URL") {
		t.Fatalf("expected portal_api.startup.config_missing seam listing all 3 missing vars, got:\n%s", logged)
	}
}

func TestHealthAndGRPCOnlyEnforcement(t *testing.T) {
	const testSecret = "unit-portal-api-secret-value-0123456789"
	ts := startTestH2CServer(t, portalServiceDeps{
		store:             pg.NewMemoryStore(),
		explicitSecret:    testSecret,
		explicitDailySalt: "unit-daily-salt",
	})

	resp, err := http.Get(ts.URL + "/health")
	if err != nil {
		t.Fatalf("GET /health: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on /health, got %d", resp.StatusCode)
	}
	var body struct {
		OK      bool   `json:"ok"`
		Service string `json:"service"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode /health: %v", err)
	}
	if !body.OK || body.Service != "portal-api" {
		t.Fatalf("unexpected /health payload: %+v", body)
	}

	// Non-gRPC JSON POST to ConnectRPC route must be rejected with 415.
	req, err := http.NewRequest(http.MethodPost, ts.URL+"/portal.v1.PortalContentService/GetContactContent", strings.NewReader("{}"))
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	jsonRes, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST JSON: %v", err)
	}
	defer jsonRes.Body.Close()
	if jsonRes.StatusCode != http.StatusUnsupportedMediaType {
		t.Fatalf("expected 415 Unsupported Media Type for application/json on gRPC endpoint, got %d", jsonRes.StatusCode)
	}

	// Standard gRPC Health Check probe over h2c must return SERVING.
	target := strings.TrimPrefix(ts.URL, "http://")
	conn, err := grpc.NewClient(target, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatalf("grpc.NewClient: %v", err)
	}
	defer conn.Close()

	hc := healthpb.NewHealthClient(conn)
	checkRes, err := hc.Check(context.Background(), &healthpb.HealthCheckRequest{Service: "portal.v1.AnalyticsService"})
	if err != nil {
		t.Fatalf("grpc health check failed: %v", err)
	}
	if checkRes.GetStatus() != healthpb.HealthCheckResponse_SERVING {
		t.Fatalf("expected SERVING, got %v", checkRes.GetStatus())
	}
}

func TestAnalyticsAndContactValidationAndZeroRawIPLogging(t *testing.T) {
	const testSecret = "unit-portal-api-secret-value-0123456789"
	const testSalt = "unit-salt-2026"
	const rawIP = "198.51.100.77"

	var logBuf bytes.Buffer
	origOut := log.Writer()
	log.SetOutput(&logBuf)
	t.Cleanup(func() { log.SetOutput(origOut) })

	deps := portalServiceDeps{
		store:             pg.NewMemoryStore(),
		explicitSecret:    testSecret,
		explicitDailySalt: testSalt,
		nowFn:             func() time.Time { return time.Date(2026, 4, 21, 14, 0, 0, 0, time.UTC) },
	}
	analyticsSrv := newAnalyticsServiceServer(deps)

	// Missing signed client IP must fail closed with CodeUnauthenticated.
	badIPReq := connect.NewRequest(&portalv1.IngestAnalyticsRequest{
		SessionId: "sess_test_1",
		Events: []*portalv1.AnalyticsEvent{{
			Type:      "page_view",
			Name:      "page_view",
			Path:      "/",
			Timestamp: "2026-04-21T14:00:00Z",
		}},
	})
	if _, err := analyticsSrv.IngestAnalytics(context.Background(), badIPReq); connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Fatalf("expected CodeUnauthenticated without x-internal-client-ip, got %v", err)
	}

	// Oversized metadata (>16 keys) must return CodeInvalidArgument and log analytics.ingest.payload_rejected.
	hugeMeta := make(map[string]*portalv1.AnalyticsMetadataValue, 17)
	for i := 0; i < 17; i++ {
		hugeMeta[strings.Repeat("k", i+1)] = &portalv1.AnalyticsMetadataValue{
			Kind: &portalv1.AnalyticsMetadataValue_StringValue{StringValue: "v"},
		}
	}
	overReq := connect.NewRequest(&portalv1.IngestAnalyticsRequest{
		SessionId: "sess_test_over",
		Events: []*portalv1.AnalyticsEvent{{
			Type:      "interaction",
			Name:      "click",
			Path:      "/",
			Metadata:  hugeMeta,
			Timestamp: "2026-04-21T14:00:00Z",
		}},
	})
	overReq.Header().Set(grpckit.MetadataInternalClientIP, signClientIPToken(t, rawIP, testSecret))
	if _, err := analyticsSrv.IngestAnalytics(context.Background(), overReq); connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("expected CodeInvalidArgument for >16 metadata keys, got %v", err)
	}

	// Valid batch returns accepted count and expected ipHash.
	okReq := connect.NewRequest(&portalv1.IngestAnalyticsRequest{
		SessionId: "sess_test_ok",
		Events: []*portalv1.AnalyticsEvent{{
			Type:      "page_view",
			Name:      "page_view",
			Path:      "/about",
			Timestamp: "2026-04-21T14:00:00Z",
		}},
		ClientContext: &portalv1.ClientRequestContext{
			UserAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
		},
	})
	okReq.Header().Set(grpckit.MetadataInternalClientIP, signClientIPToken(t, rawIP, testSecret))
	okRes, err := analyticsSrv.IngestAnalytics(context.Background(), okReq)
	if err != nil {
		t.Fatalf("valid IngestAnalytics failed: %v", err)
	}
	expectedHash := analytics.HashVisitorIP(rawIP, analytics.BuildDailySalt(testSalt, deps.now()))
	if okRes.Msg.GetAccepted() != 1 || okRes.Msg.GetIpHash() != expectedHash {
		t.Fatalf("unexpected IngestAnalytics response: accepted=%d ipHash=%q want=%q",
			okRes.Msg.GetAccepted(), okRes.Msg.GetIpHash(), expectedHash)
	}

	// Contact validation catches bad email and short message and returns field_errors.
	contactSrv := newContactServiceServer(deps)
	// Memory store has no site_content row, so verify validateContactRequest directly.
	_, fieldErrs := validateContactRequest(contactFormDefinition{}, &portalv1.SubmitContactRequest{
		Name:    "A",
		Email:   "not-an-email",
		Message: "short",
		Attachment: &portalv1.ContactAttachmentUpload{
			Filename: "malware.exe",
			MimeType: "application/x-msdownload",
			Content:  []byte("bad"),
		},
	})
	if len(fieldErrs["name"]) == 0 || len(fieldErrs["email"]) == 0 || len(fieldErrs["message"]) == 0 || len(fieldErrs["file"]) == 0 {
		t.Fatalf("expected validation errors for name, email, message, and file; got %+v", fieldErrs)
	}
	_ = contactSrv

	// Verify ErrorDetailEnvelope carries field_errors and retry_after_seconds cleanly.
	retrySec := int32(42)
	cErr := newPortalError(
		connect.CodeResourceExhausted,
		"ERR_RATE_LIMITED",
		http.StatusTooManyRequests,
		"Limited",
		"Wait",
		"corr-1",
		map[string][]string{"email": {"bad email"}},
		&retrySec,
	)
	if len(cErr.Details()) == 0 {
		t.Fatal("expected error details")
	}
	val, err := cErr.Details()[0].Value()
	if err != nil {
		t.Fatalf("decode detail: %v", err)
	}
	env, ok := val.(*commonv1.ErrorDetailEnvelope)
	if !ok || env.GetRetryAfterSeconds() != 42 || len(env.GetError().GetFieldErrors()["email"].GetMessages()) != 1 {
		t.Fatalf("unexpected ErrorDetailEnvelope: %+v", env)
	}

	// Assert raw IP never appeared in any structured log output.
	if strings.Contains(logBuf.String(), rawIP) {
		t.Fatalf("raw client IP %q leaked into portal-api logs:\n%s", rawIP, logBuf.String())
	}
	_ = portalv1connect.PortalContentServiceName
}
