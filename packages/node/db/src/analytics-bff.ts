import { AnalyticsBatchSchema } from '@aklapper/core';
import { buildDailyAnalyticsSalt, hashVisitorIp } from '@aklapper/node-runtime/auth';
import {
  extractRightmostForwardedIp,
  proxyJson,
  signInternalAuthToken,
} from '@aklapper/node-runtime/http';

import { type AppDatabase, getSharedDb } from './client.ts';
import { ingestAnalyticsBatch, type IngestAnalyticsResult } from './queries.ts';

export interface AnalyticsBffOptions {
  db?: AppDatabase;
  upstreamUrl?: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}

/**
 * Shared same-origin BFF handler for POST /api/analytics/ingest across Portal and Admin.
 *
 * - Forwards to ANALYTICS_API_URL when configured.
 * - Persists directly to PostgreSQL 19 via @aklapper/db when ANALYTICS_API_URL is unset.
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
  const upstreamUrl = (options.upstreamUrl ?? env['ANALYTICS_API_URL'])?.trim();
  const country = request.headers.get('x-cloud-country')?.trim() || undefined;
  const region = request.headers.get('x-cloud-region')?.trim() || undefined;
  const clientIp = extractRightmostForwardedIp(
    request.headers.get('x-forwarded-for'),
    request.headers.get('x-real-ip'),
    '127.0.0.1',
  );

  if (upstreamUrl) {
    const forwardHeaders: Record<string, string> = {
      'content-type': 'application/json',
      'x-forwarded-for': clientIp,
    };
    const internalSecret = env['INTERNAL_AUTH_SECRET']?.trim();
    const isProd = (env['NODE_ENV'] ?? process.env['NODE_ENV']) === 'production';
    if (internalSecret || !isProd) {
      forwardHeaders['x-internal-client-ip'] = signInternalAuthToken({
        role: 'service',
        subject: `client-ip:${clientIp}`,
        secret: internalSecret,
        ttlSeconds: 60,
      });
    }
    if (country) forwardHeaders['x-cloud-country'] = country;
    if (region) forwardHeaders['x-cloud-region'] = region;

    const result = await proxyJson<IngestAnalyticsResult>({
      baseUrl: upstreamUrl,
      path: '/v1/analytics/ingest',
      method: 'POST',
      headers: forwardHeaders,
      body: parsed.data,
      oidcAuth: 'auto',
      env,
      fetchImpl: options.fetchImpl,
    });

    if (result.ok && result.data) {
      return Response.json(result.data, { status: result.status });
    }
    return Response.json(result.data ?? { error: result.error ?? 'ANALYTICS_UPSTREAM_ERROR' }, {
      status: result.status,
    });
  }

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
