import { randomUUID } from 'node:crypto';

import {
  buildDailyAnalyticsSalt,
  buildPreviousUtcDayAnalyticsSalt,
  hashVisitorIdentity,
  hashVisitorIp,
  isWithinUtcMidnightGraceWindow,
  resolveAnalyticsClientIp,
} from '@aklapper/node-runtime/analytics';
import type { SsrStructuredLogger } from '@aklapper/node-runtime/ssr/stream';
import { eq, sql } from 'drizzle-orm';

import {
  acquireAnalyticsVisitorLock,
  enrichAnalyticsRequestMetadata,
  upsertAnalyticsSessionRow,
} from './analytics-ingest.ts';
import type { AppDatabase } from './client.ts';
import * as schema from './schema.ts';

export type ContactLinkMethod =
  | 'verified_client_session'
  | 'visitor_hash_match'
  | 'guest_session_match'
  | 'fallback_upserted'
  | 'fail_open_null';

export interface ContactAnalyticsLinkOptions {
  readonly candidateSessionId?: string | null;
  readonly guestSessionId?: string | null;
  readonly env?: Record<string, string | undefined>;
  readonly geoIpDir?: string;
  readonly logger?: SsrStructuredLogger;
  readonly correlationId?: string;
  readonly now?: Date;
}

export interface ContactAnalyticsLinkResult {
  readonly analyticsSessionId: string | null;
  readonly guestSessionId: string | null;
  readonly linkMethod: ContactLinkMethod;
  readonly spoofRejected: boolean;
}

const SESSION_MATCH_WINDOW_MINUTES = 30;

function emitLinkBranch(
  branch: ContactLinkMethod,
  correlationId?: string,
  logger?: SsrStructuredLogger,
): void {
  if (!logger) return;
  logger.info(
    {
      seam_type: 'RULE_DIVERGENCE',
      event: 'analytics.contact.link_method_branch',
      branch,
      ...(correlationId ? { correlationId } : {}),
    },
    'Contact analytics link method resolved',
  );
}

type UpdateExecutor = Pick<AppDatabase, 'update'>;
type QueryExecutor = Pick<AppDatabase, 'execute'>;

async function findRecentPortalSessionByVisitorHash(
  executor: QueryExecutor,
  currentVisitorHash: string,
  priorVisitorHash: string | null,
  nowIso: string,
): Promise<{ readonly sessionId: string; readonly guestSessionId: string | null } | null> {
  const result = priorVisitorHash
    ? await executor.execute(sql`
        SELECT session_id, guest_session_id
        FROM analytics_sessions
        WHERE app = 'portal'
          AND visitor_hash IN (${currentVisitorHash}, ${priorVisitorHash})
          AND COALESCE(last_seen_at, started_at) >= ${nowIso}::timestamptz - (${SESSION_MATCH_WINDOW_MINUTES} * interval '1 minute')
        ORDER BY COALESCE(last_seen_at, started_at) DESC, started_at DESC
        LIMIT 1
      `)
    : await executor.execute(sql`
        SELECT session_id, guest_session_id
        FROM analytics_sessions
        WHERE app = 'portal'
          AND visitor_hash = ${currentVisitorHash}
          AND started_at >= date_trunc('day', ${nowIso}::timestamptz AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
          AND COALESCE(last_seen_at, started_at) >= ${nowIso}::timestamptz - (${SESSION_MATCH_WINDOW_MINUTES} * interval '1 minute')
        ORDER BY COALESCE(last_seen_at, started_at) DESC, started_at DESC
        LIMIT 1
      `);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (typeof row?.['session_id'] !== 'string') return null;
  return {
    sessionId: row['session_id'],
    guestSessionId: typeof row['guest_session_id'] === 'string' ? row['guest_session_id'] : null,
  };
}

async function stampGuestSessionOnAnalyticsSession(
  db: UpdateExecutor,
  sessionId: string,
  guestSessionId: string | null,
  now: Date,
): Promise<void> {
  if (!guestSessionId) return;
  await db
    .update(schema.analyticsSessions)
    .set({
      guestSessionId: sql`COALESCE(${schema.analyticsSessions.guestSessionId}, ${guestSessionId})`,
      lastSeenAt: sql`GREATEST(COALESCE(${schema.analyticsSessions.lastSeenAt}, ${schema.analyticsSessions.startedAt}), ${now.toISOString()}::timestamptz)`,
    })
    .where(eq(schema.analyticsSessions.sessionId, sessionId));
}

