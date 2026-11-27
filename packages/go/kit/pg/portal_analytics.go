package pg

import (
	"context"
	"errors"
	"math"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/analytics"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/jackc/pgx/v5"
)

const (
	portalSessionIdleMinutes      = 30
	portalPageViewDedupSeconds    = 15
	portalEventClockSkewMaxWindow = 5 * time.Second
)

type RateLimitDecision struct {
	Allowed           bool
	Remaining         int
	RetryAfterSeconds int
}

type PortalAnalyticsMeta struct {
	IPHash           string
	VisitorHash      string
	IsBot            bool
	GuestSessionID   *string
	Country          *string
	Region           *string
	City             *string
	Timezone         *string
	ASN              *int32
	ASNOrg           *string
	Referrer         *string
	ReferrerHost     *string
	ReferrerCategory *string
	LandingPath      *string
	RefParam         *string
	UTMSource        *string
	UTMMedium        *string
	UTMCampaign      *string
	UTMContent       *string
	DeviceType       *string
	OSName           *string
	BrowserName      *string
}

type PortalAnalyticsEventInput struct {
	Type      string
	Name      string
	Path      string
	Value     *float64
	Metadata  map[string]any
	Timestamp string
}

type PortalAnalyticsIngestResult struct {
	Accepted  int
	SessionID string
	IPHash    string
}

// ConsumePortalRateLimit atomically increments a rate_limit_buckets row (e.g. contact:ip:* or
// analytics:ip:*) compatible with portal_app RLS policies.
func (s *Store) ConsumePortalRateLimit(
	ctx context.Context,
	scopeKey string,
	maxAttempts int,
	window time.Duration,
) (RateLimitDecision, error) {
	if maxAttempts < 1 {
		maxAttempts = 1
	}
	if window < time.Second {
		window = time.Second
	}
	now := time.Now().UTC()
	cutoff := now.Add(-window)

	if s == nil || s.pool == nil {
		return RateLimitDecision{Allowed: true, Remaining: maxAttempts - 1, RetryAfterSeconds: 1}, nil
	}

	var windowStart time.Time
	var turnsUsed int
	err := s.pool.QueryRow(
		ctx,
		`INSERT INTO rate_limit_buckets (scope_key, window_start, turns_used, tokens_used)
		 VALUES ($1, $2, 1, 0)
		 ON CONFLICT (scope_key) DO UPDATE SET
		   window_start = CASE WHEN rate_limit_buckets.window_start <= $3 THEN $2 ELSE rate_limit_buckets.window_start END,
		   turns_used = CASE WHEN rate_limit_buckets.window_start <= $3 THEN 1 ELSE LEAST(rate_limit_buckets.turns_used + 1, $4) END
		 RETURNING window_start, turns_used`,
		scopeKey,
		now,
		cutoff,
		maxAttempts+1,
	).Scan(&windowStart, &turnsUsed)
	if err != nil {
		return RateLimitDecision{}, err
	}

	allowed := turnsUsed <= maxAttempts
	remaining := maxAttempts - turnsUsed
	if remaining < 0 {
		remaining = 0
	}
	resetAt := windowStart.Add(window)
	retryAfter := int(math.Ceil(resetAt.Sub(now).Seconds()))
	if retryAfter < 1 {
		retryAfter = 1
	}
	return RateLimitDecision{
		Allowed:           allowed,
		Remaining:         remaining,
		RetryAfterSeconds: retryAfter,
	}, nil
}

func stripNulString(s string) string {
	return strings.ReplaceAll(s, "\x00", "")
}

func cleanNullableStr(p *string) *string {
	if p == nil {
		return nil
	}
	trimmed := strings.TrimSpace(stripNulString(*p))
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func acquirePortalVisitorLockTx(ctx context.Context, tx pgx.Tx, visitorHash string) error {
	if strings.TrimSpace(visitorHash) == "" {
		return nil
	}
	lockKey := "analytics_session:portal:" + visitorHash
	_, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, lockKey)
	return err
}

