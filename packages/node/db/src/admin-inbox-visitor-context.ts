import { type InboxVisitorContext, InboxVisitorContextSchema } from '@aklapper/core';
import { sql } from 'drizzle-orm';

import { toAnalyticsNumber } from './admin-analytics-visitors.ts';
import type { AppDatabase } from './client.ts';

function toNullableText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNullableIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

export async function loadInboxVisitorContextMap(
  db: AppDatabase,
  contactIds: readonly string[],
): Promise<Map<string, InboxVisitorContext | null>> {
  const resultMap = new Map<string, InboxVisitorContext | null>();
  if (contactIds.length === 0) return resultMap;

  const idParams = sql.join(
    contactIds.map(id => sql`${id}::uuid`),
    sql`, `,
  );

  const queryResult = await db.execute(sql`
    SELECT
      cs.id::text AS contact_id,
      cs.analytics_session_id,
      COALESCE(cs.guest_session_id, s.guest_session_id) AS effective_guest_session_id,
      s.country,
      s.region,
      s.city,
      s.asn_org,
      s.referrer_host,
      s.referrer_category,
      s.landing_path,
      s.ref_param,
      s.utm_source,
      s.utm_campaign,
      s.device_type,
      s.os_name,
      s.browser_name,
      s.started_at,
      COALESCE(s.last_seen_at, s.started_at) AS last_seen_at,
      COALESCE(ev.viewed_paths, ARRAY[]::text[]) AS viewed_paths,
      COALESCE(ev.pane_open_count, 0)::int AS pane_open_count,
      COALESCE(atx.ask_turn_count, 0)::int AS ask_turn_count,
      atx.latest_ask_prompt_excerpt
    FROM contact_submissions cs
    LEFT JOIN analytics_sessions s ON s.session_id = cs.analytics_session_id
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(
          (
            SELECT ARRAY_AGG(vp.path ORDER BY vp.first_seen ASC)
            FROM (
              SELECT e.path, MIN(e.created_at) AS first_seen
              FROM analytics_events e
              WHERE e.session_id = s.session_id
                AND e.type = 'page_view'
              GROUP BY e.path
              ORDER BY MIN(e.created_at) ASC
              LIMIT 6
            ) vp
          ),
          ARRAY[]::text[]
        ) AS viewed_paths,
        (
          SELECT COUNT(*)::int
          FROM analytics_events e
          WHERE e.session_id = s.session_id
            AND e.name = 'pane_open'
        ) AS pane_open_count
    ) ev ON s.session_id IS NOT NULL
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS ask_turn_count,
        (
          SELECT LEFT(at2.prompt_text, 160)
          FROM ask_turns at2
          WHERE at2.session_id = COALESCE(cs.guest_session_id, s.guest_session_id)
            AND at2.prompt_text IS NOT NULL
            AND BTRIM(at2.prompt_text) <> ''
          ORDER BY at2.created_at DESC
          LIMIT 1
        ) AS latest_ask_prompt_excerpt
      FROM ask_turns at
      WHERE COALESCE(cs.guest_session_id, s.guest_session_id) IS NOT NULL
        AND at.session_id = COALESCE(cs.guest_session_id, s.guest_session_id)
    ) atx ON true
    WHERE cs.id IN (${idParams})
  `);

  for (const raw of queryResult.rows) {
    const row = raw as Record<string, unknown>;
    const contactId = String(row['contact_id']);
    const analyticsSessionId = toNullableText(row['analytics_session_id']);
    const guestSessionId = toNullableText(row['effective_guest_session_id']);
    if (!analyticsSessionId && !guestSessionId) {
      resultMap.set(contactId, null);
      continue;
    }

    const rawPaths = Array.isArray(row['viewed_paths'])
      ? (row['viewed_paths'] as unknown[])
          .filter((p): p is string => typeof p === 'string')
          .slice(0, 6)
      : [];

    resultMap.set(
      contactId,
      InboxVisitorContextSchema.parse({
        analyticsSessionId,
        guestSessionId,
        country: toNullableText(row['country']),
        region: toNullableText(row['region']),
        city: toNullableText(row['city']),
        asnOrg: toNullableText(row['asn_org']),
        referrerHost: toNullableText(row['referrer_host']),
        referrerCategory: toNullableText(row['referrer_category']),
        landingPath: toNullableText(row['landing_path']),
        refParam: toNullableText(row['ref_param']),
        utmSource: toNullableText(row['utm_source']),
        utmCampaign: toNullableText(row['utm_campaign']),
        deviceType: toNullableText(row['device_type']),
        osName: toNullableText(row['os_name']),
        browserName: toNullableText(row['browser_name']),
        viewedPaths: rawPaths,
        paneOpenCount: toAnalyticsNumber(row['pane_open_count']),
        askTurnCount: toAnalyticsNumber(row['ask_turn_count']),
        latestAskPromptExcerpt: toNullableText(row['latest_ask_prompt_excerpt']),
        startedAt: toNullableIso(row['started_at']),
        lastSeenAt: toNullableIso(row['last_seen_at']),
      }),
    );
  }

  return resultMap;
}
