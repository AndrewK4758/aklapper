import {
  type AdminAiMetrics,
  AdminAnalyticsBreakdownsDataSchema,
  type AdminAnalyticsBreakdownsData,
  AdminAnalyticsContentSchema,
  type AdminAnalyticsLoaderData,
  AdminAnalyticsLoaderDataSchema,
  AdminAnalyticsSummaryDataSchema,
  type AdminAnalyticsSummaryData,
  type AgensiConversionRow,
  type AnalyticsBreakdownRow,
  type CwvMetricName,
  type CwvPercentileRow,
} from '@aklapper/core';
import { sql } from 'drizzle-orm';

import {
  type AdminAnalyticsFilterInput,
  buildAnalyticsSessionWhere,
  loadAdminAnalyticsDailyTrend,
  loadAdminAnalyticsExtendedBreakdowns,
  normalizeAdminAnalyticsFilter,
  resolveAnalyticsWindowCutoff,
  toAnalyticsNumber,
} from './admin-analytics-visitors.ts';
import type { AppDatabase } from './client.ts';
import { getSiteContent, SITE_CONTENT_KEYS } from './queries.ts';

const CWV_METRICS: readonly CwvMetricName[] = ['LCP', 'INP', 'CLS', 'TTFB'];

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 1000) / 1000;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.round(parsed * 1000) / 1000;
  }
  return null;
}