func findActivePortalSameUtcDaySessionTx(ctx context.Context, tx pgx.Tx, visitorHash string, now time.Time) (string, error) {
	var sessionID string
	err := tx.QueryRow(
		ctx,
		`SELECT session_id
		 FROM analytics_sessions
		 WHERE app = 'portal'
		   AND visitor_hash = $1
		   AND started_at >= date_trunc('day', $2::timestamptz AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
		   AND COALESCE(last_seen_at, started_at) >= $2::timestamptz - ($3 * interval '1 minute')
		 ORDER BY COALESCE(last_seen_at, started_at) DESC, started_at DESC
		 LIMIT 1`,
		visitorHash,
		now.UTC(),
		portalSessionIdleMinutes,
	).Scan(&sessionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return sessionID, err
}

func upsertPortalAnalyticsSessionTx(ctx context.Context, tx pgx.Tx, sessionID string, meta PortalAnalyticsMeta, now time.Time) (bool, error) {
	var visitorHashPtr *string
	if v := strings.TrimSpace(meta.VisitorHash); v != "" {
		visitorHashPtr = &v
	}
	var landingPath *string
	if meta.LandingPath != nil && strings.TrimSpace(*meta.LandingPath) != "" {
		norm := analytics.NormalizeLandingPath(*meta.LandingPath)
		landingPath = &norm
	}

	var returnedID string
	err := tx.QueryRow(
		ctx,
		`INSERT INTO analytics_sessions (
			session_id, ip_hash, referrer, country, region, started_at, app, is_bot,
			visitor_hash, guest_session_id, city, timezone, asn, asn_org,
			referrer_host, referrer_category, landing_path, ref_param,
			utm_source, utm_medium, utm_campaign, utm_content,
			device_type, os_name, browser_name, last_seen_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, 'portal', $7,
			$8, $9, $10, $11, $12, $13,
			$14, $15, $16, $17,
			$18, $19, $20, $21,
			$22, $23, $24, $6
		)
		ON CONFLICT (session_id) DO UPDATE SET
			last_seen_at = GREATEST(COALESCE(analytics_sessions.last_seen_at, analytics_sessions.started_at), EXCLUDED.last_seen_at),
			is_bot = analytics_sessions.is_bot OR EXCLUDED.is_bot,
			visitor_hash = COALESCE(analytics_sessions.visitor_hash, EXCLUDED.visitor_hash),
			guest_session_id = COALESCE(analytics_sessions.guest_session_id, EXCLUDED.guest_session_id),
			referrer = COALESCE(analytics_sessions.referrer, EXCLUDED.referrer),
			referrer_host = COALESCE(analytics_sessions.referrer_host, EXCLUDED.referrer_host),
			referrer_category = CASE
				WHEN analytics_sessions.referrer_host IS NULL AND EXCLUDED.referrer_host IS NOT NULL
				THEN EXCLUDED.referrer_category
				ELSE COALESCE(analytics_sessions.referrer_category, EXCLUDED.referrer_category)
			END,
			landing_path = COALESCE(analytics_sessions.landing_path, EXCLUDED.landing_path),
			ref_param = COALESCE(analytics_sessions.ref_param, EXCLUDED.ref_param),
			utm_source = COALESCE(analytics_sessions.utm_source, EXCLUDED.utm_source),
			utm_medium = COALESCE(analytics_sessions.utm_medium, EXCLUDED.utm_medium),
			utm_campaign = COALESCE(analytics_sessions.utm_campaign, EXCLUDED.utm_campaign),
			utm_content = COALESCE(analytics_sessions.utm_content, EXCLUDED.utm_content),
			country = COALESCE(analytics_sessions.country, EXCLUDED.country),
			region = COALESCE(analytics_sessions.region, EXCLUDED.region),
			city = COALESCE(analytics_sessions.city, EXCLUDED.city),
			timezone = COALESCE(analytics_sessions.timezone, EXCLUDED.timezone),
			asn = COALESCE(analytics_sessions.asn, EXCLUDED.asn),
			asn_org = COALESCE(analytics_sessions.asn_org, EXCLUDED.asn_org),
			device_type = COALESCE(analytics_sessions.device_type, EXCLUDED.device_type),
			os_name = COALESCE(analytics_sessions.os_name, EXCLUDED.os_name),
			browser_name = COALESCE(analytics_sessions.browser_name, EXCLUDED.browser_name)
		WHERE analytics_sessions.app = EXCLUDED.app
		  AND analytics_sessions.visitor_hash IS NOT DISTINCT FROM EXCLUDED.visitor_hash
		RETURNING session_id`,
		stripNulString(sessionID),
		meta.IPHash,
		cleanNullableStr(meta.Referrer),
		cleanNullableStr(meta.Country),
		cleanNullableStr(meta.Region),
		now.UTC(),
		meta.IsBot,
		visitorHashPtr,
		cleanNullableStr(meta.GuestSessionID),
		cleanNullableStr(meta.City),
		cleanNullableStr(meta.Timezone),
		meta.ASN,
		cleanNullableStr(meta.ASNOrg),
		cleanNullableStr(meta.ReferrerHost),
		cleanNullableStr(meta.ReferrerCategory),
		landingPath,
		cleanNullableStr(meta.RefParam),
		cleanNullableStr(meta.UTMSource),
		cleanNullableStr(meta.UTMMedium),
		cleanNullableStr(meta.UTMCampaign),
		cleanNullableStr(meta.UTMContent),
		cleanNullableStr(meta.DeviceType),
		cleanNullableStr(meta.OSName),
		cleanNullableStr(meta.BrowserName),
	).Scan(&returnedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return returnedID != "", nil
}

// BindPortalGuestSessionTx attaches a passive verified guest_session_id to the active portal
// analytics session (or mints one) under pg_advisory_xact_lock.
func (s *Store) BindPortalGuestSessionTx(ctx context.Context, meta PortalAnalyticsMeta, now time.Time) (string, error) {
	if now.IsZero() {
		now = time.Now().UTC()
	}
	if meta.GuestSessionID == nil || strings.TrimSpace(*meta.GuestSessionID) == "" || strings.TrimSpace(meta.VisitorHash) == "" {
		return "", nil
	}
	if s == nil || s.pool == nil {
		return "sess_" + contracts.NewUUIDv4(), nil
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := acquirePortalVisitorLockTx(ctx, tx, meta.VisitorHash); err != nil {
		return "", err
	}
	targetID, err := findActivePortalSameUtcDaySessionTx(ctx, tx, meta.VisitorHash, now)
	if err != nil {
		return "", err
	}
	if targetID == "" {
		targetID = "sess_" + contracts.NewUUIDv4()
	}
	upserted, err := upsertPortalAnalyticsSessionTx(ctx, tx, targetID, meta, now)
	if err != nil {
		return "", err
	}
	if !upserted {
		targetID = "sess_" + contracts.NewUUIDv4()
		if _, err := upsertPortalAnalyticsSessionTx(ctx, tx, targetID, meta, now); err != nil {
			return "", err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return targetID, nil
}
