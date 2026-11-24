import { AnalyticsBatchSchema } from '@aklapper/core';
import { type AppDatabase, getSharedDb, ingestAnalyticsBatch } from '@aklapper/db';
import { buildDailyAnalyticsSalt, hashVisitorIp } from '@aklapper/node-runtime/auth';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';

export { hashVisitorIp };

export interface BuildAnalyticsServerOptions {
  db?: AppDatabase;
  env?: Record<string, string | undefined>;
  ingest?: typeof ingestAnalyticsBatch;
}

function getHeader(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) return value[0]?.trim() || null;
  return null;
}

export async function buildAnalyticsServer(
  options: BuildAnalyticsServerOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: process.env['NODE_ENV'] !== 'test' });
  const env = options.env ?? process.env;
  const ingest = options.ingest ?? ingestAnalyticsBatch;

  await app.register(helmet);
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

  app.get('/healthz', async () => ({ status: 'ok', service: 'node-api-analytics' }));

  app.post('/v1/analytics/ingest', async (request, reply) => {
    const parsed = AnalyticsBatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'INVALID_ANALYTICS_BATCH' });
    }

    const salt = buildDailyAnalyticsSalt(env['ANALYTICS_DAILY_SALT']?.trim() || 'dev-only');
    const forwardedFor = getHeader(request.headers['x-forwarded-for']);
    const clientIp = forwardedFor?.split(',')[0]?.trim() || request.ip;
    const ipHash = hashVisitorIp(clientIp, salt);
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