export async function loadAdminAnalyticsSummary(
  db: AppDatabase,
  filterInput: AdminAnalyticsFilterInput = '7d',
): Promise<AdminAnalyticsSummaryData> {
  const filters = normalizeAdminAnalyticsFilter(filterInput);
  const cutoff = resolveAnalyticsWindowCutoff(filters.window);
  const sessionWhere = buildAnalyticsSessionWhere(filters, cutoff, 's');

  const botCutoffWhere = cutoff
    ? sql`app = 'portal' AND is_bot = true AND started_at >= ${cutoff}`
    : sql`app = 'portal' AND is_bot = true`;
  const sandboxWhere = cutoff
    ? sql`WHERE is_golden = false AND created_at >= ${cutoff}`
    : sql`WHERE is_golden = false`;

  const [
    content,
    sessionKpiResult,
    botCountResult,
    eventKpiResult,
    dailyTrend,
    cwvResult,
    sandboxMetricsResult,
    abstentionResult,
  ] = await Promise.all([
    getSiteContent(db, SITE_CONTENT_KEYS.adminAnalytics, AdminAnalyticsContentSchema),
    db.execute(sql`
      WITH filtered AS (
        SELECT
          s.session_id,
          COALESCE(s.visitor_hash, s.ip_hash, s.session_id) AS visitor_key
        FROM analytics_sessions s
        WHERE ${sessionWhere}
      ),
      visitor_counts AS (
        SELECT visitor_key, COUNT(*)::int AS sess_count
        FROM filtered
        GROUP BY visitor_key
      )
      SELECT
        (SELECT COUNT(*)::int FROM filtered) AS total_sessions,
        (SELECT COUNT(*)::int FROM visitor_counts) AS unique_visitors,
        (SELECT COUNT(*)::int FROM visitor_counts WHERE sess_count > 1) AS returning_visitors,
        (
          SELECT COUNT(DISTINCT cs.id)::int
          FROM contact_submissions cs
          INNER JOIN filtered f ON f.session_id = cs.analytics_session_id
        ) AS identified_leads
    `),
    db.execute(sql`
      SELECT COUNT(*)::int AS bot_sessions
      FROM analytics_sessions
      WHERE ${botCutoffWhere}
    `),
    db.execute(sql`
      SELECT
        COUNT(*)::int AS total_events,
        COUNT(*) FILTER (WHERE e.type = 'page_view')::int AS total_page_views,
        COUNT(*) FILTER (
          WHERE (e.type = 'page_view' AND e.path = '/about')
             OR (e.name = 'pane_open' AND e.path = '/about')
        )::int AS profile_views,
        COUNT(*) FILTER (
          WHERE e.name IN ('about_outbound_click', 'agensi_outbound_click', 'contact_submitted')
             OR (e.type = 'page_view' AND e.path IN ('/contact', '/chat'))
        )::int AS high_intent_actions
      FROM analytics_events e
      INNER JOIN analytics_sessions s ON s.session_id = e.session_id
      WHERE ${sessionWhere}
    `),
    loadAdminAnalyticsDailyTrend(db, sessionWhere),
    db.execute(sql`
      SELECT
        e.name AS metric,
        COUNT(*)::int AS sample_count,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY e.value) AS p50,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY e.value) AS p75,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY e.value) AS p95
      FROM analytics_events e
      INNER JOIN analytics_sessions s ON s.session_id = e.session_id
      WHERE e.type = 'web_vital'
        AND e.name IN ('LCP', 'INP', 'CLS', 'TTFB')
        AND e.value IS NOT NULL
        AND ${sessionWhere}
      GROUP BY e.name
    `),
    db.execute(sql`
      SELECT
        COUNT(*)::int AS total_runs,
        COALESCE(SUM(tokens_in), 0)::bigint AS total_tokens_in,
        COALESCE(SUM(tokens_out), 0)::bigint AS total_tokens_out,
        COUNT(*) FILTER (WHERE gate_verdict = 'approved')::int AS approved_gates,
        COUNT(*) FILTER (WHERE gate_verdict = 'rejected')::int AS rejected_gates,
        COUNT(*) FILTER (WHERE gate_verdict = 'pending')::int AS pending_gates
      FROM sandbox_runs
      ${sandboxWhere}
    `),
    db.execute(sql`
      SELECT COUNT(*)::int AS abstentions
      FROM analytics_events e
      INNER JOIN analytics_sessions s ON s.session_id = e.session_id
      WHERE (
        e.name IN ('ask_abstained', 'ai_abstention')
        OR (
          e.metadata_json->>'grounded' = 'false'
          AND COALESCE(e.metadata_json->>'groundingTier', '') <> 'general'
          AND COALESCE(e.metadata_json->>'abstained', 'true') <> 'false'
        )
      )
        AND ${sessionWhere}
    `),
  ]);

  const cwvByMetric = new Map<CwvMetricName, CwvPercentileRow>();
  for (const rawRow of cwvResult.rows) {
    const row = rawRow as Record<string, unknown>;
    const metric = row['metric'];
    if (metric === 'LCP' || metric === 'INP' || metric === 'CLS' || metric === 'TTFB') {
      cwvByMetric.set(metric, {
        metric,
        sampleCount: toAnalyticsNumber(row['sample_count']),
        p50: toNullableNumber(row['p50']),
        p75: toNullableNumber(row['p75']),
        p95: toNullableNumber(row['p95']),
      });
    }
  }

  const cwv: CwvPercentileRow[] = CWV_METRICS.map(
    metric =>
      cwvByMetric.get(metric) ?? {
        metric,
        sampleCount: 0,
        p50: null,
        p75: null,
        p95: null,
      },
  );

  const sessionKpiRow = (sessionKpiResult.rows[0] ?? {}) as Record<string, unknown>;
  const botRow = (botCountResult.rows[0] ?? {}) as Record<string, unknown>;
  const eventKpiRow = (eventKpiResult.rows[0] ?? {}) as Record<string, unknown>;
  const sandboxRow = (sandboxMetricsResult.rows[0] ?? {}) as Record<string, unknown>;
  const abstentionRow = (abstentionResult.rows[0] ?? {}) as Record<string, unknown>;

  const aiMetrics: AdminAiMetrics = {
    totalRuns: toAnalyticsNumber(sandboxRow['total_runs']),
    totalTokensIn: toAnalyticsNumber(sandboxRow['total_tokens_in']),
    totalTokensOut: toAnalyticsNumber(sandboxRow['total_tokens_out']),
    approvedGates: toAnalyticsNumber(sandboxRow['approved_gates']),
    rejectedGates: toAnalyticsNumber(sandboxRow['rejected_gates']),
    pendingGates: toAnalyticsNumber(sandboxRow['pending_gates']),
    abstentionEvents: toAnalyticsNumber(abstentionRow['abstentions']),
  };

  const totalSessions = toAnalyticsNumber(sessionKpiRow['total_sessions']);
  const totalEvents = toAnalyticsNumber(eventKpiRow['total_events']);

  return AdminAnalyticsSummaryDataSchema.parse({
    content,
    window: filters.window,
    filters,
    totalSessions,
    totalEvents,
    uniqueVisitors: toAnalyticsNumber(sessionKpiRow['unique_visitors']),
    returningVisitors: toAnalyticsNumber(sessionKpiRow['returning_visitors']),
    totalPageViews: toAnalyticsNumber(eventKpiRow['total_page_views']),
    profileViews: toAnalyticsNumber(eventKpiRow['profile_views']),
    highIntentActions: toAnalyticsNumber(eventKpiRow['high_intent_actions']),
    identifiedLeads: toAnalyticsNumber(sessionKpiRow['identified_leads']),
    botSessionsExcluded: toAnalyticsNumber(botRow['bot_sessions']),
    dailyTrend,
    summary: { totalSessions, totalEvents },
    cwv,
    aiMetrics,
  });
}

