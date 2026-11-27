import { randomUUID } from 'node:crypto';

import {
  type AnalyticsApp,
  type AnalyticsBatch,
  AnalyticsBatchSchema,
  type DeviceType,
  type ReferrerCategory,
  sanitizeControlChars,
} from '@aklapper/core';
import {
  buildDailyAnalyticsSalt,
  classifyBotUserAgent,
  extractCampaignParams,
  hashVisitorIdentity,
  hashVisitorIp,
  lookupGeoIpEnrichment,
  normalizeLandingPath,
  normalizeReferrer,
  parseUserAgentProfile,
  resolveAnalyticsClientIp,
  sanitizeCampaignValue,
} from '@aklapper/node-runtime/analytics';
import type { SsrStructuredLogger } from '@aklapper/node-runtime/ssr/stream';
import { sql } from 'drizzle-orm';

import type { AppDatabase } from './client.ts';
import * as schema from './schema.ts';

export interface IngestAnalyticsMeta {
  ipHash: string;
  visitorHash?: string | null;
  app?: AnalyticsApp;
  isBot?: boolean;
  guestSessionId?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  timezone?: string | null;
  asn?: number | null;
  asnOrg?: string | null;
  referrer?: string | null;
  referrerHost?: string | null;
  referrerCategory?: ReferrerCategory | null;
  landingPath?: string | null;
  refParam?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  deviceType?: DeviceType | null;
  osName?: string | null;
  browserName?: string | null;
  now?: Date;
}

export interface IngestAnalyticsResult {
  accepted: number;
  sessionId: string;
  ipHash: string;
}

export interface EnrichAnalyticsRequestOptions {
  readonly app?: AnalyticsApp;
  readonly guestSessionId?: string | null;
  readonly rawReferrer?: string | null;
  readonly landingPath?: string | null;
  readonly refParam?: string | null;
  readonly utmSource?: string | null;
  readonly utmMedium?: string | null;
  readonly utmCampaign?: string | null;
  readonly utmContent?: string | null;
  readonly env?: Record<string, string | undefined>;
  readonly geoIpDir?: string;
  readonly logger?: SsrStructuredLogger;
  readonly now?: Date;
}

type DbExecutor = Pick<AppDatabase, 'execute' | 'insert' | 'select' | 'update'>;

const SESSION_IDLE_MINUTES = 30;
const INITIAL_PAGE_VIEW_DEDUP_SECONDS = 15;
const HEADER_GEO_MAX_LEN = 64;
const EVENT_CLOCK_SKEW_MAX_MS = 5_000;

function stripNul(value: string): string {
  return value.replaceAll('\0', '');
}

function sanitizeHeaderGeo(raw: string | null): string | null {
  return sanitizeControlChars(raw, HEADER_GEO_MAX_LEN);
}

function sanitizeEventMetadata(
  metadata: Record<string, string | number | boolean> | undefined,
): Record<string, unknown> {
  if (!metadata) return {};
  const cleaned: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(metadata)) {
    const cleanKey = stripNul(key).trim();
    if (!cleanKey) continue;
    cleaned[cleanKey] = typeof val === 'string' ? stripNul(val) : val;
  }
  return cleaned;
}

function clampEventTimestamp(rawTimestamp: string, serverNow: Date): Date {
  const serverMs = serverNow.getTime();
  const parsed = new Date(rawTimestamp);
  const parsedMs = parsed.getTime();
  if (Number.isNaN(parsedMs)) return serverNow;
  if (parsedMs < serverMs - EVENT_CLOCK_SKEW_MAX_MS) {
    return new Date(serverMs - EVENT_CLOCK_SKEW_MAX_MS);
  }
  if (parsedMs > serverMs + EVENT_CLOCK_SKEW_MAX_MS) {
    return new Date(serverMs + EVENT_CLOCK_SKEW_MAX_MS);
  }
  return parsed;
}

export async function acquireAnalyticsVisitorLock(
  tx: DbExecutor,
  app: AnalyticsApp,
  visitorHash: string,
): Promise<void> {
  const lockKey = `analytics_session:${app}:${visitorHash}`;
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
}

