import { randomUUID } from 'node:crypto';

import { normalizeLandingPath } from '@aklapper/node-runtime/analytics';
import type { SsrStructuredLogger } from '@aklapper/node-runtime/ssr/stream';

import {
  acquireAnalyticsVisitorLock,
  enrichAnalyticsRequestMetadata,
  findActiveSameUtcDaySessionId,
  ingestAnalyticsBatch,
  type IngestAnalyticsResult,
  upsertAnalyticsSessionRow,
} from './analytics-ingest.ts';
import type { AppDatabase } from './client.ts';

export interface CapturePortalSsrHitOptions {
  readonly pathname?: string;
  readonly guestSessionId?: string | null;
  readonly env?: Record<string, string | undefined>;
  readonly geoIpDir?: string;
  readonly logger?: SsrStructuredLogger;
  readonly correlationId?: string;
  readonly timeoutMs?: number;
  readonly now?: Date;
}

const DEFAULT_SSR_CAPTURE_TIMEOUT_MS = 1_500;

export async function capturePortalSsrHit(
  db: AppDatabase,
  request: Request,
  options: CapturePortalSsrHitOptions = {},
): Promise<IngestAnalyticsResult | null> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_SSR_CAPTURE_TIMEOUT_MS;
  const now = options.now ?? new Date();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const work = async (): Promise<IngestAnalyticsResult> => {
    const meta = await enrichAnalyticsRequestMetadata(request, {
      app: 'portal',
      guestSessionId: options.guestSessionId,
      ...(options.pathname ? { landingPath: options.pathname } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.geoIpDir ? { geoIpDir: options.geoIpDir } : {}),
      ...(options.logger ? { logger: options.logger } : {}),
      now,
    });
    const path = normalizeLandingPath(options.pathname ?? meta.landingPath ?? '/');
    return ingestAnalyticsBatch(
      db,
      {
        sessionId: `sess_${randomUUID()}`,
        landingPath: path,
        events: [
          {
            type: 'page_view',
            name: 'portal_page_view',
            path,
            metadata: { app: 'portal', navigation: 'ssr' },
            timestamp: now.toISOString(),
          },
        ],
      },
      meta,
    );
  };

  try {
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error(`SSR analytics capture timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    });
    return await Promise.race([work(), timeoutPromise]);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'ssr_capture_failed';
    const payload = {
      seam_type: 'BOUNDARY_FAULT',
      event: 'portal.analytics.ssr_capture_failed',
      ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      detail,
    };
    if (options.logger) {
      options.logger.warn(payload, 'Non-blocking SSR analytics capture failed');
    } else {
      console.warn(JSON.stringify(payload));
    }
    return null;
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
}

export async function bindGuestSessionToAnalyticsSession(
  db: AppDatabase,
  request: Request,
  guestSessionId: string | null | undefined,
  options: {
    readonly env?: Record<string, string | undefined>;
    readonly geoIpDir?: string;
    readonly logger?: SsrStructuredLogger;
    readonly now?: Date;
  } = {},
): Promise<string | null> {
  const normalizedGuest = guestSessionId?.trim();
  if (!normalizedGuest) return null;

  try {
    const now = options.now ?? new Date();
    const meta = await enrichAnalyticsRequestMetadata(request, {
      app: 'portal',
      guestSessionId: normalizedGuest,
      ...(options.env ? { env: options.env } : {}),
      ...(options.geoIpDir ? { geoIpDir: options.geoIpDir } : {}),
      ...(options.logger ? { logger: options.logger } : {}),
      now,
    });
    const visitorHash = meta.visitorHash;
    if (!visitorHash) return null;

    return await db.transaction(async tx => {
      await acquireAnalyticsVisitorLock(tx, 'portal', visitorHash);
      const existingSessionId = await findActiveSameUtcDaySessionId(tx, 'portal', visitorHash, now);
      const targetSessionId = existingSessionId ?? `sess_${randomUUID()}`;
      await upsertAnalyticsSessionRow(tx, targetSessionId, meta, now);
      return targetSessionId;
    });
  } catch {
    return null;
  }
}
