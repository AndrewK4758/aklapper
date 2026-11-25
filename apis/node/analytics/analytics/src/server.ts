import type { Writable } from 'node:stream';

import { AnalyticsBatchSchema } from '@aklapper/core';
import { type AppDatabase, getSharedDb, ingestAnalyticsBatch } from '@aklapper/db';
import {
  AUTH_LOG_REDACT_PATHS,
  buildDailyAnalyticsSalt,
  hashVisitorIp,
} from '@aklapper/node-runtime/auth';
import { resolveTrustedClientIpWithDetail, SINGLE_PROXY_HOP } from '@aklapper/node-runtime/http';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';

export { hashVisitorIp };

export interface BuildAnalyticsServerOptions {
  db?: AppDatabase;
  env?: Record<string, string | undefined>;
  ingest?: typeof ingestAnalyticsBatch;
  loggerStream?: Writable;
}

function getHeader(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) return value[0]?.trim() || null;
  return null;
}

export async function buildAnalyticsServer(
  options: BuildAnalyticsServerOptions = {},
): Promise<FastifyInstance> {
  const loggerConfig = options.loggerStream
    ? {
        stream: options.loggerStream,
        redact: { paths: [...AUTH_LOG_REDACT_PATHS], censor: '[REDACTED]' },
      }
    : process.env['NODE_ENV'] === 'test'
      ? false
      : {
          redact: { paths: [...AUTH_LOG_REDACT_PATHS], censor: '[REDACTED]' },
        };

  const app = Fastify({
    trustProxy: SINGLE_PROXY_HOP,
    logger: loggerConfig,
  });
  const env = options.env ?? process.env;
  const ingest = options.ingest ?? ingestAnalyticsBatch;

  await app.register(helmet);
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    keyGenerator: request => resolveTrustedClientIpWithDetail(request, env).ip,
  });

  app.get('/healthz', async () => ({ status: 'ok', service: 'node-api-analytics' }));

  app.post('/v1/analytics/ingest', async (request, reply) => {
    const parsed = AnalyticsBatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'INVALID_ANALYTICS_BATCH' });
    }

    const salt = buildDailyAnalyticsSalt(env['ANALYTICS_DAILY_SALT']?.trim() || 'dev-only');
    const resolvedIp = resolveTrustedClientIpWithDetail(request, env);
    if (resolvedIp.untrustedProxySignal) {
      request.log.warn({
        event: 'analytics.ingest.proxy_hop_untrusted',
        seam: 'UNSOUND_CONDITION',
        resolvedIp: resolvedIp.ip,
      });
    }
    const ipHash = hashVisitorIp(resolvedIp.ip, salt);
    const country = getHeader(request.headers['x-cloud-country']);
    const region = getHeader(request.headers['x-cloud-region']);

    const db = options.db ?? getSharedDb();
    const persisted = await ingest(db, parsed.data, {
      ipHash,
      country,
      region,
    });

    return reply.code(202).send(persisted);
  });

  return app;
}
