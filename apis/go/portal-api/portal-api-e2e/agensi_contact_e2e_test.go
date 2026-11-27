package portalapi_e2e_test

import (
	"bytes"
	"context"
	"errors"
	"log"
	"os"
	"strings"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/agensi"
	"github.com/AndrewK4758/aklapper/packages/go/kit/analytics"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	portalv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1/portalv1connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit/e2etest"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/jackc/pgx/v5"
)

func openPortalStoreForE2E(t *testing.T) *pg.Store {
	t.Helper()
	portalDSN := requirePortalDatabaseURL(t)
	store, err := pg.OpenLazyPool(context.Background(), portalDSN, 2, true)
	if err != nil {
		t.Fatalf("OpenLazyPool portal_app: %v", err)
	}
	t.Cleanup(store.Close)
	return store
}

func TestAgensiSyncStaleWriteSkipAndFailureTxLivePG19(t *testing.T) {
	store := openPortalStoreForE2E(t)
	ctx := context.Background()

	var logBuf bytes.Buffer
	origOut := log.Writer()
	log.SetOutput(&logBuf)
	t.Cleanup(func() { log.SetOutput(origOut) })

	handle := "e2e_stale_" + contracts.NewUUIDv4()[:8]
	t1 := time.Now().UTC().Add(-2 * time.Minute).Truncate(time.Millisecond)
	t2 := t1.Add(30 * time.Second)
	tStale := t1.Add(5 * time.Second)

	first, err := store.CommitAgensiSyncTx(ctx, pg.CommitAgensiSyncInput{
		CreatorHandle: handle,
		TTLSeconds:    300,
		Items: []agensi.Skill{{
			Slug: handle + "-v1", Name: "V1", Summary: "First sync",
			Tags: []string{"go"}, URL: "https://agensi.io/skills/" + handle + "-v1",
			SortOrder: 1, IsPublished: true, Source: "agensi_api",
		}},
		ETag:          `"etag-1"`,
		FetchedAt:     t1,
		CorrelationID: "corr-ag-v1",
		StartedAt:     t1,
	})
	if err != nil || first.StaleWriteSkipped || len(first.Skills) != 1 {
		t.Fatalf("initial CommitAgensiSyncTx failed: res=%+v err=%v", first, err)
	}

	newer, err := store.CommitAgensiSyncTx(ctx, pg.CommitAgensiSyncInput{
		CreatorHandle: handle,
		TTLSeconds:    300,
		Items: []agensi.Skill{{
			Slug: handle + "-v2", Name: "V2", Summary: "Newer concurrent sync",
			Tags: []string{"go"}, URL: "https://agensi.io/skills/" + handle + "-v2",
			SortOrder: 1, IsPublished: true, Source: "agensi_api",
		}},
		ETag:               `"etag-2"`,
		FetchedAt:          t2,
		PreFetchLastSynced: &t1,
		CorrelationID:      "corr-ag-v2",
		StartedAt:          t2,
	})
	if err != nil || newer.StaleWriteSkipped || len(newer.Skills) != 1 || newer.Skills[0].Slug != handle+"-v2" {
		t.Fatalf("newer CommitAgensiSyncTx failed: res=%+v err=%v", newer, err)
	}

	// Stale writer started from t1 with older fetchedAt must skip write under FOR UPDATE and emit seam.
	stale, err := store.CommitAgensiSyncTx(ctx, pg.CommitAgensiSyncInput{
		CreatorHandle: handle,
		TTLSeconds:    300,
		ForceRefresh:  true,
		Items: []agensi.Skill{{
			Slug: handle + "-stale", Name: "Stale", Summary: "Must not overwrite v2",
			Tags: []string{"old"}, URL: "https://agensi.io/skills/" + handle + "-stale",
			SortOrder: 1, IsPublished: true, Source: "agensi_api",
		}},
		FetchedAt:          tStale,
		PreFetchLastSynced: &t1,
		CorrelationID:      "corr-ag-stale",
		StartedAt:          tStale,
	})
	if err != nil || !stale.StaleWriteSkipped {
		t.Fatalf("expected StaleWriteSkipped=true, got res=%+v err=%v", stale, err)
	}
	if len(stale.Skills) != 1 || stale.Skills[0].Slug != handle+"-v2" {
		t.Fatalf("expected v2 preserved after stale write skip, got %+v", stale.Skills)
	}

	// RecordAgensiFailureTx refuses stale failure older than last_synced_at and persists fresher failure.
	staleFail, err := store.RecordAgensiFailureTx(ctx, handle, "stale timeout", tStale)
	if err != nil || staleFail == nil || staleFail.LastStatus != "ok" {
		t.Fatalf("expected stale failure ignored (status=ok), got state=%+v err=%v", staleFail, err)
	}
	freshFail, err := store.RecordAgensiFailureTx(ctx, handle, "upstream 503", time.Now().UTC().Add(5*time.Second))
	if err != nil || freshFail == nil || freshFail.LastStatus != "error" || freshFail.LastError == nil || *freshFail.LastError != "upstream 503" {
		t.Fatalf("expected fresh failure persisted, got state=%+v err=%v", freshFail, err)
	}

	logs := logBuf.String()
	for _, expected := range []string{
		`"event":"agensi.sync.completed"`,
		`"event":"agensi.cache.stale_write_skipped"`,
	} {
		if !strings.Contains(logs, expected) {
			t.Fatalf("expected seam log %s in:\n%s", expected, logs)
		}
	}
}

