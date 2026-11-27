package adminapi_e2e_test

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/base32"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"connectrpc.com/connect"
	adminv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1/adminv1connect"
	commonv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/common/v1"
	portalv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit/e2etest"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/jackc/pgx/v5"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
)

func requireEnvDSN(t *testing.T, key string) string {
	t.Helper()
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		t.Fatalf("%s must be set for admin-api-e2e (live PG19 admin_app)", key)
	}
	return val
}

func computeTestTotp(t *testing.T, secretBase32 string, at time.Time) string {
	t.Helper()
	key, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(strings.ToUpper(secretBase32))
	if err != nil {
		t.Fatalf("decode totp secret: %v", err)
	}
	var buf [8]byte
	binary.BigEndian.PutUint64(buf[:], uint64(at.UTC().Unix()/30))
	mac := hmac.New(sha1.New, key)
	_, _ = mac.Write(buf[:])
	d := mac.Sum(nil)
	off := d[len(d)-1] & 0x0f
	code := ((uint32(d[off]&0x7f) << 24) | (uint32(d[off+1]) << 16) | (uint32(d[off+2]) << 8) | uint32(d[off+3])) % 1_000_000
	return fmt.Sprintf("%06d", code)
}

func extractErrorDetail(t *testing.T, err error) *commonv1.ErrorDetailEnvelope {
	t.Helper()
	var cErr *connect.Error
	if !errors.As(err, &cErr) {
		t.Fatalf("expected *connect.Error, got %T: %v", err, err)
	}
	for _, det := range cErr.Details() {
		if v, decErr := det.Value(); decErr == nil {
			if env, ok := v.(*commonv1.ErrorDetailEnvelope); ok {
				return env
			}
		}
	}
	t.Fatalf("missing ErrorDetailEnvelope in connect error: %v", cErr)
	return nil
}

func signHeader(t *testing.T, h http.Header, role, sub, secret, sessionID, ip string) {
	t.Helper()
	tok, err := internalauth.Sign(role, sub, 2*time.Minute, secret)
	if err != nil {
		t.Fatalf("sign internal auth: %v", err)
	}
	h.Set(grpckit.MetadataInternalAuth, tok)
	if sessionID != "" {
		h.Set("x-admin-session-id", sessionID)
	}
	if ip != "" {
		ipTok, err := internalauth.Sign(internalauth.RoleService, "client-ip:"+ip, 2*time.Minute, secret)
		if err != nil {
			t.Fatalf("sign client ip: %v", err)
		}
		h.Set(grpckit.MetadataInternalClientIP, ipTok)
	}
}

