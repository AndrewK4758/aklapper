import { type AnalyticsApp, AnalyticsBatchSchema } from '@aklapper/core';
import type { SsrStructuredLogger } from '@aklapper/node-runtime/ssr/stream';

import { enrichAnalyticsRequestMetadata } from './analytics-ingest.ts';
import { type AppDatabase, getSharedDb } from './client.ts';
import { ingestAnalyticsBatch } from './queries.ts';

export interface AnalyticsBffOptions {
  db?: AppDatabase;
  env?: Record<string, string | undefined>;
  app?: AnalyticsApp;
  guestSessionId?: string | null;
  geoIpDir?: string;
  logger?: SsrStructuredLogger;
  now?: Date;
}

/**
 * Shared same-origin BFF handler for POST /api/analytics/ingest across Portal and Admin. Persists
 * directly to PostgreSQL 19 via @aklapper/db with server-authoritative app tagging and GeoLite2
 * enrichment.
 */
export async function handleAnalyticsIngestRequest(
  request: Request,
  options: AnalyticsBffOptions = {},
): Promise<Response> {
  if (request.method.toUpperCase() !== 'POST') {
    return Response.json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'INVALID_ANALYTICS_BATCH' }, { status: 400 });
  }

  const parsed = AnalyticsBatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_ANALYTICS_BATCH' }, { status: 400 });
  }

  const db = options.db ?? getSharedDb();
  const meta = await enrichAnalyticsRequestMetadata(request, {
    app: options.app ?? 'portal',
    guestSessionId: options.guestSessionId,
    rawReferrer: parsed.data.referrer ?? request.headers.get('referer'),
    landingPath: parsed.data.landingPath ?? parsed.data.events[0]?.path ?? null,
    refParam: parsed.data.refParam ?? null,
    utmSource: parsed.data.utmSource ?? null,
    utmMedium: parsed.data.utmMedium ?? null,
    utmCampaign: parsed.data.utmCampaign ?? null,
    utmContent: parsed.data.utmContent ?? null,
    ...(options.env ? { env: options.env } : {}),
    ...(options.geoIpDir ? { geoIpDir: options.geoIpDir } : {}),
    ...(options.logger ? { logger: options.logger } : {}),
    ...(options.now ? { now: options.now } : {}),
  });

  const persisted = await ingestAnalyticsBatch(db, parsed.data, meta);
  return Response.json(persisted, { status: 202 });
}
