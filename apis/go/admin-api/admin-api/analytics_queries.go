package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	adminv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1"
)

type normalizedAnalyticsFilter struct {
	Window     string
	Source     *string
	Country    *string
	Path       *string
	Campaign   *string
	Bots       string
	Identified string
	Cutoff     *time.Time
}

func normalizeAnalyticsFilter(in *adminv1.AdminAnalyticsFilter, now time.Time) normalizedAnalyticsFilter {
	f := normalizedAnalyticsFilter{
		Window:     "7d",
		Bots:       "exclude",
		Identified: "all",
	}
	if in != nil {
		switch strings.TrimSpace(in.GetWindow()) {
		case "24h", "7d", "30d", "all":
			f.Window = strings.TrimSpace(in.GetWindow())
		}
		switch strings.TrimSpace(in.GetBots()) {
		case "exclude", "include", "only":
			f.Bots = strings.TrimSpace(in.GetBots())
		}
		if strings.TrimSpace(in.GetIdentified()) == "true" {
			f.Identified = "true"
		}
		f.Source = optString(in.Source)
		f.Country = optString(in.Country)
		f.Path = optString(in.Path)
		f.Campaign = optString(in.Campaign)
	}
	switch f.Window {
	case "24h":
		t := now.UTC().Add(-24 * time.Hour)
		f.Cutoff = &t
	case "7d":
		t := now.UTC().Add(-7 * 24 * time.Hour)
		f.Cutoff = &t
	case "30d":
		t := now.UTC().Add(-30 * 24 * time.Hour)
		f.Cutoff = &t
	}
	return f
}

func (f normalizedAnalyticsFilter) toProto() *adminv1.AdminAnalyticsFilter {
	return &adminv1.AdminAnalyticsFilter{
		Window:     f.Window,
		Source:     f.Source,
		Country:    f.Country,
		Path:       f.Path,
		Campaign:   f.Campaign,
		Bots:       f.Bots,
		Identified: f.Identified,
	}
}

func buildAnalyticsWhere(f normalizedAnalyticsFilter, alias string, startArg int) (string, []any) {
	col := func(c string) string { return alias + "." + c }
	preds := []string{col("app") + " = 'portal'"}
	args := make([]any, 0, 8)
	addArg := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", startArg+len(args)-1)
	}

	switch f.Bots {
	case "exclude":
		preds = append(preds, col("is_bot")+" = false")
	case "only":
		preds = append(preds, col("is_bot")+" = true")
	}
	if f.Cutoff != nil {
		p := addArg(*f.Cutoff)
		preds = append(preds, col("started_at")+" >= "+p)
	}
	if f.Country != nil {
		if strings.EqualFold(*f.Country, "unknown") {
			preds = append(preds, fmt.Sprintf("(%s IS NULL OR BTRIM(%s) = '')", col("country"), col("country")))
		} else {
			p := addArg(*f.Country)
			preds = append(preds, fmt.Sprintf("UPPER(COALESCE(NULLIF(BTRIM(%s), ''), 'Unknown')) = UPPER(%s)", col("country"), p))
		}
	}
	if f.Source != nil {
		if strings.EqualFold(*f.Source, "direct") {
			preds = append(preds, fmt.Sprintf("(%s IS NULL OR BTRIM(%s) = '')", col("referrer_host"), col("referrer_host")))
		} else {
			p := addArg(*f.Source)
			preds = append(preds, fmt.Sprintf("(LOWER(COALESCE(%s, '')) = LOWER(%s) OR LOWER(COALESCE(%s, '')) = LOWER(%s))", col("referrer_host"), p, col("referrer_category"), p))
		}
	}
	if f.Campaign != nil {
		p := addArg(*f.Campaign)
		preds = append(preds, fmt.Sprintf("(%s = %s OR %s = %s OR %s = %s)", col("ref_param"), p, col("utm_campaign"), p, col("utm_source"), p))
	}
	if f.Path != nil {
		p := addArg(*f.Path)
		preds = append(preds, fmt.Sprintf("EXISTS (SELECT 1 FROM analytics_events ep WHERE ep.session_id = %s AND ep.type = 'page_view' AND ep.path = %s)", col("session_id"), p))
	}
	if f.Identified == "true" {
		preds = append(preds, fmt.Sprintf("EXISTS (SELECT 1 FROM contact_submissions cs WHERE cs.analytics_session_id = %s)", col("session_id")))
	}
	return strings.Join(preds, " AND "), args
}