export async function findActiveSameUtcDaySessionId(
  tx: DbExecutor,
  app: AnalyticsApp,
  visitorHash: string,
  now: Date,
): Promise<string | null> {
  const nowIso = now.toISOString();
  const result = await tx.execute(sql`
    SELECT session_id
    FROM analytics_sessions
    WHERE app = ${app}
      AND visitor_hash = ${visitorHash}
      AND started_at >= date_trunc('day', ${nowIso}::timestamptz AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      AND COALESCE(last_seen_at, started_at) >= ${nowIso}::timestamptz - (${SESSION_IDLE_MINUTES} * interval '1 minute')
    ORDER BY COALESCE(last_seen_at, started_at) DESC, started_at DESC
    LIMIT 1
  `);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  const sessionId = row?.['session_id'];
  return typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : null;
}

export async function upsertAnalyticsSessionRow(
  tx: DbExecutor,
  sessionId: string,
  meta: IngestAnalyticsMeta,
  now: Date,
): Promise<boolean> {
  const app: AnalyticsApp = meta.app ?? 'portal';
  const isBot = Boolean(meta.isBot);
  const rows = await tx
    .insert(schema.analyticsSessions)
    .values({
      sessionId: stripNul(sessionId),
      ipHash: meta.ipHash,
      referrer: meta.referrer ? stripNul(meta.referrer) : null,
      country: meta.country ? stripNul(meta.country).trim() || null : null,
      region: meta.region ? stripNul(meta.region).trim() || null : null,
      startedAt: now,
      app,
      isBot,
      visitorHash: meta.visitorHash ?? null,
      guestSessionId: meta.guestSessionId ? stripNul(meta.guestSessionId).trim() || null : null,
      city: meta.city?.trim() || null,
      timezone: meta.timezone?.trim() || null,
      asn: meta.asn ?? null,
      asnOrg: meta.asnOrg?.trim() || null,
      referrerHost: meta.referrerHost?.trim() || null,
      referrerCategory: meta.referrerCategory ?? null,
      landingPath: meta.landingPath ? normalizeLandingPath(meta.landingPath) : null,
      refParam: meta.refParam?.trim() || null,
      utmSource: meta.utmSource?.trim() || null,
      utmMedium: meta.utmMedium?.trim() || null,
      utmCampaign: meta.utmCampaign?.trim() || null,
      utmContent: meta.utmContent?.trim() || null,
      deviceType: meta.deviceType ?? null,
      osName: meta.osName?.trim() || null,
      browserName: meta.browserName?.trim() || null,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: schema.analyticsSessions.sessionId,
      set: {
        lastSeenAt: sql`GREATEST(COALESCE(${schema.analyticsSessions.lastSeenAt}, ${schema.analyticsSessions.startedAt}), EXCLUDED.last_seen_at)`,
        isBot: sql`${schema.analyticsSessions.isBot} OR EXCLUDED.is_bot`,
        visitorHash: sql`COALESCE(${schema.analyticsSessions.visitorHash}, EXCLUDED.visitor_hash)`,
        guestSessionId: sql`COALESCE(${schema.analyticsSessions.guestSessionId}, EXCLUDED.guest_session_id)`,
        referrer: sql`COALESCE(${schema.analyticsSessions.referrer}, EXCLUDED.referrer)`,
        referrerHost: sql`COALESCE(${schema.analyticsSessions.referrerHost}, EXCLUDED.referrer_host)`,
        referrerCategory: sql`CASE WHEN ${schema.analyticsSessions.referrerHost} IS NULL AND EXCLUDED.referrer_host IS NOT NULL THEN EXCLUDED.referrer_category ELSE COALESCE(${schema.analyticsSessions.referrerCategory}, EXCLUDED.referrer_category) END`,
        landingPath: sql`COALESCE(${schema.analyticsSessions.landingPath}, EXCLUDED.landing_path)`,
        refParam: sql`COALESCE(${schema.analyticsSessions.refParam}, EXCLUDED.ref_param)`,
        utmSource: sql`COALESCE(${schema.analyticsSessions.utmSource}, EXCLUDED.utm_source)`,
        utmMedium: sql`COALESCE(${schema.analyticsSessions.utmMedium}, EXCLUDED.utm_medium)`,
        utmCampaign: sql`COALESCE(${schema.analyticsSessions.utmCampaign}, EXCLUDED.utm_campaign)`,
        utmContent: sql`COALESCE(${schema.analyticsSessions.utmContent}, EXCLUDED.utm_content)`,
        country: sql`COALESCE(${schema.analyticsSessions.country}, EXCLUDED.country)`,
        region: sql`COALESCE(${schema.analyticsSessions.region}, EXCLUDED.region)`,
        city: sql`COALESCE(${schema.analyticsSessions.city}, EXCLUDED.city)`,
        timezone: sql`COALESCE(${schema.analyticsSessions.timezone}, EXCLUDED.timezone)`,
        asn: sql`COALESCE(${schema.analyticsSessions.asn}, EXCLUDED.asn)`,
        asnOrg: sql`COALESCE(${schema.analyticsSessions.asnOrg}, EXCLUDED.asn_org)`,
        deviceType: sql`COALESCE(${schema.analyticsSessions.deviceType}, EXCLUDED.device_type)`,
        osName: sql`COALESCE(${schema.analyticsSessions.osName}, EXCLUDED.os_name)`,
        browserName: sql`COALESCE(${schema.analyticsSessions.browserName}, EXCLUDED.browser_name)`,
      },
      setWhere: sql`${schema.analyticsSessions.app} = EXCLUDED.app AND ${schema.analyticsSessions.visitorHash} IS NOT DISTINCT FROM EXCLUDED.visitor_hash`,
    })
    .returning({ sessionId: schema.analyticsSessions.sessionId });
  return rows.length > 0;
}

