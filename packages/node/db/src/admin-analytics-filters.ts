import {
  type AdminAnalyticsFilter,
  AdminAnalyticsFilterSchema,
  type AdminAnalyticsWindow,
  AdminAnalyticsWindowSchema,
  type AnalyticsDailyTrendPoint,
  AnalyticsDailyTrendPointSchema,
} from '@aklapper/core';
import { type SQL, sql } from 'drizzle-orm';

import type { AppDatabase } from './client.ts';

export type AdminAnalyticsFilterInput = AdminAnalyticsWindow | Partial<AdminAnalyticsFilter>;

export function toAnalyticsNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function toNullableAnalyticsText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function toAnalyticsIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
}

export function normalizeAdminAnalyticsFilter(
  input: AdminAnalyticsFilterInput = '7d',
): AdminAnalyticsFilter {
  if (typeof input === 'string') {
    const window = AdminAnalyticsWindowSchema.parse(input);
    return { window, bots: 'exclude', identified: 'all' };
  }
  return AdminAnalyticsFilterSchema.parse(input);
}

export function resolveAnalyticsWindowCutoff(window: AdminAnalyticsWindow): Date | null {
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

export function buildAnalyticsSessionWhere(
  filter: AdminAnalyticsFilter,
  cutoff: Date | null,
  alias: 's' | 's2' = 's',
): SQL {
  const col = (name: string): SQL => sql.raw(`${alias}.${name}`);
  const predicates: SQL[] = [sql`${col('app')} = 'portal'`];

  if (filter.bots === 'exclude') {
    predicates.push(sql`${col('is_bot')} = false`);
  } else if (filter.bots === 'only') {
    predicates.push(sql`${col('is_bot')} = true`);
  }

  if (cutoff) {
    predicates.push(sql`${col('started_at')} >= ${cutoff}`);
  }

  if (filter.country) {
    if (filter.country.toLowerCase() === 'unknown') {
      predicates.push(sql`(${col('country')} IS NULL OR BTRIM(${col('country')}) = '')`);
    } else {
      predicates.push(
        sql`UPPER(COALESCE(NULLIF(BTRIM(${col('country')}), ''), 'Unknown')) = UPPER(${filter.country})`,
      );
    }
  }

  if (filter.source) {
    if (filter.source.toLowerCase() === 'direct') {
      predicates.push(
        sql`(${col('referrer_host')} IS NULL OR BTRIM(${col('referrer_host')}) = '')`,
      );
    } else {
      predicates.push(
        sql`(LOWER(COALESCE(${col('referrer_host')}, '')) = LOWER(${filter.source}) OR LOWER(COALESCE(${col('referrer_category')}, '')) = LOWER(${filter.source}))`,
      );
    }
  }

  if (filter.campaign) {
    predicates.push(
      sql`(${col('ref_param')} = ${filter.campaign} OR ${col('utm_campaign')} = ${filter.campaign} OR ${col('utm_source')} = ${filter.campaign})`,
    );
  }

  if (filter.path) {
    predicates.push(
      sql`EXISTS (SELECT 1 FROM analytics_events ep WHERE ep.session_id = ${col('session_id')} AND ep.type = 'page_view' AND ep.path = ${filter.path})`,
    );
  }

  if (filter.identified === 'true') {
    predicates.push(
      sql`EXISTS (SELECT 1 FROM contact_submissions cs WHERE cs.analytics_session_id = ${col('session_id')})`,
    );
  }

  return sql.join(predicates, sql` AND `);
}

export async function loadAdminAnalyticsDailyTrend(
  db: AppDatabase,
  sessionWhere: SQL,
): Promise<AnalyticsDailyTrendPoint[]> {
  const result = await db.execute(sql`
    WITH latest_days AS (
      SELECT
        to_char(s.started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day_date,
        COUNT(DISTINCT COALESCE(s.visitor_hash, s.ip_hash, s.session_id))::int AS unique_visitors,
        COUNT(DISTINCT s.session_id)::int AS sessions,
        COALESCE(SUM(COALESCE(pv.page_views, 0)), 0)::int AS page_views
      FROM analytics_sessions s
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS page_views
        FROM analytics_events e
        WHERE e.session_id = s.session_id
          AND e.type = 'page_view'
      ) pv ON true
      WHERE ${sessionWhere}
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT 90
    )
    SELECT day_date, unique_visitors, sessions, page_views
    FROM latest_days
    ORDER BY day_date ASC
  `);

  return result.rows.map(raw => {
    const row = raw as Record<string, unknown>;
    return AnalyticsDailyTrendPointSchema.parse({
      date: String(row['day_date'] ?? '1970-01-01'),
      uniqueVisitors: toAnalyticsNumber(row['unique_visitors']),
      sessions: toAnalyticsNumber(row['sessions']),
      pageViews: toAnalyticsNumber(row['page_views']),
    });
  });
}