export async function loadAdminAnalyticsBreakdowns(
  db: AppDatabase,
  filterInput: AdminAnalyticsFilterInput = '7d',
): Promise<AdminAnalyticsBreakdownsData> {
  const filters = normalizeAdminAnalyticsFilter(filterInput);
  const cutoff = resolveAnalyticsWindowCutoff(filters.window);
  const sessionWhere = buildAnalyticsSessionWhere(filters, cutoff, 's');

  const [topPathsResult, topReferrersResult, geoResult, agensiResult, extended] = await Promise.all(
    [
      db.execute(sql`
        SELECT
          e.path AS label,
          COUNT(*)::int AS total,
          COUNT(DISTINCT COALESCE(s.visitor_hash, s.ip_hash, s.session_id))::int AS unique_visitors
        FROM analytics_events e
        INNER JOIN analytics_sessions s ON s.session_id = e.session_id
        WHERE e.type = 'page_view'
          AND ${sessionWhere}
        GROUP BY e.path
        ORDER BY total DESC, e.path ASC
        LIMIT 10
      `),
      db.execute(sql`
        SELECT
          COALESCE(NULLIF(BTRIM(s.referrer_host), ''), 'direct') AS label,
          COALESCE(NULLIF(BTRIM(s.referrer_category), ''), 'direct') AS category,
          COUNT(*)::int AS total
        FROM analytics_sessions s
        WHERE ${sessionWhere}
        GROUP BY 1, 2
        ORDER BY total DESC, label ASC
        LIMIT 10
      `),
      db.execute(sql`
        SELECT
          COALESCE(NULLIF(BTRIM(s.country), ''), 'Unknown') AS country_label,
          COALESCE(NULLIF(BTRIM(s.region), ''), '—') AS region_label,
          NULLIF(BTRIM(s.city), '') AS city_label,
          COUNT(*)::int AS total
        FROM analytics_sessions s
        WHERE ${sessionWhere}
        GROUP BY 1, 2, 3
        ORDER BY total DESC, country_label ASC
        LIMIT 10
      `),
      db.execute(sql`
        SELECT
          COALESCE(NULLIF(BTRIM(e.metadata_json->>'slug'), ''), e.path) AS slug,
          COUNT(*)::int AS clicks
        FROM analytics_events e
        INNER JOIN analytics_sessions s ON s.session_id = e.session_id
        WHERE e.name = 'agensi_outbound_click'
          AND ${sessionWhere}
        GROUP BY 1
        ORDER BY clicks DESC, slug ASC
        LIMIT 15
      `),
      loadAdminAnalyticsExtendedBreakdowns(db, filters, cutoff),
    ],
  );

  const topPaths: AnalyticsBreakdownRow[] = topPathsResult.rows.map(raw => {
    const row = raw as Record<string, unknown>;
    const label = String(row['label'] ?? '/');
    const uniqueVisitors = toAnalyticsNumber(row['unique_visitors']);
    return {
      label,
      count: toAnalyticsNumber(row['total']),
      uniqueVisitors,
      secondaryLabel: `${uniqueVisitors} unique`,
      filterValue: label,
    };
  });

  const topReferrers: AnalyticsBreakdownRow[] = topReferrersResult.rows.map(raw => {
    const row = raw as Record<string, unknown>;
    const label = String(row['label'] ?? 'direct');
    const category = String(row['category'] ?? 'direct');
    return {
      label,
      count: toAnalyticsNumber(row['total']),
      secondaryLabel: category,
      filterValue: label,
    };
  });

  const geoBreakdown: AnalyticsBreakdownRow[] = geoResult.rows.map(raw => {
    const row = raw as Record<string, unknown>;
    const countryLabel = String(row['country_label'] ?? 'Unknown');
    const regionLabel = String(row['region_label'] ?? '—');
    const cityLabel = typeof row['city_label'] === 'string' ? row['city_label'].trim() : '';
    return {
      label: countryLabel,
      secondaryLabel: cityLabel ? `${cityLabel}, ${regionLabel}` : regionLabel,
      count: toAnalyticsNumber(row['total']),
      filterValue: countryLabel,
    };
  });

  const agensiConversions: AgensiConversionRow[] = agensiResult.rows.map(raw => {
    const row = raw as Record<string, unknown>;
    return {
      slug: String(row['slug'] ?? 'unknown'),
      clicks: toAnalyticsNumber(row['clicks']),
    };
  });

  return AdminAnalyticsBreakdownsDataSchema.parse({
    topPaths,
    topReferrers,
    geoBreakdown,
    agensiConversions,
    ...extended,
  });
}

export async function loadAdminAnalyticsData(
  db: AppDatabase,
  filterInput: AdminAnalyticsFilterInput = '7d',
): Promise<AdminAnalyticsLoaderData> {
  const [summary, breakdowns] = await Promise.all([
    loadAdminAnalyticsSummary(db, filterInput),
    loadAdminAnalyticsBreakdowns(db, filterInput),
  ]);

  return AdminAnalyticsLoaderDataSchema.parse({
    ...summary,
    ...breakdowns,
  });
}
