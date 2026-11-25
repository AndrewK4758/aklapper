import { resolve } from 'node:path';
import { Readable, type Writable } from 'node:stream';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import { pathToFileURL } from 'node:url';

import { createPublicAppError } from '@aklapper/core';
import { classifyServerError } from '@aklapper/core/server-errors';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { createRequestHandler, RouterContextProvider, type ServerBuild } from 'react-router';

import { AUTH_LOG_REDACT_PATHS } from './auth.ts';
import { loadWorkspaceEnv } from './env.ts';
import { collectHopByHopNames } from './http-hygiene.ts';
import { SINGLE_PROXY_HOP } from './http.ts';
import { extractCorrelationId, logDiagnosticError, requestContextKey } from './request-context.ts';

export interface SsrServerOptions {
  serviceName: string;
  buildDir: string;
  port: number;
  host: string;
  loggerStream?: Writable;
}

export interface SsrServerInstance {
  app: FastifyInstance;
  start: () => Promise<string>;
}

const BODILESS_STATUS_CODES = new Set([204, 205, 304]);
const UNSUPPORTED_FETCH_METHODS = new Set(['TRACE', 'CONNECT']);
const HOSTNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?(?::(\d{1,5}))?$/;
const IPV6_HOST_RE = /^\[[0-9a-fA-F:]+\](?::(\d{1,5}))?$/;
const URL_USERINFO_RE = /^((?:[a-z][a-z0-9+.-]*:)?\/[/\\])[^/?#\s]+@/i;
const HOST_USERINFO_RE = /^[\s\S]+@/;

function scrubRequestUrlForLog(rawUrl: string | undefined): string | undefined {
  if (typeof rawUrl !== 'string') return rawUrl;
  return rawUrl.replace(URL_USERINFO_RE, '$1[REDACTED]@');
}

function scrubHostForLog(rawHost: string | undefined): string | undefined {
  if (typeof rawHost !== 'string') return rawHost;
  return rawHost.replace(HOST_USERINFO_RE, '[REDACTED]@');
}

function isValidHostHeader(host: string): boolean {
  if (host.length === 0 || host.length > 255 || host.includes('..')) {
    return false;
  }
  const match = IPV6_HOST_RE.exec(host) ?? HOSTNAME_RE.exec(host);
  if (!match) {
    return false;
  }
  const rawPort = match[1];
  if (rawPort !== undefined) {
    const parsedPort = Number(rawPort);
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
      return false;
    }
  }
  return true;
}

function resolveAuthoritativeHost(
  rawHeader: string | string[] | undefined,
  port: number,
): string | null {
  if (rawHeader === undefined) {
    return `localhost:${port}`;
  }
  if (typeof rawHeader !== 'string') {
    return null;
  }
  const trimmed = rawHeader.trim();
  return isValidHostHeader(trimmed) ? trimmed : null;
}

function parseSafeRequestUrl(rawUrl: string, origin: string): URL | null {
  if (rawUrl.startsWith('//') || rawUrl.startsWith('/\\')) {
    return null;
  }
  try {
    const expectedOrigin = new URL(origin).origin;
    if (rawUrl.startsWith('/')) {
      const parsed = new URL(rawUrl, expectedOrigin);
      return parsed.origin === expectedOrigin ? parsed : null;
    }
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      const parsed = new URL(rawUrl);
      if (parsed.username !== '' || parsed.password !== '') {
        return null;
      }
      return parsed.origin === expectedOrigin ? parsed : null;
    }
    return null;
  } catch {
    return null;
  }
}

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
    let normalized = new URL(prefixed, 'http://localhost').pathname
      .replace(/\/+$/, '')
      .toLowerCase();
    if (normalized.endsWith('/_.data')) {
      normalized = normalized.slice(0, -'/_.data'.length);
    } else if (normalized.endsWith('.data')) {
      normalized = normalized.slice(0, -'.data'.length);
    }
    return normalized.replace(/\/+$/, '') || '/';
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

function collectResponseHeaders(webHeaders: Headers): {
  readonly headers: Record<string, string | string[]>;
  readonly stripped: readonly string[];
} {
  const forbidden = collectHopByHopNames(webHeaders);
  const responseHeaders: Record<string, string | string[]> = {};
  const stripped: string[] = [];
  webHeaders.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'set-cookie') return;
    if (forbidden.has(lowerKey)) {
      if (!stripped.includes(lowerKey)) stripped.push(lowerKey);
      return;
    }
    const existing = responseHeaders[lowerKey];
    if (existing === undefined) {
      responseHeaders[lowerKey] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      responseHeaders[lowerKey] = [existing, value];
    }
  });

  const setCookies = typeof webHeaders.getSetCookie === 'function' ? webHeaders.getSetCookie() : [];
  if (setCookies.length === 1) {
    responseHeaders['set-cookie'] = setCookies[0]!;
  } else if (setCookies.length > 1) {
    responseHeaders['set-cookie'] = setCookies;
  }

  return { headers: responseHeaders, stripped };
}

