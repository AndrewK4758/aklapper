import {
  type AdminAnalyticsFilter,
  type AnalyticsAskTurnItem,
  AnalyticsAskTurnItemSchema,
  type AnalyticsRecentVisitor,
  AnalyticsRecentVisitorSchema,
  type AnalyticsTrailEvent,
} from '@aklapper/core';
import { type SQL, sql } from 'drizzle-orm';

import {
  buildAnalyticsSessionWhere,
  toAnalyticsIsoString,
  toAnalyticsNumber,
  toNullableAnalyticsText,
} from './admin-analytics-filters.ts';
import type { AppDatabase } from './client.ts';

export interface AdminAnalyticsFeedsResult {
  readonly recentVisitors: AnalyticsRecentVisitor[];
  readonly askTurnsFeed: AnalyticsAskTurnItem[];
}

export async function loadAdminAnalyticsFeeds(
  db: AppDatabase,
  filter: AdminAnalyticsFilter,
  cutoff: Date | null,
): Promise<AdminAnalyticsFeedsResult> {
  const sessionWhere = buildAnalyticsSessionWhere(filter, cutoff, 's');
  const sessionWhereS2 = buildAnalyticsSessionWhere(filter, cutoff, 's2');
  const hasSessionCrossFilter = Boolean(
    filter.country ||
    filter.source ||
    filter.campaign ||
    filter.path ||
    filter.identified === 'true' ||
    filter.bots === 'only',
  );

  const askTurnPredicates: SQL[] = [];
  if (cutoff) {
    askTurnPredicates.push(sql`at.created_at >= ${cutoff}`);
  }
  if (hasSessionCrossFilter) {
    askTurnPredicates.push(sql`s.session_id IS NOT NULL`);
  }
  const askTurnWhere =
    askTurnPredicates.length > 0 ? sql`WHERE ${sql.join(askTurnPredicates, sql` AND `)}` : sql``;

  const [recentVisitorsResult, askFeedResult] = await Promise.all([
    db.execute(sql`
      SELECT
        s.session_id,
        s.started_at,
        COALESCE(s.last_seen_at, s.started_at) AS last_seen_at,
        s.is_bot,
        s.country,
        s.region,
        s.city,
        s.asn_org,
        s.referrer_host,
        s.referrer_category,
        s.landing_path,
        s.ref_param,
        s.utm_source,
        s.utm_medium,
        s.utm_campaign,
        s.device_type,
        s.os_name,
        s.browser_name,
        COALESCE(ec.page_view_count, 0)::int AS page_view_count,
        COALESCE(ec.event_count, 0)::int AS event_count,
        COALESCE(atc.ask_turn_count, 0)::int AS ask_turn_count,
        c.contact_id,
        c.contact_name,
        c.contact_email,
        COALESCE(tr.trail, '[]'::jsonb) AS trail
      FROM analytics_sessions s
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE e.type = 'page_view')::int AS page_view_count,
          COUNT(*)::int AS event_count
        FROM analytics_events e
        WHERE e.session_id = s.session_id
      ) ec ON true
      LEFT JOIN LATERAL (
        SELECT
          cs.id::text AS contact_id,
          cs.name AS contact_name,
          cs.email AS contact_email,
          cs.guest_session_id AS contact_guest_session_id
        FROM contact_submissions cs
        WHERE cs.analytics_session_id = s.session_id
        ORDER BY cs.created_at DESC
        LIMIT 1
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
              'type', ev.type,
              'name', ev.name,
              'path', ev.path,
              'detail', COALESCE(
                NULLIF(BTRIM(ev.metadata_json->>'target'), ''),
                NULLIF(BTRIM(ev.metadata_json->>'command'), ''),
                NULLIF(BTRIM(ev.metadata_json->>'slug'), ''),
                NULLIF(BTRIM(ev.metadata_json->>'surface'), '')
              ),
              'createdAt', to_char(ev.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
            )
            ORDER BY ev.created_at ASC, ev.id ASC
          ),
          '[]'::jsonb
        ) AS trail
        FROM (
          SELECT id, type, name, path, metadata_json, created_at
          FROM analytics_events e
          WHERE e.session_id = s.session_id
            AND e.type <> 'web_vital'
          ORDER BY e.created_at DESC, e.id DESC
          LIMIT 15
        ) ev
      ) tr ON true
      WHERE ${sessionWhere}
      ORDER BY COALESCE(s.last_seen_at, s.started_at) DESC, s.started_at DESC
      LIMIT 25
    `),
    db.execute(sql`
      SELECT
        at.attempt_id,
        at.session_id AS guest_session_id,
        s.session_id AS analytics_session_id,
        at.mode,
        at.status,
        LEFT(at.prompt_text, 240) AS prompt_excerpt,
        at.tokens_used,
        s.country,
        s.region,
        s.city,
        s.asn_org,
        c.contact_id,
        c.contact_name,
        at.created_at
      FROM ask_turns at
      LEFT JOIN LATERAL (
        SELECT
          s2.session_id,
          s2.country,
          s2.region,
          s2.city,
          s2.asn_org
        FROM analytics_sessions s2
        WHERE s2.guest_session_id = at.session_id
          AND ${sessionWhereS2}
        ORDER BY COALESCE(s2.last_seen_at, s2.started_at) DESC
        LIMIT 1
      ) s ON true
      LEFT JOIN LATERAL (
        SELECT cs.id::text AS contact_id, cs.name AS contact_name
        FROM contact_submissions cs
        WHERE cs.guest_session_id = at.session_id
           OR (s.session_id IS NOT NULL AND cs.analytics_session_id = s.session_id)
        ORDER BY cs.created_at DESC
        LIMIT 1
      ) c ON true
      ${askTurnWhere}
      ORDER BY at.created_at DESC
      LIMIT 25
    `),
  ]);

  const recentVisitors: AnalyticsRecentVisitor[] = recentVisitorsResult.rows.map(raw => {
    const row = raw as Record<string, unknown>;
    const rawTrail = Array.isArray(row['trail']) ? (row['trail'] as AnalyticsTrailEvent[]) : [];
    return AnalyticsRecentVisitorSchema.parse({
      sessionId: String(row['session_id']),
      startedAt: toAnalyticsIsoString(row['started_at']),
      lastSeenAt: toAnalyticsIsoString(row['last_seen_at']),
      isBot: Boolean(row['is_bot']),
      country: toNullableAnalyticsText(row['country']),
      region: toNullableAnalyticsText(row['region']),
      city: toNullableAnalyticsText(row['city']),
      asnOrg: toNullableAnalyticsText(row['asn_org']),
      referrerHost: toNullableAnalyticsText(row['referrer_host']),
      referrerCategory: toNullableAnalyticsText(row['referrer_category']),
      landingPath: toNullableAnalyticsText(row['landing_path']),
      refParam: toNullableAnalyticsText(row['ref_param']),
      utmSource: toNullableAnalyticsText(row['utm_source']),
      utmMedium: toNullableAnalyticsText(row['utm_medium']),
      utmCampaign: toNullableAnalyticsText(row['utm_campaign']),
      deviceType: toNullableAnalyticsText(row['device_type']),
      osName: toNullableAnalyticsText(row['os_name']),
      browserName: toNullableAnalyticsText(row['browser_name']),
      pageViewCount: toAnalyticsNumber(row['page_view_count']),
      eventCount: toAnalyticsNumber(row['event_count']),
      askTurnCount: toAnalyticsNumber(row['ask_turn_count']),
      contactId: toNullableAnalyticsText(row['contact_id']),
      contactName: toNullableAnalyticsText(row['contact_name']),
      contactEmail: toNullableAnalyticsText(row['contact_email']),
      trail: rawTrail.slice(0, 15),
    });
  });

  const askTurnsFeed: AnalyticsAskTurnItem[] = askFeedResult.rows.map(raw => {
    const row = raw as Record<string, unknown>;
    return AnalyticsAskTurnItemSchema.parse({
      attemptId: String(row['attempt_id']),
      guestSessionId: String(row['guest_session_id']),
      analyticsSessionId: toNullableAnalyticsText(row['analytics_session_id']),
      mode: row['mode'] === 'jd_match' ? 'jd_match' : 'qa',
      status: String(row['status']),
      promptExcerpt: toNullableAnalyticsText(row['prompt_excerpt']),
      tokensUsed: toAnalyticsNumber(row['tokens_used']),
      country: toNullableAnalyticsText(row['country']),
      region: toNullableAnalyticsText(row['region']),
      city: toNullableAnalyticsText(row['city']),
      asnOrg: toNullableAnalyticsText(row['asn_org']),
      contactId: toNullableAnalyticsText(row['contact_id']),
      contactName: toNullableAnalyticsText(row['contact_name']),
      createdAt: toAnalyticsIsoString(row['created_at']),
    });
  });

  return { recentVisitors, askTurnsFeed };
}
