import { isIP } from 'node:net';
import type { Writable } from 'node:stream';

import type { AppDatabase } from '@aklapper/db';
import { dispatchAuthAction } from '@aklapper/db/auth';
import { AUTH_LOG_REDACT_PATHS, isSecureRequest } from '@aklapper/node-runtime/auth';
import { verifyInternalAuthToken } from '@aklapper/node-runtime/http';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';

export interface BuildAuthServerOptions {
  db?: AppDatabase;
  env?: Record<string, string | undefined>;
  dispatch?: typeof dispatchAuthAction;
  loggerStream?: Writable;
}

const INTERNAL_CLIENT_IP_HEADER = 'x-internal-client-ip';
const CLIENT_IP_SUBJECT_PREFIX = 'client-ip:';
const SINGLE_PROXY_HOP = (_address: string, hop: number): boolean => hop === 0;

function getSingleHeader(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

function resolveTrustedClientIp(
  request: FastifyRequest,
  env: Record<string, string | undefined> = process.env,
): string {
  const token = getSingleHeader(request.headers[INTERNAL_CLIENT_IP_HEADER]);
  const internalSecret = env['INTERNAL_AUTH_SECRET']?.trim();
  const isProd = (env['NODE_ENV'] ?? process.env['NODE_ENV']) === 'production';
  if (token && (internalSecret || !isProd)) {
    const claims = verifyInternalAuthToken(token, internalSecret);
    if (claims?.role === 'service' && claims.sub.startsWith(CLIENT_IP_SUBJECT_PREFIX)) {
      const verifiedIp = claims.sub.slice(CLIENT_IP_SUBJECT_PREFIX.length).trim();
      if (verifiedIp.length > 0 && isIP(verifiedIp) !== 0) {
        return verifiedIp;
      }
    }
  }
  return request.ip;
}

export async function buildAuthServer(
  options: BuildAuthServerOptions = {},
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
  const dispatch = options.dispatch ?? dispatchAuthAction;

  await app.register(helmet);
  await app.register(cookie);
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    keyGenerator: request => resolveTrustedClientIp(request, options.env),
    errorResponseBuilder: (_request, context) => ({
      statusCode: context.statusCode,
      error: 'RATE_LIMITED',
      message: `Too many requests. Retry in ${context.after}.`,
    }),
  });

  app.get('/healthz', async () => ({
    status: 'ok',
    service: 'node-api-auth',
    methods: ['password', 'passkey', 'totp-2fa', 'guest'],
  }));

  const registerRoute = (
    method: 'GET' | 'POST',
    action: string,
    routeRateLimit?: { max: number; timeWindow: string },
  ) => {
    const handler = async (request: FastifyRequest, reply: FastifyReply) => {
      const forwardedProto = getSingleHeader(request.headers['x-forwarded-proto']);
      const protocol = request.protocol === 'https' ? 'https:' : 'http:';
      const result = await dispatch(
        {
          method,
          action,
          cookieHeader: getSingleHeader(request.headers.cookie),
          clientIp: resolveTrustedClientIp(request, options.env),
          originHeader: getSingleHeader(request.headers.origin),
          isSecure: isSecureRequest(`${protocol}//${request.hostname}`, forwardedProto),
          body: request.body,
        },
        {
          db: options.db,
          env: options.env,
          onAuthEvent: evt => request.log.info(evt),
        },
      );

      if (result.headers) {
        reply.headers(result.headers);
      }
      if (result.cookies && result.cookies.length > 0) {
        reply.header('set-cookie', result.cookies);
      }
      return reply.code(result.status).send(result.body);
    };

    const routeOptions = routeRateLimit ? { config: { rateLimit: routeRateLimit } } : {};
    if (method === 'GET') {
      app.get(`/v1/auth/${action}`, routeOptions, handler);
    } else {
      app.post(`/v1/auth/${action}`, routeOptions, handler);
    }
  };

  registerRoute('POST', 'guest');
  registerRoute('POST', 'password/login', { max: 20, timeWindow: '1 minute' });
  registerRoute('POST', 'passkey/register/options');
  registerRoute('POST', 'passkey/register/verify');
  registerRoute('POST', 'passkey/login/options');
  registerRoute('POST', 'passkey/login/verify');
  registerRoute('POST', 'totp/enroll');
  registerRoute('POST', 'totp/verify', { max: 20, timeWindow: '1 minute' });
  registerRoute('POST', 'totp/disable');
  registerRoute('GET', 'session');
  registerRoute('POST', 'logout');

  return app;
}