export async function createSsrServer(options: SsrServerOptions): Promise<SsrServerInstance> {
  loadWorkspaceEnv({ startDir: options.buildDir });
  const { serviceName, buildDir, port, host, loggerStream } = options;
  const redact = {
    paths: [...AUTH_LOG_REDACT_PATHS],
    censor: '[REDACTED]',
  };
  const serializers = {
    req(request: FastifyRequest) {
      const rawVersion = request?.headers?.['accept-version'];
      return {
        method: request.method,
        url: scrubRequestUrlForLog(request.url) ?? '',
        version: Array.isArray(rawVersion) ? rawVersion[0] : rawVersion,
        host: scrubHostForLog(request.host) ?? '',
        remoteAddress: request.ip,
        remotePort: request.socket?.remotePort,
      };
    },
  };
  const app = Fastify({
    trustProxy: SINGLE_PROXY_HOP,
    logger: loggerStream ? { stream: loggerStream, redact, serializers } : { redact, serializers },
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

  app.setNotFoundHandler((request, reply) => {
    const { correlationId } = extractCorrelationId(request.headers);
    const publicError = createPublicAppError({
      code: 'ERR_VALIDATION',
      status: 405,
      message: 'HTTP method is not allowed.',
      action: 'Use a supported HTTP method and retry.',
      correlationId,
    });
    request.log.warn(
      {
        seam_type: 'UNSOUND_CONDITION',
        event: 'ssr.request.unsupported_method',
        method: request.method.toUpperCase(),
        correlationId,
        service: serviceName,
      },
      'Rejected unsupported HTTP method',
    );
    return reply
      .code(405)
      .header('x-correlation-id', correlationId)
      .header('allow', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS')
      .send(publicError);
  });

  const serverBuildUrl = pathToFileURL(resolve(buildDir, 'server', 'index.js')).href;
  const serverBuild = (await import(/* @vite-ignore */ serverBuildUrl)) as ServerBuild;
  const handleRequest = createRequestHandler(serverBuild, process.env['NODE_ENV'] ?? 'production');

  app.all('*', async (request, reply) => {
    const { correlationId, headerRejected } = extractCorrelationId(request.headers);
    const childLogger = request.log.child({ correlationId, service: serviceName });

    if (headerRejected) {
      childLogger.warn(
        {
          seam_type: 'UNSOUND_CONDITION',
          event: 'ssr.request.invalid_correlation_header',
          correlationId,
          service: serviceName,
        },
        'Rejected malformed incoming correlation header; generated fresh UUID',
      );
    }

    const method = request.method.toUpperCase();
    if (UNSUPPORTED_FETCH_METHODS.has(method)) {
      const publicError = createPublicAppError({
        code: 'ERR_VALIDATION',
        status: 405,
        message: 'HTTP method is not allowed.',
        action: 'Use a supported HTTP method and retry.',
        correlationId,
      });
      childLogger.warn(
        {
          seam_type: 'UNSOUND_CONDITION',
          event: 'ssr.request.unsupported_method',
          method,
          correlationId,
          service: serviceName,
        },
        `Rejected unsupported HTTP method ${method}`,
      );
      return reply
        .code(405)
        .header('x-correlation-id', correlationId)
        .header('allow', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS')
        .send(publicError);
    }

    const resolvedHost = resolveAuthoritativeHost(request.headers.host, port);
    if (resolvedHost === null) {
      const publicError = createPublicAppError({
        code: 'ERR_VALIDATION',
        status: 400,
        message: 'Malformed Host header.',
        action: 'Verify the request host and retry.',
        correlationId,
      });
      childLogger.warn(
        {
          seam_type: 'UNSOUND_CONDITION',
          event: 'ssr.request.invalid_host_header',
          correlationId,
          service: serviceName,
        },
        'Rejected malformed Host header',
      );
      return reply.code(400).header('x-correlation-id', correlationId).send(publicError);
    }

    const protocol = request.protocol.trim().toLowerCase() === 'https' ? 'https' : 'http';
    const origin = `${protocol}://${resolvedHost}`;
    const url = parseSafeRequestUrl(request.url, origin);
    if (url === null) {
      const publicError = createPublicAppError({
        code: 'ERR_VALIDATION',
        status: 400,
        message: 'Malformed request URL.',
        action: 'Verify the request path and retry.',
        correlationId,
      });
      childLogger.warn(
        {
          seam_type: 'UNSOUND_CONDITION',
          event: 'ssr.request.invalid_url',
          correlationId,
          service: serviceName,
        },
        'Rejected malformed or origin-overriding request URL',
      );
      return reply.code(400).header('x-correlation-id', correlationId).send(publicError);
    }

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
    headers.set('x-forwarded-proto', protocol);
    headers.delete('x-forwarded-host');
    headers.set('x-correlation-id', correlationId);

    const hasBody = method !== 'GET' && method !== 'HEAD';
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

    const abortController = new AbortController();
    let webRequest: Request;
    try {
      webRequest = new Request(url, {
        method,
        headers,
        body: requestBody,
        signal: abortController.signal,
      });
    } catch (error) {
      const { publicError, diagnostic } = classifyServerError(error, {
        correlationId,
        source: `${serviceName}.ssr.edge.request`,
      });
      logDiagnosticError(childLogger, diagnostic);
      return reply
        .code(publicError.status)
        .header('x-correlation-id', correlationId)
        .send(publicError);
    }

    const handleResponseClose = () => {
      cleanupCloseListener();
      if (!reply.raw.writableEnded && !abortController.signal.aborted) {
        abortController.abort(new DOMException('Client disconnected', 'AbortError'));
      }
    };
    const cleanupCloseListener = () => {
      reply.raw.off('close', handleResponseClose);
      reply.raw.off('finish', cleanupCloseListener);
    };
    reply.raw.once('close', handleResponseClose);
    reply.raw.once('finish', cleanupCloseListener);

    const routerContext = new RouterContextProvider();
    routerContext.set(requestContextKey, {
      correlationId,
      logger: childLogger,
      serviceName,
      signal: abortController.signal,
    });

    let webResponse: Response;
    try {
      webResponse = await handleRequest(webRequest, routerContext);
    } catch (error) {
      cleanupCloseListener();
      const { publicError, diagnostic } = classifyServerError(error, {
        correlationId,
        source: `${serviceName}.ssr.edge`,
      });
      logDiagnosticError(childLogger, diagnostic);
      return reply
        .code(publicError.status)
        .header('x-correlation-id', correlationId)
        .send(publicError);
    }

    if (abortController.signal.aborted) {
      if (webResponse.body !== null) {
        void webResponse.body.cancel().catch(() => undefined);
      }
      cleanupCloseListener();
      reply.hijack();
      return;
    }

    const { headers: responseHeaders, stripped: strippedHopByHop } = collectResponseHeaders(
      webResponse.headers,
    );
    if (strippedHopByHop.length > 0) {
      childLogger.warn(
        {
          seam_type: 'BOUNDARY_FAULT',
          event: 'ssr.request.hop_by_hop_stripped',
          strippedHeaders: strippedHopByHop,
          correlationId,
          service: serviceName,
        },
        'Stripped RFC 9113 hop-by-hop response headers',
      );
    }
    responseHeaders['x-correlation-id'] = correlationId;

    if (
      request.method === 'HEAD' ||
      BODILESS_STATUS_CODES.has(webResponse.status) ||
      webResponse.body === null
    ) {
      if (webResponse.body !== null) {
        void webResponse.body.cancel().catch(() => undefined);
      }
      cleanupCloseListener();
      return reply.code(webResponse.status).headers(responseHeaders).send();
    }

    if (responseHeaders['x-accel-buffering'] === undefined) {
      responseHeaders['x-accel-buffering'] = 'no';
    }

    const contentType = (webResponse.headers.get('content-type') ?? '').toLowerCase();
    if (contentType.includes('text/event-stream')) {
      if (responseHeaders['cache-control'] === undefined) {
        responseHeaders['cache-control'] = 'no-cache';
      }
    }

    const nodeStream = Readable.fromWeb(webResponse.body as unknown as NodeWebReadableStream);
    const onAbort = () => {
      if (!nodeStream.destroyed) {
        nodeStream.destroy();
      }
    };
    abortController.signal.addEventListener('abort', onAbort, { once: true });
    nodeStream.once('close', () => {
      abortController.signal.removeEventListener('abort', onAbort);
    });
    nodeStream.on('error', err => {
      if (!abortController.signal.aborted) {
        childLogger.error(
          { err, correlationId, service: serviceName },
          'SSR response stream emitted an error',
        );
      }
    });

    return reply.code(webResponse.status).headers(responseHeaders).send(nodeStream);
  });

  return {
    app,
    start: () => app.listen({ port, host }),
  };
}