export async function recordContactSubmittedAnalyticsEvent(
  db: AppDatabase,
  analyticsSessionId: string | null | undefined,
  now = new Date(),
  logger?: SsrStructuredLogger,
): Promise<void> {
  const sessionId = analyticsSessionId?.trim();
  if (!sessionId) return;
  try {
    await db.insert(schema.analyticsEvents).values({
      sessionId,
      type: 'interaction',
      name: 'contact_submitted',
      path: '/contact',
      value: null,
      metadataJson: { app: 'portal' },
      createdAt: now,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'contact_analytics_event_failed';
    logger?.warn(
      {
        seam_type: 'BOUNDARY_FAULT',
        event: 'portal.contact.analytics_event_insert_failed',
        detail,
      },
      'Failed to record contact_submitted analytics event',
    );
  }
}

export async function resolveOrCreateContactAnalyticsSession(
  db: AppDatabase,
  request: Request,
  options: ContactAnalyticsLinkOptions = {},
): Promise<ContactAnalyticsLinkResult> {
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();
  const normalizedGuest = options.guestSessionId?.trim() || null;
  const candidateSessionId = options.candidateSessionId?.trim() || null;
  let spoofRejected = false;

  try {
    const clientIp = resolveAnalyticsClientIp(request);
    const userAgent = request.headers.get('user-agent') ?? '';
    const baseSalt = env['ANALYTICS_DAILY_SALT']?.trim() || 'dev-only';
    const currentSalt = buildDailyAnalyticsSalt(baseSalt, now);
    const currentIpHash = hashVisitorIp(clientIp, currentSalt);
    const currentVisitorHash = hashVisitorIdentity(clientIp, userAgent, currentSalt);

    const withinMidnightGrace = isWithinUtcMidnightGraceWindow(now, SESSION_MATCH_WINDOW_MINUTES);
    const priorSalt = withinMidnightGrace ? buildPreviousUtcDayAnalyticsSalt(baseSalt, now) : null;
    const priorIpHash = priorSalt ? hashVisitorIp(clientIp, priorSalt) : null;
    const priorVisitorHash = priorSalt ? hashVisitorIdentity(clientIp, userAgent, priorSalt) : null;

    if (candidateSessionId) {
      const [row] = await db
        .select({
          sessionId: schema.analyticsSessions.sessionId,
          app: schema.analyticsSessions.app,
          visitorHash: schema.analyticsSessions.visitorHash,
          ipHash: schema.analyticsSessions.ipHash,
          guestSessionId: schema.analyticsSessions.guestSessionId,
        })
        .from(schema.analyticsSessions)
        .where(eq(schema.analyticsSessions.sessionId, candidateSessionId))
        .limit(1);

      const ownershipMatches =
        Boolean(row) &&
        row?.app === 'portal' &&
        (row.visitorHash === currentVisitorHash ||
          (priorVisitorHash !== null && row.visitorHash === priorVisitorHash) ||
          row.ipHash === currentIpHash ||
          (priorIpHash !== null && row.ipHash === priorIpHash) ||
          (normalizedGuest !== null && row.guestSessionId === normalizedGuest));

      if (row && ownershipMatches) {
        await stampGuestSessionOnAnalyticsSession(db, row.sessionId, normalizedGuest, now);
        emitLinkBranch('verified_client_session', options.correlationId, options.logger);
        return {
          analyticsSessionId: row.sessionId,
          guestSessionId: normalizedGuest ?? row.guestSessionId,
          linkMethod: 'verified_client_session',
          spoofRejected: false,
        };
      }

      spoofRejected = true;
      const reason = !row
        ? 'missing_session'
        : row.app !== 'portal'
          ? 'non_portal_session'
          : 'ownership_mismatch';
      const spoofPayload = {
        seam_type: 'UNSOUND_CONDITION',
        event: 'portal.contact.analytics_session_spoof_rejected',
        reason,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      };
      if (options.logger) {
        options.logger.warn(spoofPayload, 'Rejected unverified contact analyticsSessionId');
      } else {
        console.warn(JSON.stringify(spoofPayload));
      }
    }

    const nowIso = now.toISOString();
    const matchedVisitor = await findRecentPortalSessionByVisitorHash(
      db,
      currentVisitorHash,
      priorVisitorHash,
      nowIso,
    );
    if (matchedVisitor) {
      await stampGuestSessionOnAnalyticsSession(db, matchedVisitor.sessionId, normalizedGuest, now);
      emitLinkBranch('visitor_hash_match', options.correlationId, options.logger);
      return {
        analyticsSessionId: matchedVisitor.sessionId,
        guestSessionId: normalizedGuest ?? matchedVisitor.guestSessionId,
        linkMethod: 'visitor_hash_match',
        spoofRejected,
      };
    }

    if (normalizedGuest) {
      const guestMatch = await db.execute(sql`
        SELECT session_id
        FROM analytics_sessions
        WHERE app = 'portal'
          AND guest_session_id = ${normalizedGuest}
        ORDER BY COALESCE(last_seen_at, started_at) DESC, started_at DESC
        LIMIT 1
      `);
      const matchedGuestRow = guestMatch.rows[0] as Record<string, unknown> | undefined;
      if (typeof matchedGuestRow?.['session_id'] === 'string') {
        emitLinkBranch('guest_session_match', options.correlationId, options.logger);
        return {
          analyticsSessionId: matchedGuestRow['session_id'],
          guestSessionId: normalizedGuest,
          linkMethod: 'guest_session_match',
          spoofRejected,
        };
      }
    }

    const fallbackMeta = await enrichAnalyticsRequestMetadata(request, {
      app: 'portal',
      guestSessionId: normalizedGuest,
      landingPath: '/contact',
      ...(options.env ? { env: options.env } : {}),
      ...(options.geoIpDir ? { geoIpDir: options.geoIpDir } : {}),
      ...(options.logger ? { logger: options.logger } : {}),
      now,
    });
    const resolved = await db.transaction(async tx => {
      if (fallbackMeta.visitorHash) {
        await acquireAnalyticsVisitorLock(tx, 'portal', fallbackMeta.visitorHash);
        const racedVisitor = await findRecentPortalSessionByVisitorHash(
          tx,
          currentVisitorHash,
          priorVisitorHash,
          nowIso,
        );
        if (racedVisitor) {
          await stampGuestSessionOnAnalyticsSession(
            tx,
            racedVisitor.sessionId,
            normalizedGuest,
            now,
          );
          return {
            analyticsSessionId: racedVisitor.sessionId,
            guestSessionId: normalizedGuest ?? racedVisitor.guestSessionId,
            linkMethod: 'visitor_hash_match' as const,
          };
        }
      }
      const fallbackSessionId = `sess_${randomUUID()}`;
      await upsertAnalyticsSessionRow(tx, fallbackSessionId, fallbackMeta, now);
      return {
        analyticsSessionId: fallbackSessionId,
        guestSessionId: normalizedGuest,
        linkMethod: 'fallback_upserted' as const,
      };
    });
    emitLinkBranch(resolved.linkMethod, options.correlationId, options.logger);
    return {
      analyticsSessionId: resolved.analyticsSessionId,
      guestSessionId: resolved.guestSessionId,
      linkMethod: resolved.linkMethod,
      spoofRejected,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'contact_analytics_link_failed';
    const faultPayload = {
      seam_type: 'BOUNDARY_FAULT',
      event: 'portal.contact.analytics_link_failed',
      ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      detail,
    };
    if (options.logger) {
      options.logger.warn(faultPayload, 'Contact analytics session link failed open');
    } else {
      console.warn(JSON.stringify(faultPayload));
    }
    emitLinkBranch('fail_open_null', options.correlationId, options.logger);
    return {
      analyticsSessionId: null,
      guestSessionId: normalizedGuest,
      linkMethod: 'fail_open_null',
      spoofRejected,
    };
  }
}