func TestContactLinkingFKRetryCheckSpoofAndMidnightGraceLivePG19(t *testing.T) {
	store := openPortalStoreForE2E(t)
	adminDSN := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	ctx := context.Background()

	var logBuf bytes.Buffer
	origOut := log.Writer()
	log.SetOutput(&logBuf)
	t.Cleanup(func() { log.SetOutput(origOut) })

	// 1. InsertContactSubmissionNoReturning retries 23503 FK violation with NULL analytics_session_id.
	missingSession := "sess_nonexistent_" + contracts.NewUUIDv4()
	fkSummary, fkFallbackUsed, err := store.InsertContactSubmissionNoReturning(ctx, pg.ContactSubmissionInsertInput{
		Name:               "Grace Hopper",
		Email:              "grace@example.com",
		Message:            "Verifying SQLSTATE 23503 FK retry fallback to NULL.",
		AnalyticsSessionID: &missingSession,
	})
	if err != nil || !fkFallbackUsed || fkSummary.ID == "" {
		t.Fatalf("expected 23503 FK fallback retry to succeed, got fkFallbackUsed=%v id=%q err=%v", fkFallbackUsed, fkSummary.ID, err)
	}
	if adminDSN != "" {
		adminConn, admErr := pgx.Connect(ctx, adminDSN)
		if admErr != nil {
			t.Fatalf("connect admin DB: %v", admErr)
		}
		defer adminConn.Close(ctx)
		var linkedSession *string
		if err := adminConn.QueryRow(ctx, `SELECT analytics_session_id FROM contact_submissions WHERE id = $1::uuid`, fkSummary.ID).Scan(&linkedSession); err != nil {
			t.Fatalf("verify FK retry NULL column: %v", err)
		}
		if linkedSession != nil {
			t.Fatalf("expected analytics_session_id IS NULL after 23503 retry, got %q", *linkedSession)
		}
	}

	// 2. InsertContactSubmissionNoReturning maps SQLSTATE 23514 CHECK violations to ContactConstraintError fieldErrors.
	_, _, checkErr := store.InsertContactSubmissionNoReturning(ctx, pg.ContactSubmissionInsertInput{
		Name:    "A",
		Email:   "grace@example.com",
		Message: "Valid length message body for CHECK constraint test.",
	})
	var constraintErr *pg.ContactConstraintError
	if !errors.As(checkErr, &constraintErr) || len(constraintErr.FieldErrors["name"]) == 0 {
		t.Fatalf("expected ContactConstraintError with fieldErrors[name], got %v", checkErr)
	}

	// 3. Spoofed candidate session rejected, valid ownership linked, visitor_hash/guest_session fallback, and 30m UTC-midnight grace.
	const testSalt = "e2e-midnight-grace-salt"
	const victimIP = "198.51.100.140"
	const victimUA = "Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0.0.0"
	tPrev := time.Date(2026, 11, 26, 23, 55, 0, 0, time.UTC)
	tAfterMidnight := time.Date(2026, 11, 27, 0, 15, 0, 0, time.UTC)
	prevSalt := analytics.BuildDailySalt(testSalt, tPrev)
	currSalt := analytics.BuildDailySalt(testSalt, tAfterMidnight)
	victimGuest := "guest_e2e_" + contracts.NewUUIDv4()[:8]

	prevMeta := pg.PortalAnalyticsMeta{
		IPHash:         analytics.HashVisitorIP(victimIP, prevSalt),
		VisitorHash:    analytics.HashVisitorIdentity(victimIP, victimUA, prevSalt),
		GuestSessionID: &victimGuest,
	}
	ingested, err := store.IngestPortalAnalyticsTx(ctx, prevMeta, []pg.PortalAnalyticsEventInput{{
		Type: "page_view", Name: "portal_page_view", Path: "/contact", Timestamp: tPrev.Format(time.RFC3339Nano),
	}}, tPrev)
	if err != nil || ingested.SessionID == "" {
		t.Fatalf("seed prior-day analytics session: %v", err)
	}

	// 3a. Attacker spoofing victim session ID is rejected with spoof seam and gets fallback session.
	attackerIPHash := analytics.HashVisitorIP("203.0.113.200", currSalt)
	attackerVisitorHash := analytics.HashVisitorIdentity("203.0.113.200", "AttackerUA/1.0", currSalt)
	spoofRes := store.ResolveOrCreateContactSession(ctx, pg.ContactLinkParams{
		CandidateSessionID: ingested.SessionID,
		CurrentIPHash:      attackerIPHash,
		CurrentVisitorHash: attackerVisitorHash,
		FallbackMeta: pg.PortalAnalyticsMeta{
			IPHash:      attackerIPHash,
			VisitorHash: attackerVisitorHash,
		},
		CorrelationID: "corr-spoof-1",
		Now:           tAfterMidnight,
	})
	if !spoofRes.SpoofRejected || spoofRes.AnalyticsSessionID == nil || *spoofRes.AnalyticsSessionID == ingested.SessionID || spoofRes.LinkMethod != pg.LinkMethodFallbackUpsert {
		t.Fatalf("expected spoof rejected + fallback_upserted, got %+v", spoofRes)
	}

	// 3b. Victim submitting at 00:15 UTC links prior-day 23:55 UTC session via 30-min UTC-midnight grace (candidate + visitor_hash).
	currVictimIPHash := analytics.HashVisitorIP(victimIP, currSalt)
	currVictimVisitorHash := analytics.HashVisitorIdentity(victimIP, victimUA, currSalt)
	graceCandRes := store.ResolveOrCreateContactSession(ctx, pg.ContactLinkParams{
		CandidateSessionID: ingested.SessionID,
		CurrentIPHash:      currVictimIPHash,
		CurrentVisitorHash: currVictimVisitorHash,
		PriorIPHash:        prevMeta.IPHash,
		PriorVisitorHash:   prevMeta.VisitorHash,
		FallbackMeta:       pg.PortalAnalyticsMeta{IPHash: currVictimIPHash, VisitorHash: currVictimVisitorHash},
		CorrelationID:      "corr-grace-cand",
		Now:                tAfterMidnight,
	})
	if graceCandRes.SpoofRejected || graceCandRes.AnalyticsSessionID == nil || *graceCandRes.AnalyticsSessionID != ingested.SessionID || graceCandRes.LinkMethod != pg.LinkMethodVerifiedClient {
		t.Fatalf("expected verified_client_session across UTC midnight grace, got %+v", graceCandRes)
	}

	graceVisRes := store.ResolveOrCreateContactSession(ctx, pg.ContactLinkParams{
		CurrentIPHash:      currVictimIPHash,
		CurrentVisitorHash: currVictimVisitorHash,
		PriorIPHash:        prevMeta.IPHash,
		PriorVisitorHash:   prevMeta.VisitorHash,
		FallbackMeta:       pg.PortalAnalyticsMeta{IPHash: currVictimIPHash, VisitorHash: currVictimVisitorHash},
		CorrelationID:      "corr-grace-vis",
		Now:                tAfterMidnight,
	})
	if graceVisRes.AnalyticsSessionID == nil || *graceVisRes.AnalyticsSessionID != ingested.SessionID || graceVisRes.LinkMethod != pg.LinkMethodVisitorHash {
		t.Fatalf("expected visitor_hash_match across UTC midnight grace, got %+v", graceVisRes)
	}

	// 3c. Guest session match when visitor hash does not match.
	guestRes := store.ResolveOrCreateContactSession(ctx, pg.ContactLinkParams{
		GuestSessionID:     victimGuest,
		CurrentIPHash:      analytics.HashVisitorIP("198.51.100.201", currSalt),
		CurrentVisitorHash: analytics.HashVisitorIdentity("198.51.100.201", "OtherBrowser", currSalt),
		FallbackMeta:       pg.PortalAnalyticsMeta{IPHash: currVictimIPHash, VisitorHash: currVictimVisitorHash},
		CorrelationID:      "corr-guest-match",
		Now:                tAfterMidnight,
	})
	if guestRes.AnalyticsSessionID == nil || *guestRes.AnalyticsSessionID != ingested.SessionID || guestRes.LinkMethod != pg.LinkMethodGuestSession {
		t.Fatalf("expected guest_session_match, got %+v", guestRes)
	}

	// 3d. Cancelled context triggers failOpen + portal.contact.analytics_link_failed seam.
	cancelledCtx, cancel := context.WithCancel(ctx)
	cancel()
	failOpenRes := store.ResolveOrCreateContactSession(cancelledCtx, pg.ContactLinkParams{
		CandidateSessionID: ingested.SessionID,
		CurrentIPHash:      currVictimIPHash,
		CurrentVisitorHash: currVictimVisitorHash,
		CorrelationID:      "corr-fail-open",
		Now:                tAfterMidnight,
	})
	if failOpenRes.AnalyticsSessionID != nil || failOpenRes.LinkMethod != pg.LinkMethodFailOpenNull {
		t.Fatalf("expected fail_open_null on cancelled ctx, got %+v", failOpenRes)
	}

	logs := logBuf.String()
	for _, expected := range []string{
		`"event":"portal.contact.analytics_session_spoof_rejected"`,
		`"event":"analytics.contact.link_method_branch"`,
		`"branch":"verified_client_session"`,
		`"branch":"visitor_hash_match"`,
		`"branch":"guest_session_match"`,
		`"branch":"fallback_upserted"`,
		`"branch":"fail_open_null"`,
		`"event":"portal.contact.analytics_link_failed"`,
	} {
		if !strings.Contains(logs, expected) {
			t.Fatalf("expected seam log %s in:\n%s", expected, logs)
		}
	}
}

