import { randomUUID } from 'node:crypto';

import { AuthSessionSchema } from '@aklapper/core';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';

export async function buildAuthServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: process.env['NODE_ENV'] !== 'test' });
  await app.register(helmet);
  await app.register(cookie);
  await app.register(rateLimit, { max: 60, timeWindow: '1 minute' });

  app.get('/healthz', async () => ({
    status: 'ok',
    service: 'node-api-auth',
    methods: ['passkey', 'guest', 'totp-2fa-ready'],
  }));

  app.post('/v1/auth/guest', async (_request, reply) => {
    const session = AuthSessionSchema.parse({
      sessionId: randomUUID(),
      role: 'guest',
      handle: 'guest',
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    });
    return reply.code(201).send(session);
  });

  app.post('/v1/auth/passkey/options', async (_request, reply) => {
    return reply.code(501).send({
      error: 'PASSKEY_DB_NOT_BOUND',
      message:
        'WebAuthn challenge generation binds in feature worktree once Postgres 19 credentials are configured.',
    });
  });

  return app;
}
