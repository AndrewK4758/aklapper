import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import { pathToFileURL } from 'node:url';

import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { createRequestHandler, type ServerBuild } from 'react-router';

import { AUTH_LOG_REDACT_PATHS } from './auth.ts';
import { loadWorkspaceEnv } from './env.ts';

export interface SsrServerOptions {
  serviceName: string;
  buildDir: string;
  port: number;
  host: string;
}

export interface SsrServerInstance {
  app: FastifyInstance;
  start: () => Promise<string>;
}

const BODILESS_STATUS_CODES = new Set([204, 205, 304]);
const SINGLE_PROXY_HOP = (_address: string, hop: number): boolean => hop === 0;

function normalizeAdminAuthPath(rawUrl: string): string | null {
  let current: string;
  try {
    current = new URL(rawUrl, 'http://localhost').pathname;
  } catch {
    return null;
  }
  for (let pass = 0; pass < 3; pass += 1) {
    if (!current.includes('%')) break;
    let next: string;
    try {
      next = decodeURIComponent(current);
    } catch {
      return null;
    }
    if (next === current) break;
    current = next;
  }
  if (current.includes('%')) {
    return null;
  }
  const collapsed = current.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  const prefixed = collapsed.startsWith('/') ? collapsed : `/${collapsed}`;
  try {
    const resolved = new URL(prefixed, 'http://localhost').pathname
      .replace(/\/+$/, '')
      .toLowerCase();
    return resolved || '/';
  } catch {
    return null;
  }
}

