package pg

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const (
	LinkMethodVerifiedClient = "verified_client_session"
	LinkMethodVisitorHash    = "visitor_hash_match"
	LinkMethodGuestSession   = "guest_session_match"
	LinkMethodFallbackUpsert = "fallback_upserted"
	LinkMethodFailOpenNull   = "fail_open_null"
)

type ContactLinkParams struct {
	CandidateSessionID string
	GuestSessionID     string
	CurrentIPHash      string
	CurrentVisitorHash string
	PriorIPHash        string
	PriorVisitorHash   string
	FallbackMeta       PortalAnalyticsMeta
	CorrelationID      string
	Now                time.Time
}

type ContactLinkResult struct {
	AnalyticsSessionID *string
	GuestSessionID     *string
	LinkMethod         string
	SpoofRejected      bool
}

func emitContactLinkBranch(branch, corrID string) {
	fields := map[string]any{"branch": branch}
	if corrID != "" {
		fields["correlationId"] = corrID
	}
	emitPortalPGSeam("RULE_DIVERGENCE", "analytics.contact.link_method_branch", fields)
}

func findRecentPortalSessionByVisitorHash(
	ctx context.Context,
	q agensiQueryer,
	currentVisitorHash, priorVisitorHash string,
	now time.Time,
) (string, *string, error) {
	var row pgx.Row
	if priorVisitorHash != "" {
		row = q.QueryRow(
			ctx,
			`SELECT session_id, guest_session_id
			 FROM analytics_sessions
			 WHERE app = 'portal'
			   AND visitor_hash IN ($1, $2)
			   AND COALESCE(last_seen_at, started_at) >= $3::timestamptz - ($4 * interval '1 minute')
			 ORDER BY COALESCE(last_seen_at, started_at) DESC, started_at DESC
			 LIMIT 1`,
			currentVisitorHash,
			priorVisitorHash,
			now.UTC(),
			portalSessionIdleMinutes,
		)
	} else {
		row = q.QueryRow(
			ctx,
			`SELECT session_id, guest_session_id
			 FROM analytics_sessions
			 WHERE app = 'portal'
			   AND visitor_hash = $1
			   AND started_at >= date_trunc('day', $2::timestamptz AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
			   AND COALESCE(last_seen_at, started_at) >= $2::timestamptz - ($3 * interval '1 minute')
			 ORDER BY COALESCE(last_seen_at, started_at) DESC, started_at DESC
			 LIMIT 1`,
			currentVisitorHash,
			now.UTC(),
			portalSessionIdleMinutes,
		)
	}
	var sessionID string
	var guestID *string
	if err := row.Scan(&sessionID, &guestID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil, nil
		}
		return "", nil, err
	}
	return sessionID, guestID, nil
}

func stampGuestOnAnalyticsSession(
	ctx context.Context,
	exec interface {
		Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
	},
	sessionID string,
	guestID *string,
	now time.Time,
) error {
	if guestID == nil || strings.TrimSpace(*guestID) == "" {
		return nil
	}
	_, err := exec.Exec(
		ctx,
		`UPDATE analytics_sessions
		 SET guest_session_id = COALESCE(guest_session_id, $2),
		     last_seen_at = GREATEST(COALESCE(last_seen_at, started_at), $3::timestamptz)
		 WHERE session_id = $1`,
		sessionID,
		strings.TrimSpace(*guestID),
		now.UTC(),
	)
	return err
}

