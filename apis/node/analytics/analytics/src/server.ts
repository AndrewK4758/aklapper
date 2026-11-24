import { createHash } from 'node:crypto';

import { AnalyticsBatchSchema } from '@aklapper/core';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';

export function hashVisitorIp(ip: string, dailySalt: string): string {
  return createHash('sha256').update(`${dailySalt}:${ip}`).digest('hex').slice(0, 24);
}

export async function buildAnalyticsServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: process.env['NODE_ENV'] !== 'test' });
  await app.register(helmet);
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

  app.get('/healthz', async () => ({ status: 'ok', service: 'node-api-analytics' }));

  app.post('/v1/analytics/ingest', async (request, reply) => {
    const parsed = AnalyticsBatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'INVALID_ANALYTICS_BATCH' });
    }
    const salt = new Date().toISOString().slice(0, 10);
    const ipHash = hashVisitorIp(request.ip, salt);
    return reply.code(202).send({
      accepted: parsed.data.events.length,
      sessionId: parsed.data.sessionId,
      ipHash,
    });
  });

  return app;
}
