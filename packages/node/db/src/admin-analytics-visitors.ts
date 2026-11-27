import {
  type AdminAnalyticsFilter,
  type AnalyticsAskTurnItem,
  type AnalyticsBreakdownRow,
  type AnalyticsFunnelStep,
  AnalyticsFunnelStepSchema,
  type AnalyticsRecentVisitor,
} from '@aklapper/core';
import { sql } from 'drizzle-orm';

import { loadAdminAnalyticsFeeds } from './admin-analytics-feeds.ts';
import {
  buildAnalyticsSessionWhere,
  toAnalyticsNumber,
  toNullableAnalyticsText,
} from './admin-analytics-filters.ts';
import type { AppDatabase } from './client.ts';

export {
  type AdminAnalyticsFilterInput,
  buildAnalyticsSessionWhere,
  loadAdminAnalyticsDailyTrend,
  normalizeAdminAnalyticsFilter,
  resolveAnalyticsWindowCutoff,
  toAnalyticsNumber,
} from './admin-analytics-filters.ts';

export interface ExtendedAnalyticsBreakdowns {
  readonly orgBreakdown: AnalyticsBreakdownRow[];
  readonly campaignBreakdown: AnalyticsBreakdownRow[];
  readonly deviceBreakdown: AnalyticsBreakdownRow[];
  readonly osBreakdown: AnalyticsBreakdownRow[];
  readonly browserBreakdown: AnalyticsBreakdownRow[];
  readonly conversionFunnel: AnalyticsFunnelStep[];
  readonly recentVisitors: AnalyticsRecentVisitor[];
  readonly askTurnsFeed: AnalyticsAskTurnItem[];
}

function mapBreakdownRows(
  rows: readonly unknown[],
  fallbackLabel: string,
): AnalyticsBreakdownRow[] {
  return rows.map(raw => {
    const row = raw as Record<string, unknown>;
    const label = String(row['label'] ?? fallbackLabel);
    const secondary = toNullableAnalyticsText(row['secondary_label']);
    const filterValue = toNullableAnalyticsText(row['filter_value']);
    return {
      label,
      count: toAnalyticsNumber(row['total']),
      ...(secondary ? { secondaryLabel: secondary } : {}),
      ...(filterValue ? { filterValue } : {}),
    };
  });
}