func TestAdminAPIEndToEndLivePG19(t *testing.T) {
	adminAppDSN := requireEnvDSN(t, "ADMIN_DATABASE_URL")
	ownerDSN := requireEnvDSN(t, "DATABASE_URL")

	const (
		adminSecret = "admin-api-e2e-dedicated-secret-0123456789"
		wrongSecret = "portal-shared-secret-must-fail-admin-api"
		totpKey     = "admin-api-e2e-totp-key-2026"
		dailySalt   = "admin-api-e2e-daily-salt"
		qdrantKey   = "admin-api-e2e-qdrant-key"
		// Pre-computed Node 26 Argon2id PHC for "Correct-Horse-Battery-Staple-2026!"
		testPassword = "Correct-Horse-Battery-Staple-2026!"
		testPHC      = "$argon2id$v=19$m=19456,t=2,p=1$Cu8GKTLWWev7tjvvX9xBDA$xxuZkN+fSGyZDDWoJYN9KKq/ZKNdTsQryOY3KfwGk4Q"
	)

	// Setup test admin user + fixtures via owner DSN (admin_app intentionally has SELECT-only on users).
	ctx := context.Background()
	ownerConn, err := pgx.Connect(ctx, ownerDSN)
	if err != nil {
		t.Fatalf("connect owner PG: %v", err)
	}
	defer ownerConn.Close(ctx)

	testHandle := "e2e_admin_user"
	var testUserID string
	err = ownerConn.QueryRow(ctx, `
		INSERT INTO users (handle, role, password_hash_argon2)
		VALUES ($1, 'admin', $2)
		ON CONFLICT (handle) DO UPDATE SET password_hash_argon2 = EXCLUDED.password_hash_argon2
		RETURNING id::text`, testHandle, testPHC,
	).Scan(&testUserID)
	if err != nil {
		t.Fatalf("seed test admin user: %v", err)
	}
	t.Cleanup(func() {
		_, _ = ownerConn.Exec(context.Background(), `DELETE FROM users WHERE id = $1::uuid`, testUserID)
	})

	// Mock Qdrant & Agensi upstreams.
	mockQdrant := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("api-key") != qdrantKey {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/collections/portfolio_docs":
			_, _ = w.Write([]byte(`{"result":{"status":"green","points_count":15}}`))
		case "/collections/cadence_patterns":
			_, _ = w.Write([]byte(`{"result":{"status":"green","points_count":6}}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(mockQdrant.Close)

	mockAgensi := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"items": []map[string]any{
				{
					"slug":          "admin-e2e-skill",
					"name":          "Admin E2E Skill",
					"summary":       "Synced by admin-api E2E",
					"tags":          []string{"admin", "grpc"},
					"url":           "https://agensi.io/skills/admin-e2e-skill",
					"sortOrder":     1,
					"creatorHandle": "aklapper",
					"isPublished":   true,
				},
			},
		})
	}))
	t.Cleanup(mockAgensi.Close)

	baseURL := e2etest.StartBinary(
		t,
		"../admin-api",
		"ADMIN_DATABASE_URL="+adminAppDSN,
		"DATABASE_URL=",
		"ADMIN_INTERNAL_AUTH_SECRET="+adminSecret,
		"TOTP_ENCRYPTION_KEY="+totpKey,
		"ANALYTICS_DAILY_SALT="+dailySalt,
		"DOSSIER_PRIVACY_DENYLIST=[\"SecretClientCorp\"]",
		"QDRANT_URL="+mockQdrant.URL,
		"QDRANT_API_KEY="+qdrantKey,
		"AI_ASK_URL=",
		"AGENSI_API_BASE_URL="+mockAgensi.URL,
		"AGENSI_API_PATH=/creators/aklapper",
		"AGENSI_CREATOR_HANDLE=aklapper",
	)

	h2c := grpckit.NewH2CClient()
	authClient := adminv1connect.NewAdminAuthServiceClient(h2c, baseURL, connect.WithGRPC())
	cmsClient := adminv1connect.NewAdminCmsServiceClient(h2c, baseURL, connect.WithGRPC())
	inboxClient := adminv1connect.NewAdminInboxServiceClient(h2c, baseURL, connect.WithGRPC())
	analyticsClient := adminv1connect.NewAdminAnalyticsServiceClient(h2c, baseURL, connect.WithGRPC())
	quotasClient := adminv1connect.NewAdminQuotasServiceClient(h2c, baseURL, connect.WithGRPC())
	opsClient := adminv1connect.NewAdminOpsServiceClient(h2c, baseURL, connect.WithGRPC())

	// 1. Health endpoints (/health, /healthz, gRPC Health/Check).
	t.Run("Health probes succeed over HTTP and gRPC h2c", func(t *testing.T) {
		res, health := e2etest.DoJSON[httpkit.HealthResponse](t, http.MethodGet, baseURL+"/healthz", nil, nil)
		if res.StatusCode != http.StatusOK || !health.OK || health.Service != "admin-api" {
			t.Fatalf("unexpected /healthz: status=%d payload=%+v", res.StatusCode, health)
		}
		target := strings.TrimPrefix(baseURL, "http://")
		conn, err := grpc.NewClient(target, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			t.Fatalf("grpc.NewClient: %v", err)
		}
		defer conn.Close()
		hc := healthpb.NewHealthClient(conn)
		for _, svc := range []string{
			"",
			adminv1connect.AdminAuthServiceName,
			adminv1connect.AdminCmsServiceName,
			adminv1connect.AdminInboxServiceName,
			adminv1connect.AdminAnalyticsServiceName,
			adminv1connect.AdminQuotasServiceName,
			adminv1connect.AdminOpsServiceName,
		} {
			hcRes, err := hc.Check(ctx, &healthpb.HealthCheckRequest{Service: svc})
			if err != nil || hcRes.GetStatus() != healthpb.HealthCheckResponse_SERVING {
				t.Fatalf("gRPC health check failed for %q: res=%v err=%v", svc, hcRes, err)
			}
		}
	})

	// 2. Auth lifecycle: PasswordLogin -> EnrollTotp -> ConfirmTotpEnrollment -> 5x parallel backup-code race -> DisableTotp.
	var activeSessionID string
	t.Run("Auth password login, TOTP enrollment, and 5x parallel backup code race", func(t *testing.T) {
		// Wrong secret rejected fail-closed.
		badReq := connect.NewRequest(&adminv1.GetAdminChromeRequest{})
		signHeader(t, badReq.Header(), internalauth.RoleService, "admin-ssr-chrome", wrongSecret, "", "")
		if _, err := cmsClient.GetAdminChrome(ctx, badReq); connect.CodeOf(err) != connect.CodeUnauthenticated {
			t.Fatalf("expected CodeUnauthenticated with wrong secret, got %v", err)
		}

		// Password login with Node-26 Argon2id PHC.
		loginReq := connect.NewRequest(&adminv1.PasswordLoginRequest{Handle: testHandle, Password: testPassword})
		signHeader(t, loginReq.Header(), internalauth.RoleService, "admin-auth-bff", adminSecret, "", "198.51.100.10")
		loginRes, err := authClient.PasswordLogin(ctx, loginReq)
		if err != nil || !loginRes.Msg.GetVerified() || loginRes.Msg.GetSession().GetSessionId() == "" {
			t.Fatalf("PasswordLogin failed: res=%v err=%v", loginRes, err)
		}
		activeSessionID = loginRes.Msg.GetSession().GetSessionId()

		// Verify GetAdminSession.
		sessReq := connect.NewRequest(&adminv1.GetAdminSessionRequest{SessionId: activeSessionID})
		signHeader(t, sessReq.Header(), internalauth.RoleService, "admin-auth-bff", adminSecret, "", "")
		sessRes, err := authClient.GetAdminSession(ctx, sessReq)
		if err != nil || !sessRes.Msg.GetAuthenticated() || sessRes.Msg.GetSession().GetHandle() != testHandle {
			t.Fatalf("GetAdminSession failed: res=%v err=%v", sessRes, err)
		}

		// Enroll TOTP.
		enrollReq := connect.NewRequest(&adminv1.EnrollTotpRequest{SessionId: activeSessionID})
		signHeader(t, enrollReq.Header(), internalauth.RoleAdmin, "admin-session:"+activeSessionID, adminSecret, activeSessionID, "")
		enrollRes, err := authClient.EnrollTotp(ctx, enrollReq)
		if err != nil || enrollRes.Msg.GetSecret() == "" || len(enrollRes.Msg.GetBackupCodes()) != 8 {
			t.Fatalf("EnrollTotp failed: res=%v err=%v", enrollRes, err)
		}
		totpSecret := enrollRes.Msg.GetSecret()
		backupCode := enrollRes.Msg.GetBackupCodes()[0]

		// ConfirmTotpEnrollment MUST reject backup code!
		badConfirm := connect.NewRequest(&adminv1.ConfirmTotpEnrollmentRequest{SessionId: activeSessionID, Code: backupCode})
		signHeader(t, badConfirm.Header(), internalauth.RoleAdmin, "admin-session:"+activeSessionID, adminSecret, activeSessionID, "198.51.100.11")
		if _, err := authClient.ConfirmTotpEnrollment(ctx, badConfirm); connect.CodeOf(err) != connect.CodeUnauthenticated {
			t.Fatalf("expected ConfirmTotpEnrollment to reject backup code with CodeUnauthenticated, got %v", err)
		}

		// ConfirmTotpEnrollment accepts live 6-digit RFC 6238 code without minting new session.
		liveCode := computeTestTotp(t, totpSecret, time.Now().UTC())
		okConfirm := connect.NewRequest(&adminv1.ConfirmTotpEnrollmentRequest{SessionId: activeSessionID, Code: liveCode})
		signHeader(t, okConfirm.Header(), internalauth.RoleAdmin, "admin-session:"+activeSessionID, adminSecret, activeSessionID, "198.51.100.11")
		confirmRes, err := authClient.ConfirmTotpEnrollment(ctx, okConfirm)
		if err != nil || !confirmRes.Msg.GetEnabled() {
			t.Fatalf("ConfirmTotpEnrollment failed: res=%v err=%v", confirmRes, err)
		}

		// PasswordLogin now requires TOTP step-up.
		stepLoginReq := connect.NewRequest(&adminv1.PasswordLoginRequest{Handle: testHandle, Password: testPassword})
		signHeader(t, stepLoginReq.Header(), internalauth.RoleService, "admin-auth-bff", adminSecret, "", "198.51.100.12")
		stepLoginRes, err := authClient.PasswordLogin(ctx, stepLoginReq)
		if err != nil || !stepLoginRes.Msg.GetRequiresTotp() || stepLoginRes.Msg.GetPendingToken() == "" {
			t.Fatalf("expected requires_totp=true + pendingToken, got res=%v err=%v", stepLoginRes, err)
		}
		pendingToken := stepLoginRes.Msg.GetPendingToken()

		// 5 concurrent replays of the EXACT same backup code -> strictly 1 succeeds, 4 fail CodeUnauthenticated!
		var wins atomic.Int32
		var unauths atomic.Int32
		var wg sync.WaitGroup
		for i := 0; i < 5; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				r := connect.NewRequest(&adminv1.VerifyTotpStepUpRequest{PendingToken: pendingToken, Code: backupCode})
				signHeader(t, r.Header(), internalauth.RoleService, "admin-auth-bff", adminSecret, "", "198.51.100.13")
				res, rErr := authClient.VerifyTotpStepUp(ctx, r)
				if rErr == nil && res.Msg.GetVerified() {
					wins.Add(1)
				} else if connect.CodeOf(rErr) == connect.CodeUnauthenticated {
					unauths.Add(1)
				} else {
					t.Errorf("unexpected backup race outcome: res=%v err=%v", res, rErr)
				}
			}()
		}
		wg.Wait()
		if wins.Load() != 1 || unauths.Load() != 4 {
			t.Fatalf("atomic backup code race invariant violated: wins=%d unauths=%d (want 1/4)", wins.Load(), unauths.Load())
		}

		// Disable TOTP cleanly.
		disReq := connect.NewRequest(&adminv1.DisableTotpRequest{SessionId: activeSessionID})
		signHeader(t, disReq.Header(), internalauth.RoleAdmin, "admin-session:"+activeSessionID, adminSecret, activeSessionID, "")
		if _, err := authClient.DisableTotp(ctx, disReq); err != nil {
			t.Fatalf("DisableTotp failed: %v", err)
		}
	})

	// 3. Role boundary + CMS + Privacy + Career Dossiers + Agensi sync.
	t.Run("CMS chrome split, privacy 422 findings, dossiers, and Agensi sync", func(t *testing.T) {
		// Service token can read GetAdminChrome ONLY.
		chromeReq := connect.NewRequest(&adminv1.GetAdminChromeRequest{})
		signHeader(t, chromeReq.Header(), internalauth.RoleService, "admin-ssr-chrome", adminSecret, "", "")
		chromeRes, err := cmsClient.GetAdminChrome(ctx, chromeReq)
		if err != nil || !strings.Contains(chromeRes.Msg.GetChromeJson(), "{") {
			t.Fatalf("GetAdminChrome failed: res=%v err=%v", chromeRes, err)
		}

		// Service token MUST be rejected with CodePermissionDenied on GetAdminWorkspaceBootstrap and GetCmsData.
		bootDeny := connect.NewRequest(&adminv1.GetAdminWorkspaceBootstrapRequest{SessionId: activeSessionID})
		signHeader(t, bootDeny.Header(), internalauth.RoleService, "admin-ssr-chrome", adminSecret, "", "")
		if _, err := cmsClient.GetAdminWorkspaceBootstrap(ctx, bootDeny); connect.CodeOf(err) != connect.CodePermissionDenied {
			t.Fatalf("expected CodePermissionDenied for service token on bootstrap, got %v", err)
		}

		// Authenticated admin reads bootstrap + CMS data.
		bootReq := connect.NewRequest(&adminv1.GetAdminWorkspaceBootstrapRequest{SessionId: activeSessionID})
		signHeader(t, bootReq.Header(), internalauth.RoleAdmin, "admin-session:"+activeSessionID, adminSecret, activeSessionID, "")
		bootRes, err := cmsClient.GetAdminWorkspaceBootstrap(ctx, bootReq)
		if err != nil || bootRes.Msg.GetTerminal().GetSlug() != "admin-ops" {
			t.Fatalf("GetAdminWorkspaceBootstrap failed: res=%v err=%v", bootRes, err)
		}

		// Privacy 422 with structured sanitization_findings on denylisted client name.
		badSite := connect.NewRequest(&adminv1.UpsertSiteContentRequest{
			Key:          "portal-about",
			MarkdownBody: "Engineered systems for SecretClientCorp in 2025.",
			MetadataJson: `{"title":"About"}`,
		})
		signHeader(t, badSite.Header(), internalauth.RoleAdmin, "admin-session:"+activeSessionID, adminSecret, activeSessionID, "")
		_, privErr := cmsClient.UpsertSiteContent(ctx, badSite)
		if connect.CodeOf(privErr) != connect.CodeFailedPrecondition {
			t.Fatalf("expected CodeFailedPrecondition on privacy violation, got %v", privErr)
		}
		env := extractErrorDetail(t, privErr)
		if env.GetError().GetStatus() != http.StatusUnprocessableEntity || len(env.GetSanitizationFindings()) == 0 {
			t.Fatalf("expected 422 + sanitization_findings, got %+v", env)
		}

		// Retired portal-maintenance blocked with HTTP 410.
		maintReq := connect.NewRequest(&adminv1.UpsertSiteContentRequest{
			Key: "portal-maintenance", MarkdownBody: "off", MetadataJson: `{}`,
		})
		signHeader(t, maintReq.Header(), internalauth.RoleAdmin, "admin-session:"+activeSessionID, adminSecret, activeSessionID, "")
		_, maintErr := cmsClient.UpsertSiteContent(ctx, maintReq)
		if env := extractErrorDetail(t, maintErr); env.GetError().GetStatus() != http.StatusGone {
			t.Fatalf("expected 410 on portal-maintenance, got %+v", env)
		}

		// Career dossier lifecycle: Upsert -> Publish -> Unpublish -> Delete.
		dossierSlug := "e2e-admin-dossier"
		upReq := connect.NewRequest(&adminv1.UpsertCareerDossierRequest{
			Dossier: &adminv1.CareerDossierUpsertInput{
				Slug: dossierSlug, Kind: "project", Title: "E2E Admin Dossier",
				DomainLabel: "Infrastructure", RoleTitle: "Principal Engineer", Timeframe: "2025",
				Skills: []string{"Go", "PostgreSQL"}, SummaryBody: "Clean sanitized summary.",
				Sections: []*portalv1.CareerDossierSection{{Heading: "Architecture", Body: "Isolated gRPC services."}},
			},
		})
		signHeader(t, upReq.Header(), internalauth.RoleAdmin, "admin-session:"+activeSessionID, adminSecret, activeSessionID, "")
		upRes, err := cmsClient.UpsertCareerDossier(ctx, upReq)
		if err != nil || upRes.Msg.GetDossier().GetPublishStatus() != "draft" {
			t.Fatalf("UpsertCareerDossier failed: res=%v err=%v", upRes, err)
		}
		pubReq := connect.NewRequest(&adminv1.PublishCareerDossierRequest{Slug: dossierSlug})
		signHeader(t, pubReq.Header(), internalauth.RoleAdmin, "admin-session:"+activeSessionID, adminSecret, activeSessionID, "")
		pubRes, err := cmsClient.PublishCareerDossier(ctx, pubReq)
		if err != nil || pubRes.Msg.GetDossier().GetPublishStatus() != "published" {
			t.Fatalf("PublishCareerDossier failed: res=%v err=%v", pubRes, err)
		}
		unpubReq := connect.NewRequest(&adminv1.UnpublishCareerDossierRequest{Slug: dossierSlug})
		signHeader(t, unpubReq.Header(), internalauth.RoleAdmin, "admin-session:"+activeSessionID, adminSecret, activeSessionID, "")
		unpubRes, err := cmsClient.UnpublishCareerDossier(ctx, unpubReq)
		if err != nil || unpubRes.Msg.GetDossier().GetPublishStatus() != "draft" {
			t.Fatalf("UnpublishCareerDossier failed: res=%v err=%v", unpubRes, err)
		}
		delReq := connect.NewRequest(&adminv1.DeleteCareerDossierRequest{Slug: dossierSlug})
		signHeader(t, delReq.Header(), internalauth.RoleAdmin, "admin-session:"+activeSessionID, adminSecret, activeSessionID, "")
		if delRes, err := cmsClient.DeleteCareerDossier(ctx, delReq); err != nil || !delRes.Msg.GetDeleted() {
			t.Fatalf("DeleteCareerDossier failed: res=%v err=%v", delRes, err)
		}

		// Agensi sync against mock server.
		syncReq := connect.NewRequest(&adminv1.SyncAgensiCatalogRequest{ForceRefresh: true})
		signHeader(t, syncReq.Header(), internalauth.RoleAdmin, "admin-session:"+activeSessionID, adminSecret, activeSessionID, "")
		syncRes, err := cmsClient.SyncAgensiCatalog(ctx, syncReq)
		if err != nil || len(syncRes.Msg.GetSkills()) == 0 {
			t.Fatalf("SyncAgensiCatalog failed: res=%v err=%v", syncRes, err)
		}
	})

	// 4. Inbox 5 MiB chunked StreamContactAttachment + DeleteContactSubmission PII purge.
	t.Run("Inbox 5 MiB attachment streaming and deletion purge", func(t *testing.T) {
		payload := bytes.Repeat([]byte("A1B2C3D4"), (5*1024*1024)/8) // exact 5 MiB
		sum := sha256.Sum256(payload)
		shaHex := hex.EncodeToString(sum[:])
		b64 := base64.StdEncoding.EncodeToString(payload)

		var subID string
		err := ownerConn.QueryRow(ctx, `
			INSERT INTO contact_submissions (name, email, message, attachment_name, attachment_mime_type, attachment_size_bytes, attachment_sha256, attachment_content_base64)
			VALUES ('E2E Sender', 'sender@example.com', '5 MiB attachment streaming test payload', 'large.pdf', 'application/pdf', $1, $2, $3)
			RETURNING id::text`, len(payload), shaHex, b64,
		).Scan(&subID)
		if err != nil {
			t.Fatalf("seed 5 MiB contact submission: %v", err)
		}

		streamReq := connect.NewRequest(&adminv1.StreamContactAttachmentRequest{SubmissionId: subID})
		signHeader(t, streamReq.Header(), internalauth.RoleAdmin, "admin-session:"+activeSessionID, adminSecret, activeSessionID, "")
		stream, err := inboxClient.StreamContactAttachment(ctx, streamReq)
		if err != nil {
			t.Fatalf("StreamContactAttachment failed: %v", err)
		}
		var meta *adminv1.ContactAttachmentMetadata
		var received bytes.Buffer
		chunkCount := 0
		for stream.Receive() {
			msg := stream.Msg()
			if m := msg.GetMetadata(); m != nil {
				if meta != nil {
					t.Fatalf("duplicate metadata frame")
				}
				meta = m
			} else if d := msg.GetData(); len(d) > 0 {
				if len(d) > 256*1024 {
					t.Fatalf("chunk exceeded 256 KiB cap: %d", len(d))
				}
				chunkCount++
				received.Write(d)
			}
		}
		if err := stream.Err(); err != nil {
			t.Fatalf("attachment stream error: %v", err)
		}
		if meta == nil || meta.GetSizeBytes() != int64(len(payload)) || received.Len() != len(payload) || chunkCount < 20 {
			t.Fatalf("unexpected 5 MiB stream metrics: meta=%+v recvLen=%d chunks=%d", meta, received.Len(), chunkCount)
		}
		gotSum := sha256.Sum256(received.Bytes())
		if hex.EncodeToString(gotSum[:]) != shaHex {
			t.Fatalf("streamed SHA-256 mismatch")
		}

		delReq := connect.NewRequest(&adminv1.DeleteContactSubmissionRequest{Id: subID})
		signHeader(t, delReq.Header(), internalauth.RoleAdmin, "admin-session:"+activeSessionID, adminSecret, activeSessionID, "")
		if delRes, err := inboxClient.DeleteContactSubmission(ctx, delReq); err != nil || !delRes.Msg.GetDeleted() {
			t.Fatalf("DeleteContactSubmission failed: res=%v err=%v", delRes, err)
		}
	})

	// 5. Analytics overview, summary, breakdowns, authenticated IngestAdminAnalytics + Quotas + Ops (golden 409 + Qdrant).
	t.Run("Analytics ingest, Quotas CRUD, Ops golden 409 guard, and Qdrant dual-collection probe", func(t *testing.T) {
		ingReq := connect.NewRequest(&adminv1.IngestAdminAnalyticsRequest{
			SessionId:      "admin_e2e_sess_1",
			AdminSessionId: activeSessionID,
			Events: []*portalv1.AnalyticsEvent{
				{Type: "page_view", Name: "admin_page_view", Path: "/cms", Timestamp: time.Now().UTC().Format(time.RFC3339Nano)},
			},
		})
		signHeader(t, ingReq.Header(), internalauth.RoleAdmin, "admin-session:"+activeSessionID, adminSecret, activeSessionID, "198.51.100.20")
		ingRes, err := analyticsClient.IngestAdminAnalytics(ctx, ingReq)
		if err != nil || ingRes.Msg.GetAccepted() != 1 || ingRes.Msg.GetIpHash() == "" {
			t.Fatalf("IngestAdminAnalytics failed: res=%v err=%v", ingRes, err)
		}

		sumReq := connect.NewRequest(&adminv1.GetAnalyticsSummaryRequest{Filter: &adminv1.AdminAnalyticsFilter{Window: "7d", Bots: "exclude", Identified: "all"}})
		signHeader(t, sumReq.Header(), internalauth.RoleAdmin, "admin-session:"+activeSessionID, adminSecret, activeSessionID, "")
		if _, err := analyticsClient.GetAnalyticsSummary(ctx, sumReq); err != nil {
			t.Fatalf("GetAnalyticsSummary failed: %v", err)
		}

		bkReq := connect.NewRequest(&adminv1.GetAnalyticsBreakdownsRequest{Filter: &adminv1.AdminAnalyticsFilter{Window: "7d", Bots: "exclude", Identified: "all"}})
		signHeader(t, bkReq.Header(), internalauth.RoleAdmin, "admin-session:"+activeSessionID, adminSecret, activeSessionID, "")
		if _, err := analyticsClient.GetAnalyticsBreakdowns(ctx, bkReq); err != nil {
			t.Fatalf("GetAnalyticsBreakdowns failed: %v", err)
		}

		qListReq := connect.NewRequest(&adminv1.ListQuotasAndBucketsRequest{})
		signHeader(t, qListReq.Header(), internalauth.RoleAdmin, "admin-session:"+activeSessionID, adminSecret, activeSessionID, "")
		if _, err := quotasClient.ListQuotasAndBuckets(ctx, qListReq); err != nil {
			t.Fatalf("ListQuotasAndBuckets failed: %v", err)
		}

		// Golden sandbox run immutability (HTTP 409 ERR_CONSTRAINT).
		var goldenRunID string
		if err := ownerConn.QueryRow(ctx, `SELECT id::text FROM sandbox_runs WHERE is_golden = true LIMIT 1`).Scan(&goldenRunID); err == nil && goldenRunID != "" {
			ovReq := connect.NewRequest(&adminv1.OverrideSandboxGateVerdictRequest{RunId: goldenRunID, GateVerdict: "approved"})
			signHeader(t, ovReq.Header(), internalauth.RoleAdmin, "admin-session:"+activeSessionID, adminSecret, activeSessionID, "")
			_, ovErr := opsClient.OverrideSandboxGateVerdict(ctx, ovReq)
			if connect.CodeOf(ovErr) != connect.CodeFailedPrecondition {
				t.Fatalf("expected CodeFailedPrecondition on golden run override, got %v", ovErr)
			}
			if env := extractErrorDetail(t, ovErr); env.GetError().GetStatus() != http.StatusConflict {
				t.Fatalf("expected HTTP 409 on golden run override, got %+v", env)
			}
		}

		// Qdrant dual-collection probe.
		qdReq := connect.NewRequest(&adminv1.GetQdrantStatusRequest{})
		signHeader(t, qdReq.Header(), internalauth.RoleAdmin, "admin-session:"+activeSessionID, adminSecret, activeSessionID, "")
		qdRes, err := opsClient.GetQdrantStatus(ctx, qdReq)
		if err != nil || !qdRes.Msg.GetOnline() || qdRes.Msg.GetPointsCount() != 15 || len(qdRes.Msg.GetCollections()) != 2 {
			t.Fatalf("GetQdrantStatus failed: res=%v err=%v", qdRes, err)
		}

		// Logout revokes session.
		loReq := connect.NewRequest(&adminv1.LogoutAdminSessionRequest{SessionId: activeSessionID})
		signHeader(t, loReq.Header(), internalauth.RoleService, "admin-auth-bff", adminSecret, "", "")
		if _, err := authClient.LogoutAdminSession(ctx, loReq); err != nil {
			t.Fatalf("LogoutAdminSession failed: %v", err)
		}
		checkReq := connect.NewRequest(&adminv1.GetAdminSessionRequest{SessionId: activeSessionID})
		signHeader(t, checkReq.Header(), internalauth.RoleService, "admin-auth-bff", adminSecret, "", "")
		if checkRes, err := authClient.GetAdminSession(ctx, checkReq); err != nil || checkRes.Msg.GetAuthenticated() {
			t.Fatalf("expected revoked session to return authenticated=false, got res=%v err=%v", checkRes, err)
		}
	})
}