// ResolveOrCreateContactSession verifies a candidate analyticsSessionId against ownership
// invariants (with 30-min UTC-midnight prior-day grace), falling back cleanly and failing open.
func (s *Store) ResolveOrCreateContactSession(ctx context.Context, p ContactLinkParams) ContactLinkResult {
	now := p.Now
	if now.IsZero() {
		now = time.Now().UTC()
	}
	var normGuest *string
	if g := strings.TrimSpace(p.GuestSessionID); g != "" {
		normGuest = &g
	}
	candID := strings.TrimSpace(p.CandidateSessionID)
	spoofRejected := false

	failOpen := func(err error) ContactLinkResult {
		emitPortalPGSeam("BOUNDARY_FAULT", "portal.contact.analytics_link_failed", map[string]any{
			"correlationId": p.CorrelationID,
			"detail":        err.Error(),
		})
		emitContactLinkBranch(LinkMethodFailOpenNull, p.CorrelationID)
		return ContactLinkResult{
			AnalyticsSessionID: nil,
			GuestSessionID:     normGuest,
			LinkMethod:         LinkMethodFailOpenNull,
			SpoofRejected:      spoofRejected,
		}
	}

	if s == nil || s.pool == nil {
		sid := "sess_" + contracts.NewUUIDv4()
		emitContactLinkBranch(LinkMethodFallbackUpsert, p.CorrelationID)
		return ContactLinkResult{
			AnalyticsSessionID: &sid,
			GuestSessionID:     normGuest,
			LinkMethod:         LinkMethodFallbackUpsert,
		}
	}

	if candID != "" {
		var rowSessionID, rowApp, rowIPHash string
		var rowVisitorHash, rowGuestID *string
		err := s.pool.QueryRow(
			ctx,
			`SELECT session_id, app, visitor_hash, ip_hash, guest_session_id
			 FROM analytics_sessions
			 WHERE session_id = $1
			 LIMIT 1`,
			candID,
		).Scan(&rowSessionID, &rowApp, &rowVisitorHash, &rowIPHash, &rowGuestID)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return failOpen(err)
		}
		found := err == nil
		ownerMatch := found && rowApp == "portal" && (
			(rowVisitorHash != nil && (*rowVisitorHash == p.CurrentVisitorHash || (p.PriorVisitorHash != "" && *rowVisitorHash == p.PriorVisitorHash))) ||
			rowIPHash == p.CurrentIPHash ||
			(p.PriorIPHash != "" && rowIPHash == p.PriorIPHash) ||
			(normGuest != nil && rowGuestID != nil && *rowGuestID == *normGuest))
		if ownerMatch {
			if err := stampGuestOnAnalyticsSession(ctx, s.pool, rowSessionID, normGuest, now); err != nil {
				return failOpen(err)
			}
			effectiveGuest := normGuest
			if effectiveGuest == nil {
				effectiveGuest = rowGuestID
			}
			emitContactLinkBranch(LinkMethodVerifiedClient, p.CorrelationID)
			return ContactLinkResult{
				AnalyticsSessionID: &rowSessionID,
				GuestSessionID:     effectiveGuest,
				LinkMethod:         LinkMethodVerifiedClient,
			}
		}
		spoofRejected = true
		reason := "ownership_mismatch"
		if !found {
			reason = "missing_session"
		} else if rowApp != "portal" {
			reason = "non_portal_session"
		}
		emitPortalPGSeam("UNSOUND_CONDITION", "portal.contact.analytics_session_spoof_rejected", map[string]any{
			"reason":        reason,
			"correlationId": p.CorrelationID,
		})
	}

	matchedID, matchedGuest, err := findRecentPortalSessionByVisitorHash(ctx, s.pool, p.CurrentVisitorHash, p.PriorVisitorHash, now)
	if err != nil {
		return failOpen(err)
	}
	if matchedID != "" {
		if err := stampGuestOnAnalyticsSession(ctx, s.pool, matchedID, normGuest, now); err != nil {
			return failOpen(err)
		}
		effectiveGuest := normGuest
		if effectiveGuest == nil {
			effectiveGuest = matchedGuest
		}
		emitContactLinkBranch(LinkMethodVisitorHash, p.CorrelationID)
		return ContactLinkResult{
			AnalyticsSessionID: &matchedID,
			GuestSessionID:     effectiveGuest,
			LinkMethod:         LinkMethodVisitorHash,
			SpoofRejected:      spoofRejected,
		}
	}

	if normGuest != nil {
		var guestSessionMatch string
		gErr := s.pool.QueryRow(
			ctx,
			`SELECT session_id
			 FROM analytics_sessions
			 WHERE app = 'portal' AND guest_session_id = $1
			 ORDER BY COALESCE(last_seen_at, started_at) DESC, started_at DESC
			 LIMIT 1`,
			*normGuest,
		).Scan(&guestSessionMatch)
		if gErr == nil && guestSessionMatch != "" {
			emitContactLinkBranch(LinkMethodGuestSession, p.CorrelationID)
			return ContactLinkResult{
				AnalyticsSessionID: &guestSessionMatch,
				GuestSessionID:     normGuest,
				LinkMethod:         LinkMethodGuestSession,
				SpoofRejected:      spoofRejected,
			}
		}
		if gErr != nil && !errors.Is(gErr, pgx.ErrNoRows) {
			return failOpen(gErr)
		}
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return failOpen(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if p.FallbackMeta.VisitorHash != "" {
		if err := acquirePortalVisitorLockTx(ctx, tx, p.FallbackMeta.VisitorHash); err != nil {
			return failOpen(err)
		}
		racedID, racedGuest, rErr := findRecentPortalSessionByVisitorHash(ctx, tx, p.CurrentVisitorHash, p.PriorVisitorHash, now)
		if rErr != nil {
			return failOpen(rErr)
		}
		if racedID != "" {
			if err := stampGuestOnAnalyticsSession(ctx, tx, racedID, normGuest, now); err != nil {
				return failOpen(err)
			}
			if err := tx.Commit(ctx); err != nil {
				return failOpen(err)
			}
			effectiveGuest := normGuest
			if effectiveGuest == nil {
				effectiveGuest = racedGuest
			}
			emitContactLinkBranch(LinkMethodVisitorHash, p.CorrelationID)
			return ContactLinkResult{
				AnalyticsSessionID: &racedID,
				GuestSessionID:     effectiveGuest,
				LinkMethod:         LinkMethodVisitorHash,
				SpoofRejected:      spoofRejected,
			}
		}
	}

	fallbackID := "sess_" + contracts.NewUUIDv4()
	if _, err := upsertPortalAnalyticsSessionTx(ctx, tx, fallbackID, p.FallbackMeta, now); err != nil {
		return failOpen(err)
	}
	if err := tx.Commit(ctx); err != nil {
		return failOpen(err)
	}
	emitContactLinkBranch(LinkMethodFallbackUpsert, p.CorrelationID)
	return ContactLinkResult{
		AnalyticsSessionID: &fallbackID,
		GuestSessionID:     normGuest,
		LinkMethod:         LinkMethodFallbackUpsert,
		SpoofRejected:      spoofRejected,
	}
}