export async function enrichAnalyticsRequestMetadata(
  request: Request,
  options: EnrichAnalyticsRequestOptions = {},
): Promise<IngestAnalyticsMeta> {
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();
  const app: AnalyticsApp = options.app ?? 'portal';
  const clientIp = resolveAnalyticsClientIp(request);
  const userAgent = request.headers.get('user-agent') ?? '';
  const dailySalt = buildDailyAnalyticsSalt(env['ANALYTICS_DAILY_SALT']?.trim() || 'dev-only', now);
  const ipHash = hashVisitorIp(clientIp, dailySalt);
  const visitorHash = hashVisitorIdentity(clientIp, userAgent, dailySalt);

  const botResult = classifyBotUserAgent(userAgent);
  options.logger?.info(
    {
      seam_type: 'RULE_DIVERGENCE',
      event: 'analytics.ingest.bot_classification_branch',
      branch: botResult.branch,
      app,
    },
    'Bot classification evaluated',
  );
  const uaProfile = parseUserAgentProfile(userAgent);

  const geo = await lookupGeoIpEnrichment(clientIp, {
    ...(options.geoIpDir ? { dbDir: options.geoIpDir } : {}),
    ...(options.logger ? { logger: options.logger } : {}),
  });
  const headerCountry = sanitizeHeaderGeo(request.headers.get('x-cloud-country'));
  const headerRegion = sanitizeHeaderGeo(request.headers.get('x-cloud-region'));

  const ownHosts = [
    request.headers.get('host') ?? '',
    env['PUBLIC_PORTAL_URL'] ?? '',
    'andrew-k.us',
  ];
  const rawReferrer = options.rawReferrer ?? request.headers.get('referer');
  const normalizedRef = normalizeReferrer(rawReferrer, ownHosts);
  const urlCampaign = extractCampaignParams(request.url);

  return {
    app,
    isBot: botResult.isBot,
    ipHash,
    visitorHash,
    guestSessionId: options.guestSessionId?.trim() || null,
    country: geo.country ?? headerCountry,
    region: geo.region ?? headerRegion,
    city: geo.city,
    timezone: geo.timezone,
    asn: geo.asn,
    asnOrg: geo.asnOrg,
    referrer: normalizedRef.referrer,
    referrerHost: normalizedRef.referrerHost,
    referrerCategory: normalizedRef.referrerCategory,
    landingPath: options.landingPath
      ? normalizeLandingPath(options.landingPath)
      : urlCampaign.landingPath,
    refParam: sanitizeCampaignValue(options.refParam) ?? urlCampaign.refParam,
    utmSource: sanitizeCampaignValue(options.utmSource) ?? urlCampaign.utmSource,
    utmMedium: sanitizeCampaignValue(options.utmMedium) ?? urlCampaign.utmMedium,
    utmCampaign: sanitizeCampaignValue(options.utmCampaign) ?? urlCampaign.utmCampaign,
    utmContent: sanitizeCampaignValue(options.utmContent) ?? urlCampaign.utmContent,
    deviceType: uaProfile.deviceType,
    osName: uaProfile.osName,
    browserName: uaProfile.browserName,
    now,
  };
}