func TestPortalAPIUnicodeAnalyticsNulContactGuestOwnershipAndSsrEventNameLivePG19(t *testing.T) {
	portalDSN := requirePortalDatabaseURL(t)
	const testSecret = "portal-api-e2e-c2-secret-0123456789"
	const testSalt = "portal-api-e2e-c2-salt"

	baseURL := e2etest.StartBinary(
		t,
		"../portal-api",
		"PORTAL_DATABASE_URL="+portalDSN,
		"DATABASE_URL=",
		"INTERNAL_AUTH_SECRET="+testSecret,
		"ANALYTICS_DAILY_SALT="+testSalt,
		"AGENSI_SYNC_DISABLED=true",
	)

	h2cClient := grpckit.NewH2CClient()
	svcOpts := []connect.ClientOption{
		connect.WithGRPC(),
		connect.WithInterceptors(grpckit.NewClientAuthInterceptor(grpckit.ClientAuthConfig{
			Role: internalauth.RoleService, Subject: "portal-api-e2e-c2", Secret: testSecret,
		})),
	}
	analyticsClient := portalv1connect.NewAnalyticsServiceClient(h2cClient, baseURL, svcOpts...)
	contactClient := portalv1connect.NewContactServiceClient(h2cClient, baseURL, svcOpts...)

	ctx := context.Background()
	const ip = "198.51.100.199"

	// 1. SSR hit persists event name = 'portal_page_view'.
	ssrReq := connect.NewRequest(&portalv1.RecordSsrHitRequest{
		Pathname:      "/projects",
		ClientContext: &portalv1.ClientRequestContext{UserAgent: "Mozilla/5.0 Chrome/131.0.0.0"},
	})
	ssrReq.Header().Set(grpckit.MetadataInternalClientIP, signClientIP(t, ip, testSecret))
	ssrRes, err := analyticsClient.RecordSsrHit(ctx, ssrReq)
	if err != nil || ssrRes.Msg.GetSessionId() == "" {
		t.Fatalf("RecordSsrHit failed: %v", err)
	}
	conn, err := pgx.Connect(ctx, portalDSN)
	if err != nil {
		t.Fatalf("connect portal_app: %v", err)
	}
	defer conn.Close(ctx)
	var storedEventName string
	if err := conn.QueryRow(
		ctx,
		`SELECT name FROM analytics_events WHERE session_id = $1 AND type = 'page_view' ORDER BY id DESC LIMIT 1`,
		ssrRes.Msg.GetSessionId(),
	).Scan(&storedEventName); err != nil {
		t.Fatalf("query stored SSR event name: %v", err)
	}
	if storedEventName != "portal_page_view" {
		t.Fatalf("expected SSR page_view event name 'portal_page_view', got %q", storedEventName)
	}

	// 2. Multi-byte UTF-8 analytics paths succeed against live PG19 (no SQLSTATE 22021 -> 503).
	cjkPath := "/p/" + strings.Repeat("日", 200)
	accentPath := "/" + strings.Repeat("a", 510) + "é"
	utf8Req := connect.NewRequest(&portalv1.IngestAnalyticsRequest{
		SessionId:   ssrRes.Msg.GetSessionId(),
		LandingPath: &cjkPath,
		Events: []*portalv1.AnalyticsEvent{
			{Type: "interaction", Name: "cjk_nav", Path: cjkPath, Timestamp: time.Now().UTC().Format(time.RFC3339Nano)},
			{Type: "interaction", Name: "accent_nav", Path: accentPath, Timestamp: time.Now().UTC().Format(time.RFC3339Nano)},
		},
		ClientContext: &portalv1.ClientRequestContext{UserAgent: "Mozilla/5.0 Chrome/131.0.0.0"},
	})
	utf8Req.Header().Set(grpckit.MetadataInternalClientIP, signClientIP(t, ip, testSecret))
	utf8Res, err := analyticsClient.IngestAnalytics(ctx, utf8Req)
	if err != nil || utf8Res.Msg.GetAccepted() != 2 {
		t.Fatalf("expected multi-byte UTF-8 IngestAnalytics to accept 2 events cleanly, got res=%+v err=%v", utf8Res, err)
	}

	// 3. Contact submission containing NUL byte returns 400 ERR_VALIDATION with field_errors.message.
	nulReq := connect.NewRequest(&portalv1.SubmitContactRequest{
		Name:    "Ada Lovelace",
		Email:   "ada@analytical-engine.org",
		Message: "Valid length message containing an embedded\x00nul byte.",
	})
	nulReq.Header().Set(grpckit.MetadataInternalClientIP, signClientIP(t, ip, testSecret))
	_, nulErr := contactClient.SubmitContact(ctx, nulReq)
	if connect.CodeOf(nulErr) != connect.CodeInvalidArgument {
		t.Fatalf("expected CodeInvalidArgument (400) for NUL in contact message, got %v", nulErr)
	}
	nulEnv := extractErrorDetail(t, nulErr)
	if nulEnv.GetError().GetStatus() != 400 || nulEnv.GetError().GetCode() != contracts.ErrCodeValidation ||
		len(nulEnv.GetError().GetFieldErrors()["message"].GetMessages()) == 0 {
		t.Fatalf("expected 400 ERR_VALIDATION with field_errors.message, got %+v", nulEnv.GetError())
	}

	// 4. Guest GetAskContent rejects cross-session session_id spoofing with CodePermissionDenied.
	guestContentClient := portalv1connect.NewPortalContentServiceClient(
		h2cClient,
		baseURL,
		connect.WithGRPC(),
		connect.WithInterceptors(grpckit.NewClientAuthInterceptor(grpckit.ClientAuthConfig{
			Role: internalauth.RoleGuest, Subject: "guest_real_owner", Secret: testSecret,
		})),
	)
	if _, err := guestContentClient.GetAskContent(ctx, connect.NewRequest(&portalv1.GetAskContentRequest{
		SessionId: "guest_other_victim",
	})); connect.CodeOf(err) != connect.CodePermissionDenied {
		t.Fatalf("expected CodePermissionDenied when guest requests another session_id, got %v", err)
	}
	if ownRes, err := guestContentClient.GetAskContent(ctx, connect.NewRequest(&portalv1.GetAskContentRequest{})); err != nil || ownRes.Msg.GetQuota().GetMaxTurns() <= 0 {
		t.Fatalf("expected guest GetAskContent with empty session_id to use claims.Sub and succeed, got res=%+v err=%v", ownRes, err)
	}
}
