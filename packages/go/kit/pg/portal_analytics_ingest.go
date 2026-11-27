package pg

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/analytics"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/jackc/pgx/v5"
)

func clampEventTimestamp(rawTS string, serverNow time.Time) time.Time {
	parsed, err := time.Parse(time.RFC3339Nano, strings.TrimSpace(rawTS))
	if err != nil {
		return serverNow.UTC()
	}
	parsed = parsed.UTC()
	minAllowed := serverNow.UTC().Add(-portalEventClockSkewMaxWindow)
	maxAllowed := serverNow.UTC().Add(portalEventClockSkewMaxWindow)
	if parsed.Before(minAllowed) {
		return minAllowed
	}
	if parsed.After(maxAllowed) {
		return maxAllowed
	}
	return parsed
}

// IngestPortalAnalyticsTx converges visitor sessions under pg_advisory_xact_lock, deduplicates
// 15s SSR/client page_view pairs, and inserts analytics_events.
func (s *Store) IngestPortalAnalyticsTx(
	ctx context.Context,
	meta PortalAnalyticsMeta,
	events []PortalAnalyticsEventInput,
	now time.Time,
) (PortalAnalyticsIngestResult, error) {
	if now.IsZero() {
		now = time.Now().UTC()
	}
	if s == nil || s.pool == nil {
		return PortalAnalyticsIngestResult{
			Accepted:  len(events),
			SessionID: "sess_" + contracts.NewUUIDv4(),
			IPHash:    meta.IPHash,
		}, nil
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return PortalAnalyticsIngestResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := acquirePortalVisitorLockTx(ctx, tx, meta.VisitorHash); err != nil {
		return PortalAnalyticsIngestResult{}, err
	}

	canonicalID, err := findActivePortalSameUtcDaySessionTx(ctx, tx, meta.VisitorHash, now)
	if err != nil {
		return PortalAnalyticsIngestResult{}, err
	}
	if canonicalID == "" {
		canonicalID = "sess_" + contracts.NewUUIDv4()
	}

	upserted, err := upsertPortalAnalyticsSessionTx(ctx, tx, canonicalID, meta, now)
	if err != nil {
		return PortalAnalyticsIngestResult{}, err
	}
	if !upserted {
		canonicalID = "sess_" + contracts.NewUUIDv4()
		if _, err := upsertPortalAnalyticsSessionTx(ctx, tx, canonicalID, meta, now); err != nil {
			return PortalAnalyticsIngestResult{}, err
		}
	}

	accepted := 0
	for _, ev := range events {
		normPath := analytics.NormalizeLandingPath(ev.Path)
		nav, _ := ev.Metadata["navigation"].(string)
		var counterpart string
		if ev.Type == "page_view" && nav == "initial" {
			counterpart = "ssr"
		} else if ev.Type == "page_view" && nav == "ssr" {
			counterpart = "initial"
		}
		if counterpart != "" {
			var dummy int
			dupErr := tx.QueryRow(
				ctx,
				`SELECT 1
				 FROM analytics_events
				 WHERE session_id = $1
				   AND type = 'page_view'
				   AND path = $2
				   AND metadata_json->>'navigation' = $3
				   AND created_at >= $4::timestamptz - ($5 * interval '1 second')
				   AND created_at <= $4::timestamptz + ($5 * interval '1 second')
				 LIMIT 1`,
				canonicalID,
				normPath,
				counterpart,
				now.UTC(),
				portalPageViewDedupSeconds,
			).Scan(&dummy)
			if dupErr == nil {
				continue
			}
			if !errors.Is(dupErr, pgx.ErrNoRows) {
				return PortalAnalyticsIngestResult{}, dupErr
			}
		}

		cleanMeta := make(map[string]any, len(ev.Metadata))
		for k, v := range ev.Metadata {
			ck := strings.TrimSpace(stripNulString(k))
			if ck == "" {
				continue
			}
			if sv, ok := v.(string); ok {
				cleanMeta[ck] = stripNulString(sv)
			} else {
				cleanMeta[ck] = v
			}
		}
		metaJSON, mErr := json.Marshal(cleanMeta)
		if mErr != nil {
			return PortalAnalyticsIngestResult{}, mErr
		}

		if _, err := tx.Exec(
			ctx,
			`INSERT INTO analytics_events (session_id, type, name, path, value, metadata_json, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
			canonicalID,
			ev.Type,
			stripNulString(ev.Name),
			normPath,
			ev.Value,
			string(metaJSON),
			clampEventTimestamp(ev.Timestamp, now),
		); err != nil {
			return PortalAnalyticsIngestResult{}, err
		}
		accepted++
	}

	if err := tx.Commit(ctx); err != nil {
		return PortalAnalyticsIngestResult{}, err
	}
	return PortalAnalyticsIngestResult{
		Accepted:  accepted,
		SessionID: canonicalID,
		IPHash:    meta.IPHash,
	}, nil
}
