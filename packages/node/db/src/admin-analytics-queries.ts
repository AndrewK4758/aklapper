import {
  type AdminAiMetrics,
  AdminAnalyticsBreakdownsDataSchema,
  type AdminAnalyticsBreakdownsData,
  AdminAnalyticsContentSchema,
  type AdminAnalyticsLoaderData,
  AdminAnalyticsLoaderDataSchema,
  AdminAnalyticsSummaryDataSchema,
  type AdminAnalyticsSummaryData,
  type AdminAnalyticsWindow,
  AdminAnalyticsWindowSchema,
  type AgensiConversionRow,
  type AnalyticsBreakdownRow,
  type CwvMetricName,
  type CwvPercentileRow,
} from '@aklapper/core';
import { count, gte, sql } from 'drizzle-orm';

import type { AppDatabase } from './client.ts';
import { getSiteContent, SITE_CONTENT_KEYS } from './queries.ts';
import * as schema from './schema.ts';

const CWV_METRICS: readonly CwvMetricName[] = ['LCP', 'INP', 'CLS', 'TTFB'];

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 1000) / 1000;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.round(parsed * 1000) / 1000;
  }
  return null;
}

function resolveAnalyticsWindowCutoff(window: AdminAnalyticsWindow): Date | null {
  const now = Date.now();
  switch (window) {
    case '24h':
      return new Date(now - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case 'all':
      return null;
  }
}

export async function loadAdminAnalyticsSummary(
  db: AppDatabase,
  windowInput: AdminAnalyticsWindow = '7d',
): Promise<AdminAnalyticsSummaryData> {
  const window = AdminAnalyticsWindowSchema.parse(windowInput);
  const cutoff = resolveAnalyticsWindowCutoff(window);

  const eventAndCutoff = cutoff ? sql`AND created_at >= ${cutoff}` : sql``;
  const sandboxWhere = cutoff
    ? sql`WHERE is_golden = false AND created_at >= ${cutoff}`
    : sql`WHERE is_golden = false`;

  const [
    content,
    sessionCountRows,
    eventCountRows,
    cwvResult,
    sandboxMetricsResult,
    abstentionResult,
  ] = await Promise.all([
    getSiteContent(db, SITE_CONTENT_KEYS.adminAnalytics, AdminAnalyticsContentSchema),
    cutoff
      ? db
          .select({ total: count() })
          .from(schema.analyticsSessions)
          .where(gte(schema.analyticsSessions.startedAt, cutoff))
      : db.select({ total: count() }).from(schema.analyticsSessions),
    cutoff
      ? db
          .select({ total: count() })
          .from(schema.analyticsEvents)
          .where(gte(schema.analyticsEvents.createdAt, cutoff))
      : db.select({ total: count() }).from(schema.analyticsEvents),
    db.execute(sql`
      SELECT
        name AS metric,
        COUNT(*)::int AS sample_count,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY value) AS p50,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY value) AS p75,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY value) AS p95
      FROM analytics_events
      WHERE type = 'web_vital'
        AND name IN ('LCP', 'INP', 'CLS', 'TTFB')
        AND value IS NOT NULL
        ${eventAndCutoff}
      GROUP BY name
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
      FROM analytics_events
      WHERE (name IN ('ask_abstained', 'ai_abstention') OR metadata_json->>'grounded' = 'false')
        ${eventAndCutoff}
    `),
  ]);

  const cwvByMetric = new Map<CwvMetricName, CwvPercentileRow>();
  for (const rawRow of cwvResult.rows) {
    const row = rawRow as Record<string, unknown>;
    const metric = row['metric'];
    if (metric === 'LCP' || metric === 'INP' || metric === 'CLS' || metric === 'TTFB') {
      cwvByMetric.set(metric, {
        metric,
        sampleCount: toNumber(row['sample_count']),
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

  const sandboxRow = (sandboxMetricsResult.rows[0] ?? {}) as Record<string, unknown>;
  const abstentionRow = (abstentionResult.rows[0] ?? {}) as Record<string, unknown>;
  const aiMetrics: AdminAiMetrics = {
    totalRuns: toNumber(sandboxRow['total_runs']),
    totalTokensIn: toNumber(sandboxRow['total_tokens_in']),
    totalTokensOut: toNumber(sandboxRow['total_tokens_out']),
    approvedGates: toNumber(sandboxRow['approved_gates']),
    rejectedGates: toNumber(sandboxRow['rejected_gates']),
    pendingGates: toNumber(sandboxRow['pending_gates']),
    abstentionEvents: toNumber(abstentionRow['abstentions']),
  };

  const totalSessions = sessionCountRows[0]?.total ?? 0;
  const totalEvents = eventCountRows[0]?.total ?? 0;

  return AdminAnalyticsSummaryDataSchema.parse({
    content,
    window,
    totalSessions,
    totalEvents,
    summary: { totalSessions, totalEvents },
    cwv,
    aiMetrics,
  });
}

export async function loadAdminAnalyticsBreakdowns(
  db: AppDatabase,
  windowInput: AdminAnalyticsWindow = '7d',
): Promise<AdminAnalyticsBreakdownsData> {
  const window = AdminAnalyticsWindowSchema.parse(windowInput);
  const cutoff = resolveAnalyticsWindowCutoff(window);

  const sessionWhere = cutoff ? sql`WHERE started_at >= ${cutoff}` : sql``;
  const eventWhere = cutoff ? sql`WHERE created_at >= ${cutoff}` : sql``;
  const eventAndCutoff = cutoff ? sql`AND created_at >= ${cutoff}` : sql``;

  const [topPathsResult, topReferrersResult, geoResult, agensiResult] = await Promise.all([
    db.execute(sql`
      SELECT
        path AS label,
        COUNT(*)::int AS total
      FROM analytics_events
      ${eventWhere}
      GROUP BY path
      ORDER BY total DESC, path ASC
      LIMIT 10
    `),
    db.execute(sql`
      SELECT
        COALESCE(NULLIF(BTRIM(referrer), ''), 'direct') AS label,
        COUNT(*)::int AS total
      FROM analytics_sessions
      ${sessionWhere}
      GROUP BY COALESCE(NULLIF(BTRIM(referrer), ''), 'direct')
      ORDER BY total DESC, label ASC
      LIMIT 10
    `),
    db.execute(sql`
      SELECT
        COALESCE(NULLIF(BTRIM(country), ''), 'Unknown') AS country_label,
        COALESCE(NULLIF(BTRIM(region), ''), '—') AS region_label,
        COUNT(*)::int AS total
      FROM analytics_sessions
      ${sessionWhere}
      GROUP BY
        COALESCE(NULLIF(BTRIM(country), ''), 'Unknown'),
        COALESCE(NULLIF(BTRIM(region), ''), '—')
      ORDER BY total DESC, country_label ASC
      LIMIT 10
    `),
    db.execute(sql`
      SELECT
        COALESCE(NULLIF(BTRIM(metadata_json->>'slug'), ''), path) AS slug,
        COUNT(*)::int AS clicks
      FROM analytics_events
      WHERE name = 'agensi_outbound_click'
        ${eventAndCutoff}
      GROUP BY COALESCE(NULLIF(BTRIM(metadata_json->>'slug'), ''), path)
      ORDER BY clicks DESC, slug ASC
      LIMIT 15
    `),
  ]);

  const topPaths: AnalyticsBreakdownRow[] = topPathsResult.rows.map(raw => {
    const row = raw as Record<string, unknown>;
    return {
      label: String(row['label'] ?? '/'),
      count: toNumber(row['total']),
    };
  });

  const topReferrers: AnalyticsBreakdownRow[] = topReferrersResult.rows.map(raw => {
    const row = raw as Record<string, unknown>;
    return {
      label: String(row['label'] ?? 'direct'),
      count: toNumber(row['total']),
    };
  });

  const geoBreakdown: AnalyticsBreakdownRow[] = geoResult.rows.map(raw => {
    const row = raw as Record<string, unknown>;
    return {
      label: String(row['country_label'] ?? 'Unknown'),
      secondaryLabel: String(row['region_label'] ?? '—'),
      count: toNumber(row['total']),
    };
  });

  const agensiConversions: AgensiConversionRow[] = agensiResult.rows.map(raw => {
    const row = raw as Record<string, unknown>;
    return {
      slug: String(row['slug'] ?? 'unknown'),
      clicks: toNumber(row['clicks']),
    };
  });

  return AdminAnalyticsBreakdownsDataSchema.parse({
    topPaths,
    topReferrers,
    geoBreakdown,
    agensiConversions,
  });
}

export async function loadAdminAnalyticsData(
  db: AppDatabase,
  windowInput: AdminAnalyticsWindow = '7d',
): Promise<AdminAnalyticsLoaderData> {
  const [summary, breakdowns] = await Promise.all([
    loadAdminAnalyticsSummary(db, windowInput),
    loadAdminAnalyticsBreakdowns(db, windowInput),
  ]);

  return AdminAnalyticsLoaderDataSchema.parse({
    ...summary,
    ...breakdowns,
  });
}
