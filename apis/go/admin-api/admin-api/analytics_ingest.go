package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/analytics"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	adminv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1"
	portalv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1"
)

const (
	adminAnalyticsMaxPerMinute = 120
	adminAnalyticsRateWindow   = time.Minute
)

func (s *adminAnalyticsServiceServer) IngestAdminAnalytics(
	ctx context.Context,
	req *connect.Request[adminv1.IngestAdminAnalyticsRequest],
) (*connect.Response[adminv1.IngestAdminAnalyticsResponse], error) {
	corrID := resolveCorrID(ctx)
	adminSession, err := s.deps.requireAdminAuth(ctx, req.Header(), req.Msg.GetAdminSessionId())
	if err != nil {
		logAdminSeam("RULE_DIVERGENCE", "admin.analytics.ingest_auth_branch", map[string]any{"branch": "unauthenticated_rejected_401", "correlationId": corrID})
		return nil, err
	}

	adapted := &portalv1.IngestAnalyticsRequest{
		SessionId:   req.Msg.GetSessionId(),
		Referrer:    req.Msg.Referrer,
		LandingPath: req.Msg.LandingPath,
		RefParam:    req.Msg.RefParam,
		UtmSource:   req.Msg.UtmSource,
		UtmMedium:   req.Msg.UtmMedium,
		UtmCampaign: req.Msg.UtmCampaign,
		UtmContent:  req.Msg.UtmContent,
		Events:      req.Msg.GetEvents(),
	}
	if valErr := analytics.ValidateBatchBounds(adapted); valErr != nil {
		logAdminSeam("RULE_DIVERGENCE", "admin.analytics.ingest_auth_branch", map[string]any{"branch": "rejected_payload", "correlationId": corrID})
		return nil, newAdminError(connect.CodeInvalidArgument, contracts.ErrCodeValidation, http.StatusBadRequest, "Invalid analytics payload.", "Review event metadata limits and retry.", corrID, nil)
	}

	rlDecision, rlErr := s.deps.store.ConsumePortalRateLimit(ctx, "admin:analytics:user:"+adminSession.UserID, adminAnalyticsMaxPerMinute, adminAnalyticsRateWindow)
	if rlErr != nil {
		return nil, mapAdminStoreError(rlErr, corrID)
	}
	if !rlDecision.Allowed {
		logAdminSeam("RULE_DIVERGENCE", "admin.analytics.ingest_auth_branch", map[string]any{"branch": "rate_limited_429", "correlationId": corrID})
		retry := int32(rlDecision.RetryAfterSeconds)
		return nil, newAdminError(connect.CodeResourceExhausted, contracts.ErrCodeRateLimited, http.StatusTooManyRequests, "Too many analytics requests.", "Retry shortly.", corrID, &retry)
	}

	baseSalt, saltErr := analytics.ResolveDailySaltSecret(s.deps.dailySalt)
	if saltErr != nil {
		return nil, newAdminError(connect.CodeInternal, contracts.ErrCodeInternal, http.StatusInternalServerError, "Analytics daily salt is not configured.", "Check ANALYTICS_DAILY_SALT.", corrID, nil)
	}
	clientIP, ipErr := resolveClientIP(req.Header(), "", s.deps.adminSecret)
	if ipErr != nil {
		return nil, ipErr
	}
	now := s.deps.now().UTC()
	daySalt := analytics.BuildDailySalt(baseSalt, now)
	ipHash := analytics.HashVisitorIP(clientIP, daySalt)
	ua := ""
	if req.Msg.ClientContext != nil {
		ua = req.Msg.ClientContext.GetUserAgent()
	}
	visitorHash := analytics.HashVisitorIdentity(clientIP, ua, daySalt)
	uaProfile := analytics.ParseUserAgentProfile(ua)
	sessionID := strings.TrimSpace(req.Msg.GetSessionId())

	var landingPath *string
	if raw := optString(req.Msg.LandingPath); raw != nil {
		norm := analytics.NormalizeLandingPath(*raw)
		landingPath = &norm
	}

	tx, err := s.deps.store.Pool().Begin(ctx)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tag, err := tx.Exec(
		ctx,
		`INSERT INTO analytics_sessions (
			session_id, ip_hash, visitor_hash, started_at, last_seen_at, app, is_bot,
			landing_path, device_type, os_name, browser_name
		) VALUES ($1, $2, $3, $4, $4, 'admin', false, $5, $6, $7, $8)
		ON CONFLICT (session_id) DO UPDATE SET
			last_seen_at = GREATEST(COALESCE(analytics_sessions.last_seen_at, analytics_sessions.started_at), EXCLUDED.last_seen_at)
		WHERE analytics_sessions.app = 'admin'`,
		sessionID, ipHash, visitorHash, now, landingPath, uaProfile.DeviceType, uaProfile.OSName, uaProfile.BrowserName,
	)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if tag.RowsAffected() == 0 {
		sessionID = "sess_" + contracts.NewUUIDv4()
		if _, err := tx.Exec(
			ctx,
			`INSERT INTO analytics_sessions (
				session_id, ip_hash, visitor_hash, started_at, last_seen_at, app, is_bot,
				landing_path, device_type, os_name, browser_name
			) VALUES ($1, $2, $3, $4, $4, 'admin', false, $5, $6, $7, $8)`,
			sessionID, ipHash, visitorHash, now, landingPath, uaProfile.DeviceType, uaProfile.OSName, uaProfile.BrowserName,
		); err != nil {
			return nil, mapAdminStoreError(err, corrID)
		}
	}

	accepted := int32(0)
	for _, ev := range req.Msg.GetEvents() {
		metaMap := make(map[string]any, len(ev.GetMetadata()))
		for k, v := range ev.GetMetadata() {
			switch kind := v.GetKind().(type) {
			case *portalv1.AnalyticsMetadataValue_StringValue:
				metaMap[k] = kind.StringValue
			case *portalv1.AnalyticsMetadataValue_NumberValue:
				metaMap[k] = kind.NumberValue
			case *portalv1.AnalyticsMetadataValue_BoolValue:
				metaMap[k] = kind.BoolValue
			}
		}
		metaBytes, _ := json.Marshal(metaMap)
		if _, err := tx.Exec(
			ctx,
			`INSERT INTO analytics_events (session_id, type, name, path, value, metadata_json, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
			sessionID, ev.GetType(), ev.GetName(), analytics.NormalizeLandingPath(ev.GetPath()), ev.Value, string(metaBytes), now,
		); err != nil {
			return nil, mapAdminStoreError(err, corrID)
		}
		accepted++
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}

	logAdminSeam("RULE_DIVERGENCE", "admin.analytics.ingest_auth_branch", map[string]any{
		"branch":        "authenticated_accepted",
		"accepted":      accepted,
		"correlationId": corrID,
	})
	return connect.NewResponse(&adminv1.IngestAdminAnalyticsResponse{
		Accepted:  accepted,
		SessionId: sessionID,
		IpHash:    ipHash,
	}), nil
}