export async function ingestAnalyticsBatch(
  db: AppDatabase,
  batch: AnalyticsBatch,
  meta: IngestAnalyticsMeta,
): Promise<IngestAnalyticsResult> {
  const parsed = AnalyticsBatchSchema.parse(batch);
  const app: AnalyticsApp = meta.app ?? 'portal';
  const now = meta.now ?? new Date();
  const visitorHash = meta.visitorHash?.trim() || null;
  const normalizedMeta: IngestAnalyticsMeta = {
    ...meta,
    app,
    visitorHash,
    referrer: meta.referrer !== undefined ? meta.referrer : (parsed.referrer ?? null),
    landingPath:
      meta.landingPath ??
      (parsed.landingPath ? normalizeLandingPath(parsed.landingPath) : null) ??
      normalizeLandingPath(parsed.events[0]?.path),
    refParam: meta.refParam ?? sanitizeCampaignValue(parsed.refParam),
    utmSource: meta.utmSource ?? sanitizeCampaignValue(parsed.utmSource),
    utmMedium: meta.utmMedium ?? sanitizeCampaignValue(parsed.utmMedium),
    utmCampaign: meta.utmCampaign ?? sanitizeCampaignValue(parsed.utmCampaign),
    utmContent: meta.utmContent ?? sanitizeCampaignValue(parsed.utmContent),
  };

  return db.transaction(async tx => {
    if (visitorHash) {
      await acquireAnalyticsVisitorLock(tx, app, visitorHash);
    }

    let canonicalSessionId: string;
    if (app === 'portal' && visitorHash) {
      const existingSessionId = await findActiveSameUtcDaySessionId(tx, 'portal', visitorHash, now);
      canonicalSessionId = existingSessionId ?? `sess_${randomUUID()}`;
    } else {
      canonicalSessionId = parsed.sessionId.trim() || `sess_${randomUUID()}`;
    }

    const upserted = await upsertAnalyticsSessionRow(tx, canonicalSessionId, normalizedMeta, now);
    if (!upserted) {
      canonicalSessionId = `sess_${randomUUID()}`;
      await upsertAnalyticsSessionRow(tx, canonicalSessionId, normalizedMeta, now);
    }

    const nowIso = now.toISOString();
    const eventsToInsert = [];
    for (const event of parsed.events) {
      const normalizedPath = normalizeLandingPath(event.path);
      const nav = event.metadata?.['navigation'];
      const counterpartNav =
        event.type === 'page_view' && nav === 'initial'
          ? 'ssr'
          : event.type === 'page_view' && nav === 'ssr'
            ? 'initial'
            : null;
      if (counterpartNav) {
        const dup = await tx.execute(sql`
          SELECT 1
          FROM analytics_events
          WHERE session_id = ${canonicalSessionId}
            AND type = 'page_view'
            AND path = ${normalizedPath}
            AND metadata_json->>'navigation' = ${counterpartNav}
            AND created_at >= ${nowIso}::timestamptz - (${INITIAL_PAGE_VIEW_DEDUP_SECONDS} * interval '1 second')
            AND created_at <= ${nowIso}::timestamptz + (${INITIAL_PAGE_VIEW_DEDUP_SECONDS} * interval '1 second')
          LIMIT 1
        `);
        if (dup.rows.length > 0) {
          continue;
        }
      }
      eventsToInsert.push({
        sessionId: canonicalSessionId,
        type: event.type,
        name: stripNul(event.name),
        path: normalizedPath,
        value: event.value ?? null,
        metadataJson: sanitizeEventMetadata(event.metadata),
        createdAt: clampEventTimestamp(event.timestamp, now),
      });
    }

    if (eventsToInsert.length > 0) {
      await tx.insert(schema.analyticsEvents).values(eventsToInsert);
    }

    return {
      accepted: eventsToInsert.length,
      sessionId: canonicalSessionId,
      ipHash: meta.ipHash,
    };
  });
}