export async function loadAdminAnalyticsExtendedBreakdowns(
  db: AppDatabase,
  filter: AdminAnalyticsFilter,
  cutoff: Date | null,
): Promise<ExtendedAnalyticsBreakdowns> {
  const sessionWhere = buildAnalyticsSessionWhere(filter, cutoff, 's');

  const [orgResult, campaignResult, deviceResult, osResult, browserResult, funnelResult, feeds] =
    await Promise.all([
      db.execute(sql`
        SELECT
          BTRIM(s.asn_org) AS label,
          COUNT(*)::int AS total
        FROM analytics_sessions s
        WHERE ${sessionWhere}
          AND s.asn_org IS NOT NULL
          AND BTRIM(s.asn_org) <> ''
        GROUP BY 1
        ORDER BY total DESC, label ASC
        LIMIT 10
      `),
      db.execute(sql`
        SELECT
          COALESCE(
            NULLIF(BTRIM(s.utm_campaign), ''),
            NULLIF(BTRIM(s.ref_param), ''),
            NULLIF(BTRIM(s.utm_source), '')
          ) AS label,
          COALESCE(NULLIF(BTRIM(s.utm_source), ''), NULLIF(BTRIM(s.ref_param), '')) AS secondary_label,
          COALESCE(
            NULLIF(BTRIM(s.utm_campaign), ''),
            NULLIF(BTRIM(s.ref_param), ''),
            NULLIF(BTRIM(s.utm_source), '')
          ) AS filter_value,
          COUNT(*)::int AS total
        FROM analytics_sessions s
        WHERE ${sessionWhere}
          AND (
            (s.utm_campaign IS NOT NULL AND BTRIM(s.utm_campaign) <> '')
            OR (s.ref_param IS NOT NULL AND BTRIM(s.ref_param) <> '')
            OR (s.utm_source IS NOT NULL AND BTRIM(s.utm_source) <> '')
          )
        GROUP BY 1, 2, 3
        ORDER BY total DESC, label ASC
        LIMIT 10
      `),
      db.execute(sql`
        SELECT
          COALESCE(NULLIF(BTRIM(s.device_type), ''), 'unknown') AS label,
          COUNT(*)::int AS total
        FROM analytics_sessions s
        WHERE ${sessionWhere}
        GROUP BY 1
        ORDER BY total DESC, label ASC
        LIMIT 6
      `),
      db.execute(sql`
        SELECT
          COALESCE(NULLIF(BTRIM(s.os_name), ''), 'Unknown') AS label,
          COUNT(*)::int AS total
        FROM analytics_sessions s
        WHERE ${sessionWhere}
        GROUP BY 1
        ORDER BY total DESC, label ASC
        LIMIT 8
      `),
      db.execute(sql`
        SELECT
          COALESCE(NULLIF(BTRIM(s.browser_name), ''), 'Unknown') AS label,
          COUNT(*)::int AS total
        FROM analytics_sessions s
        WHERE ${sessionWhere}
        GROUP BY 1
        ORDER BY total DESC, label ASC
        LIMIT 8
      `),
      db.execute(sql`
        SELECT
          COUNT(*)::int AS landed,
          COUNT(*) FILTER (
            WHERE EXISTS (
              SELECT 1
              FROM analytics_events e
              WHERE e.session_id = s.session_id
                AND (
                  (e.type = 'page_view' AND e.path IN ('/about', '/chat', '/agensi', '/cadence'))
                  OR e.name IN ('pane_open', 'about_outbound_click', 'agensi_outbound_click')
                )
            )
          )::int AS engaged_profile,
          COUNT(*) FILTER (
            WHERE EXISTS (
              SELECT 1 FROM contact_submissions cs WHERE cs.analytics_session_id = s.session_id
            )
            OR EXISTS (
              SELECT 1 FROM analytics_events e WHERE e.session_id = s.session_id AND e.name = 'contact_submitted'
            )
          )::int AS submitted_contact
        FROM analytics_sessions s
        WHERE ${sessionWhere}
      `),
      loadAdminAnalyticsFeeds(db, filter, cutoff),
    ]);

  const funnelRow = (funnelResult.rows[0] ?? {}) as Record<string, unknown>;
  const landed = toAnalyticsNumber(funnelRow['landed']);
  const engagedProfile = toAnalyticsNumber(funnelRow['engaged_profile']);
  const submittedContact = toAnalyticsNumber(funnelRow['submitted_contact']);
  const rate = (count: number): number =>
    landed > 0 ? Math.min(1, Math.round((count / landed) * 1000) / 1000) : 0;

  const conversionFunnel: AnalyticsFunnelStep[] = [
    AnalyticsFunnelStepSchema.parse({
      step: 'landed',
      label: 'Landed',
      sessions: landed,
      conversionRate: landed > 0 ? 1 : 0,
    }),
    AnalyticsFunnelStepSchema.parse({
      step: 'engaged_profile',
      label: 'Viewed About / Chat / Agensi / CADENCE',
      sessions: engagedProfile,
      conversionRate: rate(engagedProfile),
    }),
    AnalyticsFunnelStepSchema.parse({
      step: 'submitted_contact',
      label: 'Submitted Contact',
      sessions: submittedContact,
      conversionRate: rate(submittedContact),
    }),
  ];

  return {
    orgBreakdown: mapBreakdownRows(orgResult.rows, 'Unknown'),
    campaignBreakdown: mapBreakdownRows(campaignResult.rows, 'none'),
    deviceBreakdown: mapBreakdownRows(deviceResult.rows, 'unknown'),
    osBreakdown: mapBreakdownRows(osResult.rows, 'Unknown'),
    browserBreakdown: mapBreakdownRows(browserResult.rows, 'Unknown'),
    conversionFunnel,
    ...feeds,
  };
}
