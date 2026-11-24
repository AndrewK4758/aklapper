import type { AppDatabase } from '@aklapper/db';
import { dispatchAuthAction } from '@aklapper/db/auth';
import { isSecureRequest } from '@aklapper/node-runtime/auth';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';

export interface BuildAuthServerOptions {
  db?: AppDatabase;
  env?: Record<string, string | undefined>;
  dispatch?: typeof dispatchAuthAction;
}

function getSingleHeader(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

export async function buildAuthServer(
  options: BuildAuthServerOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: process.env['NODE_ENV'] !== 'test' });
  const dispatch = options.dispatch ?? dispatchAuthAction;

  await app.register(helmet);
  await app.register(cookie);
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

  app.get('/healthz', async () => ({
    status: 'ok',
    service: 'node-api-auth',
    methods: ['passkey', 'totp-2fa', 'guest'],
  }));

  const registerRoute = (method: 'GET' | 'POST', action: string) => {
    const handler = async (request: FastifyRequest, reply: FastifyReply) => {
      const forwardedProto = getSingleHeader(request.headers['x-forwarded-proto']);
      const protocol = request.protocol === 'https' ? 'https:' : 'http:';
      const result = await dispatch(
        {
          method,
          action,
          cookieHeader: getSingleHeader(request.headers.cookie),
          bootstrapTokenHeader: getSingleHeader(request.headers['x-bootstrap-token']),
          originHeader: getSingleHeader(request.headers.origin),
          isSecure: isSecureRequest(`${protocol}//${request.hostname}`, forwardedProto),
          body: request.body,
        },
        {
          db: options.db,
          env: options.env,
        },
      );

      if (result.cookies && result.cookies.length > 0) {
        reply.header('set-cookie', result.cookies);
      }
      return reply.code(result.status).send(result.body);
    };

    if (method === 'GET') {
      app.get(`/v1/auth/${action}`, handler);
    } else {
      app.post(`/v1/auth/${action}`, handler);
    }
  };

  registerRoute('POST', 'guest');
  registerRoute('POST', 'passkey/register/options');
  registerRoute('POST', 'passkey/register/verify');
  registerRoute('POST', 'passkey/login/options');
  registerRoute('POST', 'passkey/login/verify');
  registerRoute('POST', 'totp/enroll');
  registerRoute('POST', 'totp/verify');
  registerRoute('POST', 'totp/disable');
  registerRoute('GET', 'session');
  registerRoute('POST', 'logout');

  return app;
}