func roundThree(v *float64) *float64 {
	if v == nil || math.IsNaN(*v) || math.IsInf(*v, 0) {
		return nil
	}
	r := math.Round(*v*1000) / 1000
	return &r
}

func (s *adminAnalyticsServiceServer) querySimpleBreakdown(ctx context.Context, sqlQuery string, args []any, withSecondary, withFilterVal bool) ([]*adminv1.AnalyticsBreakdownRow, error) {
	rows, err := s.deps.store.Pool().Query(ctx, sqlQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]*adminv1.AnalyticsBreakdownRow, 0)
	for rows.Next() {
		var row adminv1.AnalyticsBreakdownRow
		if withSecondary && withFilterVal {
			if err := rows.Scan(&row.Label, &row.SecondaryLabel, &row.FilterValue, &row.Count); err != nil {
				return nil, err
			}
		} else {
			if err := rows.Scan(&row.Label, &row.Count); err != nil {
				return nil, err
			}
		}
		out = append(out, &row)
	}
	return out, rows.Err()
}

func (s *adminAnalyticsServiceServer) loadRecentVisitorsAndAskFeed(
	ctx context.Context,
	f normalizedAnalyticsFilter,
) ([]*adminv1.AnalyticsRecentVisitor, []*adminv1.AnalyticsAskTurnItem, error) {
	pool := s.deps.store.Pool()
	whereS, argsS := buildAnalyticsWhere(f, "s", 1)

	vRows, err := pool.Query(ctx, `
		SELECT
			s.session_id, s.started_at, COALESCE(s.last_seen_at, s.started_at) AS last_seen_at,
			s.is_bot, s.country, s.region, s.city, s.asn_org, s.referrer_host, s.referrer_category,
			s.landing_path, s.ref_param, s.utm_source, s.utm_medium, s.utm_campaign,
			s.device_type, s.os_name, s.browser_name,
			COALESCE(ec.page_view_count, 0)::int, COALESCE(ec.event_count, 0)::int,
			COALESCE(atc.ask_turn_count, 0)::int, c.contact_id, c.contact_name, c.contact_email,
			COALESCE(tr.trail, '[]'::jsonb)::text
		FROM analytics_sessions s
		LEFT JOIN LATERAL (
			SELECT COUNT(*) FILTER (WHERE e.type = 'page_view')::int AS page_view_count,
			       COUNT(*)::int AS event_count
			FROM analytics_events e WHERE e.session_id = s.session_id
		) ec ON true
		LEFT JOIN LATERAL (
			SELECT cs.id::text AS contact_id, cs.name AS contact_name, cs.email AS contact_email, cs.guest_session_id AS contact_guest_session_id
			FROM contact_submissions cs WHERE cs.analytics_session_id = s.session_id
			ORDER BY cs.created_at DESC LIMIT 1
		) c ON true
		LEFT JOIN LATERAL (
			SELECT COUNT(*)::int AS ask_turn_count
			FROM ask_turns at
			WHERE COALESCE(c.contact_guest_session_id, s.guest_session_id) IS NOT NULL
			  AND at.session_id = COALESCE(c.contact_guest_session_id, s.guest_session_id)
		) atc ON true
		LEFT JOIN LATERAL (
			SELECT COALESCE(
				jsonb_agg(
					jsonb_build_object(
						'type', ev.type, 'name', ev.name, 'path', ev.path,
						'detail', COALESCE(NULLIF(BTRIM(ev.metadata_json->>'target'), ''), NULLIF(BTRIM(ev.metadata_json->>'command'), ''), NULLIF(BTRIM(ev.metadata_json->>'slug'), ''), NULLIF(BTRIM(ev.metadata_json->>'surface'), '')),
						'createdAt', to_char(ev.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
					) ORDER BY ev.created_at ASC, ev.id ASC
				), '[]'::jsonb
			) AS trail
			FROM (
				SELECT id, type, name, path, metadata_json, created_at
				FROM analytics_events e WHERE e.session_id = s.session_id AND e.type <> 'web_vital'
				ORDER BY e.created_at DESC, e.id DESC LIMIT 15
			) ev
		) tr ON true
		WHERE `+whereS+`
		ORDER BY COALESCE(s.last_seen_at, s.started_at) DESC, s.started_at DESC
		LIMIT 25`, argsS...)
	if err != nil {
		return nil, nil, err
	}
	defer vRows.Close()

	visitors := make([]*adminv1.AnalyticsRecentVisitor, 0)
	for vRows.Next() {
		var v adminv1.AnalyticsRecentVisitor
		var startedAt, lastSeenAt time.Time
		var trailRaw string
		if scanErr := vRows.Scan(
			&v.SessionId, &startedAt, &lastSeenAt, &v.IsBot,
			&v.Country, &v.Region, &v.City, &v.AsnOrg, &v.ReferrerHost, &v.ReferrerCategory,
			&v.LandingPath, &v.RefParam, &v.UtmSource, &v.UtmMedium, &v.UtmCampaign,
			&v.DeviceType, &v.OsName, &v.BrowserName,
			&v.PageViewCount, &v.EventCount, &v.AskTurnCount,
			&v.ContactId, &v.ContactName, &v.ContactEmail, &trailRaw,
		); scanErr != nil {
			return nil, nil, scanErr
		}
		v.StartedAt = formatRFC3339Millis(startedAt)
		v.LastSeenAt = formatRFC3339Millis(lastSeenAt)
		var parsedTrail []struct {
			Type      string  `json:"type"`
			Name      string  `json:"name"`
			Path      string  `json:"path"`
			Detail    *string `json:"detail"`
			CreatedAt string  `json:"createdAt"`
		}
		if err := json.Unmarshal([]byte(trailRaw), &parsedTrail); err == nil {
			for i, item := range parsedTrail {
				if i >= 15 {
					break
				}
				v.Trail = append(v.Trail, &adminv1.AnalyticsTrailEvent{
					Type:      item.Type,
					Name:      item.Name,
					Path:      item.Path,
					Detail:    item.Detail,
					CreatedAt: item.CreatedAt,
				})
			}
		}
		visitors = append(visitors, &v)
	}
	if err := vRows.Err(); err != nil {
		return nil, nil, err
	}

	whereS2, argsS2 := buildAnalyticsWhere(f, "s2", 1)
	askPreds := make([]string, 0, 2)
	if f.Cutoff != nil {
		argsS2 = append(argsS2, *f.Cutoff)
		askPreds = append(askPreds, fmt.Sprintf("at.created_at >= $%d", len(argsS2)))
	}
	if f.Country != nil || f.Source != nil || f.Campaign != nil || f.Path != nil || f.Identified == "true" || f.Bots == "only" {
		askPreds = append(askPreds, "s.session_id IS NOT NULL")
	}
	askWhere := ""
	if len(askPreds) > 0 {
		askWhere = "WHERE " + strings.Join(askPreds, " AND ")
	}

	aRows, err := pool.Query(ctx, `
		SELECT
			at.attempt_id, at.session_id, s.session_id, at.mode, at.status,
			LEFT(at.prompt_text, 240), at.tokens_used, s.country, s.region, s.city, s.asn_org,
			c.contact_id, c.contact_name, at.created_at
		FROM ask_turns at
		LEFT JOIN LATERAL (
			SELECT s2.session_id, s2.country, s2.region, s2.city, s2.asn_org
			FROM analytics_sessions s2
			WHERE s2.guest_session_id = at.session_id AND `+whereS2+`
			ORDER BY COALESCE(s2.last_seen_at, s2.started_at) DESC LIMIT 1
		) s ON true
		LEFT JOIN LATERAL (
			SELECT cs.id::text AS contact_id, cs.name AS contact_name
			FROM contact_submissions cs
			WHERE cs.guest_session_id = at.session_id
			   OR (s.session_id IS NOT NULL AND cs.analytics_session_id = s.session_id)
			ORDER BY cs.created_at DESC LIMIT 1
		) c ON true
		`+askWhere+`
		ORDER BY at.created_at DESC
		LIMIT 25`, argsS2...)
	if err != nil {
		return nil, nil, err
	}
	defer aRows.Close()

	feed := make([]*adminv1.AnalyticsAskTurnItem, 0)
	for aRows.Next() {
		var it adminv1.AnalyticsAskTurnItem
		var createdAt time.Time
		if scanErr := aRows.Scan(
			&it.AttemptId, &it.GuestSessionId, &it.AnalyticsSessionId, &it.Mode, &it.Status,
			&it.PromptExcerpt, &it.TokensUsed, &it.Country, &it.Region, &it.City, &it.AsnOrg,
			&it.ContactId, &it.ContactName, &createdAt,
		); scanErr != nil {
			return nil, nil, scanErr
		}
		if it.Mode != "jd_match" {
			it.Mode = "qa"
		}
		it.CreatedAt = formatRFC3339Millis(createdAt)
		feed = append(feed, &it)
	}
	return visitors, feed, aRows.Err()
}