function isRawAuthApiTarget(rawUrl: string): boolean {
  let candidatePath: string;
  try {
    candidatePath = new URL(rawUrl, 'http://localhost').pathname;
  } catch {
    candidatePath = rawUrl.split(/[?#]/, 1)[0] ?? '';
  }
  let decoded = candidatePath;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decoded.replace(/%[0-9a-fA-F]{2}/g, seq => {
      try {
        return decodeURIComponent(seq);
      } catch {
        return seq;
      }
    });
    if (next === decoded) break;
    decoded = next;
  }
  const normalized = decoded
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .toLowerCase();
  return normalized.startsWith('/api/auth/') || normalized === '/api/auth';
}

function collectResponseHeaders(webHeaders: Headers): Record<string, string | string[]> {
  const responseHeaders: Record<string, string | string[]> = {};
  webHeaders.forEach((value, key) => {
    const existing = responseHeaders[key];
    if (existing === undefined) {
      responseHeaders[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      responseHeaders[key] = [existing, value];
    }
  });
  return responseHeaders;
}

export async function createSsrServer(options: SsrServerOptions): Promise<SsrServerInstance> {
  loadWorkspaceEnv({ startDir: options.buildDir });
  const { serviceName, buildDir, port, host } = options;
  const app = Fastify({
    trustProxy: SINGLE_PROXY_HOP,
    logger: {
      redact: {
        paths: [...AUTH_LOG_REDACT_PATHS],
        censor: '[REDACTED]',
      },
    },
    bodyLimit: 10 * 1024 * 1024,
  });

  const rawBufferParser = (
    _request: unknown,
    body: Buffer,
    done: (err: Error | null, body?: Buffer) => void,
  ) => {
    done(null, body);
  };

  app.addContentTypeParser(/^multipart\/form-data/i, { parseAs: 'buffer' }, rawBufferParser);
  app.addContentTypeParser(
    ['application/x-www-form-urlencoded', 'application/json'],
    { parseAs: 'buffer' },
    rawBufferParser,
  );

  await app.register(fastifyHelmet, { contentSecurityPolicy: false });
  await app.register(fastifyCookie);
  await app.register(fastifyRateLimit, {
    global: false,
    errorResponseBuilder: (_request, context) => ({
      statusCode: context.statusCode,
      error: 'RATE_LIMITED',
      message: `Too many requests. Retry in ${context.after}.`,
    }),
  });

  if (serviceName === 'admin-ssr') {
    const passwordLoginLimiter = app.rateLimit({ max: 20, timeWindow: '1 minute' });
    const totpVerifyLimiter = app.rateLimit({ max: 20, timeWindow: '1 minute' });
    app.addHook('onRequest', async (request, reply) => {
      if (request.method !== 'POST') return;
      const pathname = normalizeAdminAuthPath(request.url);
      if (pathname === null) {
        if (isRawAuthApiTarget(request.url)) {
          return reply.code(400).send({
            statusCode: 400,
            error: 'INVALID_REQUEST',
            message: 'Malformed request URL',
          });
        }
        return;
      }
      if (pathname === '/api/auth/password/login') {
        await passwordLoginLimiter.call(app, request, reply);
      } else if (pathname === '/api/auth/totp/verify') {
        await totpVerifyLimiter.call(app, request, reply);
      }
    });
  }

  const servePrerenderedStatic = process.env['SERVE_PRERENDERED_STATIC'] === 'true';

  await app.register(fastifyStatic, {
    root: resolve(buildDir, 'client'),
    prefix: '/',
    wildcard: false,
    index: servePrerenderedStatic ? 'index.html' : false,
    globIgnore: servePrerenderedStatic ? [] : ['**/*.html', '**/*.data'],
  });

  app.get('/healthz', async () => ({ status: 'ok', service: serviceName }));

  const serverBuildUrl = pathToFileURL(resolve(buildDir, 'server', 'index.js')).href;
  const serverBuild = (await import(/* @vite-ignore */ serverBuildUrl)) as ServerBuild;
  const handleRequest = createRequestHandler(serverBuild, process.env['NODE_ENV'] ?? 'production');

  app.all('*', async (request, reply) => {
    const origin = `${request.protocol}://${request.headers.host ?? `localhost:${port}`}`;
    const url = new URL(request.url, origin);
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (Array.isArray(value)) {
        for (const item of value) headers.append(key, item);
      } else if (typeof value === 'string') {
        headers.set(key, value);
      }
    }
    if (request.ip) {
      headers.set('x-forwarded-for', request.ip);
    }
    if (!headers.has('x-forwarded-proto') && request.protocol) {
      headers.set('x-forwarded-proto', request.protocol);
    }
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    let requestBody: BodyInit | undefined;
    if (hasBody && request.body !== undefined && request.body !== null) {
      if (Buffer.isBuffer(request.body)) {
        requestBody = new Uint8Array(request.body);
      } else if (typeof request.body === 'string') {
        requestBody = request.body;
      } else {
        requestBody = JSON.stringify(request.body);
      }
    }
    const webRequest = new Request(url, {
      method: request.method,
      headers,
      body: requestBody,
    });

    const webResponse = await handleRequest(webRequest);
    const responseHeaders = collectResponseHeaders(webResponse.headers);

    if (
      request.method === 'HEAD' ||
      BODILESS_STATUS_CODES.has(webResponse.status) ||
      webResponse.body === null
    ) {
      return reply.code(webResponse.status).headers(responseHeaders).send();
    }

    const contentType = (webResponse.headers.get('content-type') ?? '').toLowerCase();
    if (contentType.includes('text/event-stream')) {
      if (responseHeaders['cache-control'] === undefined) {
        responseHeaders['cache-control'] = 'no-cache';
      }
      if (responseHeaders['connection'] === undefined) {
        responseHeaders['connection'] = 'keep-alive';
      }
      if (responseHeaders['x-accel-buffering'] === undefined) {
        responseHeaders['x-accel-buffering'] = 'no';
      }
      const nodeStream = Readable.fromWeb(webResponse.body as unknown as NodeWebReadableStream);
      request.raw.once('close', () => {
        if (!nodeStream.destroyed) {
          nodeStream.destroy();
        }
      });
      return reply.code(webResponse.status).headers(responseHeaders).send(nodeStream);
    }

    const bodyBuffer = Buffer.from(await webResponse.arrayBuffer());
    return reply.code(webResponse.status).headers(responseHeaders).send(bodyBuffer);
  });

  return {
    app,
    start: () => app.listen({ port, host }),
  };
}
