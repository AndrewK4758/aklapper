import { AnalyticsBatchSchema } from '@aklapper/core';
import { buildDailyAnalyticsSalt, hashVisitorIp } from '@aklapper/node-runtime/auth';
import { extractRightmostForwardedIp } from '@aklapper/node-runtime/http';

import { type AppDatabase, getSharedDb } from './client.ts';
import { ingestAnalyticsBatch } from './queries.ts';

export interface AnalyticsBffOptions {
  db?: AppDatabase;
  env?: Record<string, string | undefined>;
}

/**
 * Shared same-origin BFF handler for POST /api/analytics/ingest across Portal and Admin. Persists
 * directly to PostgreSQL 19 via @aklapper/db.
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

  const env = options.env ?? process.env;
  const country = request.headers.get('x-cloud-country')?.trim() || undefined;
  const region = request.headers.get('x-cloud-region')?.trim() || undefined;
  const clientIp = extractRightmostForwardedIp(
    request.headers.get('x-forwarded-for'),
    request.headers.get('x-real-ip'),
    '127.0.0.1',
  );

  const db = options.db ?? getSharedDb();
  const salt = buildDailyAnalyticsSalt(env['ANALYTICS_DAILY_SALT']?.trim() || 'dev-only');
  const ipHash = hashVisitorIp(clientIp, salt);
  const persisted = await ingestAnalyticsBatch(db, parsed.data, {
    ipHash,
    country: country ?? null,
    region: region ?? null,
  });

  return Response.json(persisted, { status: 202 });
}
