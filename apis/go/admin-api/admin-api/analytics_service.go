package main

import (
	"context"
	"fmt"
	"math"
	"strings"

	"connectrpc.com/connect"
	adminv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1/adminv1connect"
)

type adminAnalyticsServiceServer struct {
	deps adminServiceDeps
}

var _ adminv1connect.AdminAnalyticsServiceHandler = (*adminAnalyticsServiceServer)(nil)

func newAdminAnalyticsServiceServer(deps adminServiceDeps) *adminAnalyticsServiceServer {
	return &adminAnalyticsServiceServer{deps: deps}
}

func (s *adminAnalyticsServiceServer) GetAnalyticsSummary(
	ctx context.Context,
	req *connect.Request[adminv1.GetAnalyticsSummaryRequest],
) (*connect.Response[adminv1.GetAnalyticsSummaryResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	contentJSON, err := s.deps.store.LoadSiteContentJSON(ctx, "admin-analytics")
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	f := normalizeAnalyticsFilter(req.Msg.GetFilter(), s.deps.now())
	whereS, argsS := buildAnalyticsWhere(f, "s", 1)
	pool := s.deps.store.Pool()

	var totalSessions, uniqueVisitors, returningVisitors, identifiedLeads int32
	if err := pool.QueryRow(ctx, `
		WITH filtered AS (
			SELECT s.session_id, COALESCE(s.visitor_hash, s.ip_hash, s.session_id) AS visitor_key
			FROM analytics_sessions s WHERE `+whereS+`
		),
		visitor_counts AS (SELECT visitor_key, COUNT(*)::int AS sess_count FROM filtered GROUP BY visitor_key)
		SELECT
			(SELECT COUNT(*)::int FROM filtered),
			(SELECT COUNT(*)::int FROM visitor_counts),
			(SELECT COUNT(*)::int FROM visitor_counts WHERE sess_count > 1),
			(SELECT COUNT(DISTINCT cs.id)::int FROM contact_submissions cs INNER JOIN filtered f ON f.session_id = cs.analytics_session_id)`,
		argsS...,
	).Scan(&totalSessions, &uniqueVisitors, &returningVisitors, &identifiedLeads); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}

	var botExcluded int32
	if f.Cutoff != nil {
		err = pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM analytics_sessions WHERE app = 'portal' AND is_bot = true AND started_at >= $1`, *f.Cutoff).Scan(&botExcluded)
	} else {
		err = pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM analytics_sessions WHERE app = 'portal' AND is_bot = true`).Scan(&botExcluded)
	}
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}

	var totalEvents, totalPageViews, profileViews, highIntent int32
	if err := pool.QueryRow(ctx, `
		SELECT
			COUNT(*)::int,
			COUNT(*) FILTER (WHERE e.type = 'page_view')::int,
			COUNT(*) FILTER (WHERE (e.type = 'page_view' AND e.path = '/about') OR (e.name = 'pane_open' AND e.path = '/about'))::int,
			COUNT(*) FILTER (WHERE e.name IN ('about_outbound_click', 'agensi_outbound_click', 'contact_submitted') OR (e.type = 'page_view' AND e.path IN ('/contact', '/chat')))::int
		FROM analytics_events e INNER JOIN analytics_sessions s ON s.session_id = e.session_id
		WHERE `+whereS, argsS...,
	).Scan(&totalEvents, &totalPageViews, &profileViews, &highIntent); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}

	trendRows, err := pool.Query(ctx, `
		WITH latest_days AS (
			SELECT
				to_char(s.started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day_date,
				COUNT(DISTINCT COALESCE(s.visitor_hash, s.ip_hash, s.session_id))::int AS unique_visitors,
				COUNT(DISTINCT s.session_id)::int AS sessions,
				COALESCE(SUM(COALESCE(pv.page_views, 0)), 0)::int AS page_views
			FROM analytics_sessions s
			LEFT JOIN LATERAL (SELECT COUNT(*)::int AS page_views FROM analytics_events e WHERE e.session_id = s.session_id AND e.type = 'page_view') pv ON true
			WHERE `+whereS+`
			GROUP BY 1 ORDER BY 1 DESC LIMIT 90
		)
		SELECT day_date, unique_visitors, sessions, page_views FROM latest_days ORDER BY day_date ASC`, argsS...)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	defer trendRows.Close()
	dailyTrend := make([]*adminv1.AnalyticsDailyTrendPoint, 0)
	for trendRows.Next() {
		var pt adminv1.AnalyticsDailyTrendPoint
		if err := trendRows.Scan(&pt.Date, &pt.UniqueVisitors, &pt.Sessions, &pt.PageViews); err != nil {
			return nil, mapAdminStoreError(err, corrID)
		}
		dailyTrend = append(dailyTrend, &pt)
	}
	if err := trendRows.Err(); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}

	cwvMap := make(map[string]*adminv1.CwvPercentileRow, 4)
	cwvRows, err := pool.Query(ctx, `
		SELECT e.name, COUNT(*)::int,
		       percentile_cont(0.5) WITHIN GROUP (ORDER BY e.value),
		       percentile_cont(0.75) WITHIN GROUP (ORDER BY e.value),
		       percentile_cont(0.95) WITHIN GROUP (ORDER BY e.value)
		FROM analytics_events e INNER JOIN analytics_sessions s ON s.session_id = e.session_id
		WHERE e.type = 'web_vital' AND e.name IN ('LCP', 'INP', 'CLS', 'TTFB') AND e.value IS NOT NULL AND `+whereS+`
		GROUP BY e.name`, argsS...)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	defer cwvRows.Close()
	for cwvRows.Next() {
		var metric string
		var cnt int32
		var p50, p75, p95 *float64
		if err := cwvRows.Scan(&metric, &cnt, &p50, &p75, &p95); err != nil {
			return nil, mapAdminStoreError(err, corrID)
		}
		cwvMap[metric] = &adminv1.CwvPercentileRow{
			Metric: metric, SampleCount: cnt, P50: roundThree(p50), P75: roundThree(p75), P95: roundThree(p95),
		}
	}
	if err := cwvRows.Err(); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	cwv := make([]*adminv1.CwvPercentileRow, 0, 4)
	for _, m := range []string{"LCP", "INP", "CLS", "TTFB"} {
		if existing, ok := cwvMap[m]; ok {
			cwv = append(cwv, existing)
		} else {
			cwv = append(cwv, &adminv1.CwvPercentileRow{Metric: m, SampleCount: 0})
		}
	}

	var ai adminv1.AdminAiMetrics
	if f.Cutoff != nil {
		err = pool.QueryRow(ctx, `SELECT COUNT(*)::int, COALESCE(SUM(tokens_in), 0)::bigint, COALESCE(SUM(tokens_out), 0)::bigint, COUNT(*) FILTER (WHERE gate_verdict = 'approved')::int, COUNT(*) FILTER (WHERE gate_verdict = 'rejected')::int, COUNT(*) FILTER (WHERE gate_verdict = 'pending')::int FROM sandbox_runs WHERE is_golden = false AND created_at >= $1`, *f.Cutoff).Scan(&ai.TotalRuns, &ai.TotalTokensIn, &ai.TotalTokensOut, &ai.ApprovedGates, &ai.RejectedGates, &ai.PendingGates)
	} else {
		err = pool.QueryRow(ctx, `SELECT COUNT(*)::int, COALESCE(SUM(tokens_in), 0)::bigint, COALESCE(SUM(tokens_out), 0)::bigint, COUNT(*) FILTER (WHERE gate_verdict = 'approved')::int, COUNT(*) FILTER (WHERE gate_verdict = 'rejected')::int, COUNT(*) FILTER (WHERE gate_verdict = 'pending')::int FROM sandbox_runs WHERE is_golden = false`).Scan(&ai.TotalRuns, &ai.TotalTokensIn, &ai.TotalTokensOut, &ai.ApprovedGates, &ai.RejectedGates, &ai.PendingGates)
	}
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*)::int
		FROM analytics_events e INNER JOIN analytics_sessions s ON s.session_id = e.session_id
		WHERE (e.name IN ('ask_abstained', 'ai_abstention') OR (e.metadata_json->>'grounded' = 'false' AND COALESCE(e.metadata_json->>'groundingTier', '') <> 'general' AND COALESCE(e.metadata_json->>'abstained', 'true') <> 'false'))
		  AND `+whereS, argsS...,
	).Scan(&ai.AbstentionEvents); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}

	return connect.NewResponse(&adminv1.GetAnalyticsSummaryResponse{
		ContentJson:         contentJSON,
		Window:              f.Window,
		Filters:             f.toProto(),
		TotalSessions:       totalSessions,
		TotalEvents:         totalEvents,
		UniqueVisitors:      uniqueVisitors,
		ReturningVisitors:   returningVisitors,
		TotalPageViews:      totalPageViews,
		ProfileViews:        profileViews,
		HighIntentActions:   highIntent,
		IdentifiedLeads:     identifiedLeads,
		BotSessionsExcluded: botExcluded,
		DailyTrend:          dailyTrend,
		Cwv:                 cwv,
		AiMetrics:           &ai,
	}), nil
}

func (s *adminAnalyticsServiceServer) GetAnalyticsBreakdowns(
	ctx context.Context,
	req *connect.Request[adminv1.GetAnalyticsBreakdownsRequest],
) (*connect.Response[adminv1.GetAnalyticsBreakdownsResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	f := normalizeAnalyticsFilter(req.Msg.GetFilter(), s.deps.now())
	whereS, argsS := buildAnalyticsWhere(f, "s", 1)
	pool := s.deps.store.Pool()

	pathRows, err := pool.Query(ctx, `SELECT e.path, COUNT(*)::int, COUNT(DISTINCT COALESCE(s.visitor_hash, s.ip_hash, s.session_id))::int FROM analytics_events e INNER JOIN analytics_sessions s ON s.session_id = e.session_id WHERE e.type = 'page_view' AND `+whereS+` GROUP BY e.path ORDER BY 2 DESC, e.path ASC LIMIT 10`, argsS...)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	defer pathRows.Close()
	topPaths := make([]*adminv1.AnalyticsBreakdownRow, 0)
	for pathRows.Next() {
		var label string
		var cnt, uniq int32
		if err := pathRows.Scan(&label, &cnt, &uniq); err != nil {
			return nil, mapAdminStoreError(err, corrID)
		}
		sec := fmt.Sprintf("%d unique", uniq)
		fv := label
		topPaths = append(topPaths, &adminv1.AnalyticsBreakdownRow{Label: label, Count: cnt, UniqueVisitors: &uniq, SecondaryLabel: &sec, FilterValue: &fv})
	}

	refRows, err := pool.Query(ctx, `SELECT COALESCE(NULLIF(BTRIM(s.referrer_host), ''), 'direct'), COALESCE(NULLIF(BTRIM(s.referrer_category), ''), 'direct'), COUNT(*)::int FROM analytics_sessions s WHERE `+whereS+` GROUP BY 1, 2 ORDER BY 3 DESC, 1 ASC LIMIT 10`, argsS...)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	defer refRows.Close()
	topReferrers := make([]*adminv1.AnalyticsBreakdownRow, 0)
	for refRows.Next() {
		var label, cat string
		var cnt int32
		if err := refRows.Scan(&label, &cat, &cnt); err != nil {
			return nil, mapAdminStoreError(err, corrID)
		}
		fv := label
		topReferrers = append(topReferrers, &adminv1.AnalyticsBreakdownRow{Label: label, SecondaryLabel: &cat, Count: cnt, FilterValue: &fv})
	}

	geoRows, err := pool.Query(ctx, `SELECT COALESCE(NULLIF(BTRIM(s.country), ''), 'Unknown'), COALESCE(NULLIF(BTRIM(s.region), ''), '—'), NULLIF(BTRIM(s.city), ''), COUNT(*)::int FROM analytics_sessions s WHERE `+whereS+` GROUP BY 1, 2, 3 ORDER BY 4 DESC, 1 ASC LIMIT 10`, argsS...)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	defer geoRows.Close()
	geoBreakdown := make([]*adminv1.AnalyticsBreakdownRow, 0)
	for geoRows.Next() {
		var country, region string
		var city *string
		var cnt int32
		if err := geoRows.Scan(&country, &region, &city, &cnt); err != nil {
			return nil, mapAdminStoreError(err, corrID)
		}
		sec := region
		if city != nil && strings.TrimSpace(*city) != "" {
			sec = strings.TrimSpace(*city) + ", " + region
		}
		fv := country
		geoBreakdown = append(geoBreakdown, &adminv1.AnalyticsBreakdownRow{Label: country, SecondaryLabel: &sec, Count: cnt, FilterValue: &fv})
	}

	agRows, err := pool.Query(ctx, `SELECT COALESCE(NULLIF(BTRIM(e.metadata_json->>'slug'), ''), e.path), COUNT(*)::int FROM analytics_events e INNER JOIN analytics_sessions s ON s.session_id = e.session_id WHERE e.name = 'agensi_outbound_click' AND `+whereS+` GROUP BY 1 ORDER BY 2 DESC, 1 ASC LIMIT 15`, argsS...)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	defer agRows.Close()
	agensiConv := make([]*adminv1.AgensiConversionRow, 0)
	for agRows.Next() {
		var row adminv1.AgensiConversionRow
		if err := agRows.Scan(&row.Slug, &row.Clicks); err != nil {
			return nil, mapAdminStoreError(err, corrID)
		}
		agensiConv = append(agensiConv, &row)
	}

	orgBreakdown, err := s.querySimpleBreakdown(ctx, `SELECT BTRIM(s.asn_org), COUNT(*)::int FROM analytics_sessions s WHERE `+whereS+` AND s.asn_org IS NOT NULL AND BTRIM(s.asn_org) <> '' GROUP BY 1 ORDER BY 2 DESC, 1 ASC LIMIT 10`, argsS, false, false)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	campaignBreakdown, err := s.querySimpleBreakdown(ctx, `SELECT COALESCE(NULLIF(BTRIM(s.utm_campaign), ''), NULLIF(BTRIM(s.ref_param), ''), NULLIF(BTRIM(s.utm_source), '')), COALESCE(NULLIF(BTRIM(s.utm_source), ''), NULLIF(BTRIM(s.ref_param), '')), COALESCE(NULLIF(BTRIM(s.utm_campaign), ''), NULLIF(BTRIM(s.ref_param), ''), NULLIF(BTRIM(s.utm_source), '')), COUNT(*)::int FROM analytics_sessions s WHERE `+whereS+` AND ((s.utm_campaign IS NOT NULL AND BTRIM(s.utm_campaign) <> '') OR (s.ref_param IS NOT NULL AND BTRIM(s.ref_param) <> '') OR (s.utm_source IS NOT NULL AND BTRIM(s.utm_source) <> '')) GROUP BY 1, 2, 3 ORDER BY 4 DESC, 1 ASC LIMIT 10`, argsS, true, true)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	deviceBreakdown, err := s.querySimpleBreakdown(ctx, `SELECT COALESCE(NULLIF(BTRIM(s.device_type), ''), 'unknown'), COUNT(*)::int FROM analytics_sessions s WHERE `+whereS+` GROUP BY 1 ORDER BY 2 DESC, 1 ASC LIMIT 6`, argsS, false, false)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	osBreakdown, err := s.querySimpleBreakdown(ctx, `SELECT COALESCE(NULLIF(BTRIM(s.os_name), ''), 'Unknown'), COUNT(*)::int FROM analytics_sessions s WHERE `+whereS+` GROUP BY 1 ORDER BY 2 DESC, 1 ASC LIMIT 8`, argsS, false, false)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	browserBreakdown, err := s.querySimpleBreakdown(ctx, `SELECT COALESCE(NULLIF(BTRIM(s.browser_name), ''), 'Unknown'), COUNT(*)::int FROM analytics_sessions s WHERE `+whereS+` GROUP BY 1 ORDER BY 2 DESC, 1 ASC LIMIT 8`, argsS, false, false)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}

	var landed, engaged, submitted int32
	if err := pool.QueryRow(ctx, `
		SELECT
			COUNT(*)::int,
			COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND ((e.type = 'page_view' AND e.path IN ('/about', '/chat', '/agensi', '/cadence')) OR e.name IN ('pane_open', 'about_outbound_click', 'agensi_outbound_click'))))::int,
			COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM contact_submissions cs WHERE cs.analytics_session_id = s.session_id) OR EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.name = 'contact_submitted'))::int
		FROM analytics_sessions s WHERE `+whereS, argsS...,
	).Scan(&landed, &engaged, &submitted); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	rate := func(c int32) float64 {
		if landed <= 0 {
			return 0
		}
		return math.Min(1, math.Round((float64(c)/float64(landed))*1000)/1000)
	}
	landedRate := 0.0
	if landed > 0 {
		landedRate = 1
	}
	funnel := []*adminv1.AnalyticsFunnelStep{
		{Step: "landed", Label: "Landed", Sessions: landed, ConversionRate: landedRate},
		{Step: "engaged_profile", Label: "Viewed About / Chat / Agensi / CADENCE", Sessions: engaged, ConversionRate: rate(engaged)},
		{Step: "submitted_contact", Label: "Submitted Contact", Sessions: submitted, ConversionRate: rate(submitted)},
	}

	visitors, askFeed, err := s.loadRecentVisitorsAndAskFeed(ctx, f)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.GetAnalyticsBreakdownsResponse{
		TopPaths:          topPaths,
		TopReferrers:      topReferrers,
		GeoBreakdown:      geoBreakdown,
		AgensiConversions: agensiConv,
		OrgBreakdown:      orgBreakdown,
		CampaignBreakdown: campaignBreakdown,
		DeviceBreakdown:   deviceBreakdown,
		OsBreakdown:       osBreakdown,
		BrowserBreakdown:  browserBreakdown,
		ConversionFunnel:  funnel,
		RecentVisitors:    visitors,
		AskTurnsFeed:      askFeed,
	}), nil
}
