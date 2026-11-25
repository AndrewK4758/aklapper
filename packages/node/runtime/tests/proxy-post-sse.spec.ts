import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';

import { consumePostSseStream, StreamErrorPayloadSchema } from '@aklapper/core';
import { afterEach, describe, expect, it } from 'vitest';

import { encryptTotpSecret } from '../src/auth.ts';
import {
  clearGcpIdentityTokenCacheForTest,
  INTERNAL_AUTH_HEADER,
  isProductionEnv,
  proxyPostSse,
  proxySse,
  resolveInternalAuthSecret,
  verifyInternalAuthToken,
} from '../src/http.ts';
import type { SsrStructuredLogger } from '../src/request-context.ts';
import { createSsrServer } from '../src/site-server.ts';

function createMemoryLogger() {
  const records: Array<Record<string, unknown>> = [];
  const push = (level: string, obj: Record<string, unknown>, msg?: string) => {
    records.push({ level, ...obj, ...(msg ? { msg } : {}) });
  };
  const logger: SsrStructuredLogger = {
    info: (obj, msg) => push('info', obj, msg),
    warn: (obj, msg) => push('warn', obj, msg),
    error: (obj, msg) => push('error', obj, msg),
  };
  return { logger, records };
}

describe('@aklapper/node-runtime proxyPostSse, RFC 9113 hygiene & APP_ENV parity', () => {
  const origNodeEnv = process.env['NODE_ENV'];
  const origAppEnv = process.env['APP_ENV'];
  const origInternalSecret = process.env['INTERNAL_AUTH_SECRET'];
  const origTotpKey = process.env['TOTP_ENCRYPTION_KEY'];
  const tempDirs: string[] = [];

  afterEach(async () => {
    const restore = (k: string, v: string | undefined) => {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    };
    restore('NODE_ENV', origNodeEnv);
    restore('APP_ENV', origAppEnv);
    restore('INTERNAL_AUTH_SECRET', origInternalSecret);
    restore('TOTP_ENCRYPTION_KEY', origTotpKey);
    clearGcpIdentityTokenCacheForTest();
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) await rm(dir, { recursive: true, force: true });
    }
  });

  it('streams past headerTimeoutMs after headers arrive, signs X-Internal-Auth, and strips hop-by-hop headers', async () => {
    const { logger, records } = createMemoryLogger();
    const encoder = new TextEncoder();
    let seenAuth: string | null = null;
    let seenCorr: string | null = null;

    const res = await proxyPostSse({
      baseUrl: 'http://127.0.0.1:8083',
      path: '/v1/ask/stream',
      body: { mode: 'qa', question: 'Hello streaming' },
      headerTimeoutMs: 100,
      correlationId: 'corr-bff-01',
      internalAuth: { role: 'guest', subject: 'g-1', secret: 'bff-test-secret' },
      logger,
      fetchImpl: async (_url, init) => {
        const hdrs = new Headers(init?.headers);
        seenAuth = hdrs.get(INTERNAL_AUTH_HEADER);
        seenCorr = hdrs.get('x-correlation-id');
        await new Promise(r => setTimeout(r, 20));
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('event: meta\ndata: {"ok":true}\n\n'));
            setTimeout(() => {
              controller.enqueue(encoder.encode('event: delta\ndata: {"text":"slow chunk"}\n\n'));
              controller.close();
            }, 180);
          },
        });
        return new Response(stream, {
          status: 200,
          headers: {
            'content-type': 'text/event-stream; charset=utf-8',
            connection: 'keep-alive',
            'transfer-encoding': 'chunked',
          },
        });
      },
    });

    expect(res.status).toBe(200);
    expect(verifyInternalAuthToken(seenAuth, 'bff-test-secret')?.role).toBe('guest');
    expect(seenCorr).toBe('corr-bff-01');
    expect(res.headers.get('connection')).toBeNull();
    expect(res.headers.get('transfer-encoding')).toBeNull();
    expect(res.headers.get('x-accel-buffering')).toBe('no');
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(res.headers.get('x-correlation-id')).toBe('corr-bff-01');

    const bodyText = await res.text();
    expect(bodyText).toContain('slow chunk');
    expect(records.some(r => r['event'] === 'ssr.request.hop_by_hop_stripped')).toBe(true);
    expect(
      records.some(r => r['event'] === 'bff.sse.stream_termination' && r['branch'] === 'completed'),
    ).toBe(true);
  });

  it('classifies header timeouts (504), OIDC failures (503), network errors (502, never DB), 409/504, 500 redaction, 429 QuotaStatus, and does not auto-retry POST on 401/403', async () => {
    const { logger, records } = createMemoryLogger();

    // 1. Header timeout -> 504 ERR_STREAM_TIMEOUT (never 499)
    const timeoutRes = await proxyPostSse({
      baseUrl: 'http://127.0.0.1:8083',
      path: '/v1/ask/stream',
      body: { question: 'slow' },
      headerTimeoutMs: 40,
      correlationId: 'corr-to',
      logger,
      fetchImpl: (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    });
    expect(timeoutRes.status).toBe(504);
    expect(await timeoutRes.json()).toMatchObject({
      code: 'ERR_STREAM_TIMEOUT',
      status: 504,
      correlationId: 'corr-to',
    });

    // 2. OIDC failure under Cloud Run target -> 503 ERR_UPSTREAM_UNAVAILABLE
    const oidcRes = await proxyPostSse({
      baseUrl: 'https://ai-ask-abc.a.run.app',
      path: '/v1/ask/stream',
      oidcAuth: true,
      correlationId: 'corr-oidc',
      logger,
      fetchImpl: async () => {
        throw new Error('metadata unreachable');
      },
    });
    expect(oidcRes.status).toBe(503);
    expect(await oidcRes.json()).toMatchObject({
      code: 'ERR_UPSTREAM_UNAVAILABLE',
      status: 503,
    });

    // 3. OIDC 401/403 evicts token cache WITHOUT auto-retrying non-idempotent POST
    let postCalls = 0;
    const noRetryRes = await proxyPostSse({
      baseUrl: 'https://ai-ask-abc.a.run.app',
      path: '/v1/ask/stream',
      oidcAuth: true,
      correlationId: 'corr-401',
      logger,
      fetchImpl: async input => {
        const url = String(input);
        if (url.includes('metadata.google.internal')) {
          return new Response('fake-oidc-token', { status: 200 });
        }
        postCalls += 1;
        return Response.json({ error: 'unauthorized' }, { status: 401 });
      },
    });
    expect(noRetryRes.status).toBe(401);
    expect(postCalls).toBe(1);

    // 4. Caught fetch network ECONNREFUSED -> 502 ERR_UPSTREAM_UNAVAILABLE (NEVER ERR_DB_UNAVAILABLE)
    const netRes = await proxyPostSse({
      baseUrl: 'http://127.0.0.1:8083',
      path: '/v1/ask/stream',
      correlationId: 'corr-net',
      logger,
      fetchImpl: async () => {
        const err = Object.assign(new Error('fetch failed'), {
          cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }),
        });
        throw err;
      },
    });
    expect(netRes.status).toBe(502);
    expect(await netRes.json()).toMatchObject({ code: 'ERR_UPSTREAM_UNAVAILABLE', status: 502 });

    // 5. HTTP 409 and 504 preserved honestly; HTTP 500 leaks zero raw SQL/stack
    const conflictRes = await proxyPostSse({
      baseUrl: 'http://127.0.0.1:8083',
      path: '/v1/ask/stream',
      correlationId: 'corr-409',
      logger,
      fetchImpl: async () =>
        Response.json(
          { code: 'ERR_CONSTRAINT', status: 409, message: 'In flight.', action: 'Poll status.' },
          { status: 409 },
        ),
    });
    expect(conflictRes.status).toBe(409);

    const sql500Res = await proxyPostSse({
      baseUrl: 'http://127.0.0.1:8083',
      path: '/v1/ask/stream',
      correlationId: 'corr-500',
      logger,
      fetchImpl: async () =>
        new Response('SELECT * FROM secrets WHERE token = "leaked" at handler.ts:42:10', {
          status: 500,
        }),
    });
    const sql500Body = await sql500Res.text();
    expect(sql500Res.status).toBe(503);
    expect(sql500Body).not.toContain('SELECT * FROM');
    expect(sql500Body).not.toContain('handler.ts');

    // 6. HTTP 429 validates PublicAppError + QuotaStatus into StreamErrorPayloadSchema
    const rateRes = await proxyPostSse({
      baseUrl: 'http://127.0.0.1:8083',
      path: '/v1/ask/stream',
      correlationId: 'corr-429',
      logger,
      fetchImpl: async () =>
        Response.json(
          {
            error: 'Session or daily quota exceeded.',
            code: 'ERR_RATE_LIMITED',
            action: 'Wait a moment and submit again.',
            correlationId: 'corr-429',
            quota: {
              role: 'guest',
              turnsUsed: 5,
              maxTurns: 5,
              tokensUsed: 1200,
              maxTokens: 20000,
            },
          },
          { status: 429 },
        ),
    });
    expect(rateRes.status).toBe(429);
    const rateJson: unknown = await rateRes.json();
    const parsed = StreamErrorPayloadSchema.safeParse(rateJson);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.quota?.turnsUsed).toBe(5);
    expect(records.some(r => r['event'] === 'bff.sse.upstream_error_classified')).toBe(true);
  });

  it('strips Connection keep-alive in GET proxySse and aborts upstream SSE on Fastify client TCP disconnect', async () => {
    const getRes = await proxySse({
      baseUrl: 'http://127.0.0.1:8081',
      path: '/v1/cluster/stream',
      fetchImpl: async () =>
        new Response('event: pod\ndata: {"ok":true}\n\n', {
          status: 200,
          headers: { 'content-type': 'text/event-stream', connection: 'keep-alive' },
        }),
    });
    expect(getRes.headers.get('connection')).toBeNull();

    // Live Fastify TCP disconnect aborts upstream Go-style POST SSE + finite contract stream
    let upstreamAborted = false;
    const upstreamSrv = http.createServer((req, res) => {
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        connection: 'keep-alive',
      });
      if (req.url === '/v1/ask/stream/finite') {
        res.write(
          'event: meta\ndata: {"attemptId":"a-1","correlationId":"c-1","mode":"qa","provider":"local"}\n\n',
        );
        res.write(
          'event: sources\ndata: {"sources":[{"title":"Arch","snippet":"Go + SSR","score":0.95}]}\n\n',
        );
        res.write('event: delta\ndata: {"text":"Hello from Go SSE"}\n\n');
        res.write(
          'event: done\ndata: {"attemptId":"a-1","grounded":true,"abstained":false,"answer":"Hello from Go SSE","provider":"local","tokensUsed":12,"correlationId":"c-1"}\n\n',
        );
        res.end();
        return;
      }
      res.write('event: meta\ndata: {"started":true}\n\n');
      req.on('close', () => {
        upstreamAborted = true;
      });
    });
    await new Promise<void>(resolveListen => upstreamSrv.listen(0, '127.0.0.1', resolveListen));
    const upstreamPort = (upstreamSrv.address() as { port: number }).port;

    const dir = await mkdtemp(join(tmpdir(), 'aklapper-post-sse-'));
    tempDirs.push(dir);
    await mkdir(join(dir, 'client'), { recursive: true });
    await mkdir(join(dir, 'server'), { recursive: true });

    const proxyModUrl = new URL('../src/http.ts', import.meta.url).href;
    await writeFile(
      join(dir, 'server', 'index.js'),
      `
import { proxyPostSse } from ${JSON.stringify(proxyModUrl)};
export const entry = {
  module: {
    default: async (request) => {
      const pathname = new URL(request.url).pathname;
      const upstreamPath = pathname.endsWith('/finite') ? '/v1/ask/stream/finite' : '/v1/ask/stream';
      return proxyPostSse({
        baseUrl: 'http://127.0.0.1:${upstreamPort}',
        path: upstreamPath,
        body: { question: 'live disconnect' },
        signal: request.signal,
      });
    },
  },
};
export const routes = { root: { id: 'root', path: '', module: { default: () => null } } };
export const assets = { version: '1', entry: { module: '/entry.js', imports: [] }, routes: {} };
export const publicPath = '/';
export const assetsBuildDirectory = 'dist/client';
export const future = { v8_middleware: false, unstable_subResourceIntegrity: false, unstable_optimizeDeps: false, unstable_enableNodeReadableStream: true };
export const ssr = true;
export const isSpaMode = false;
export const prerender = [];
export const routeDiscovery = { mode: 'lazy', manifestPath: '/__manifest' };
`,
      'utf8',
    );

    const logLines: string[] = [];
    const logStream = new Writable({
      write(chunk, _enc, cb) {
        logLines.push(chunk.toString('utf8'));
        cb();
      },
    });
    const ssr = await createSsrServer({
      serviceName: 'portal-ssr',
      buildDir: dir,
      port: 0,
      host: '127.0.0.1',
      loggerStream: logStream,
    });
    const capturedReplyHeaders: Array<Record<string, unknown>> = [];
    ssr.app.addHook('onSend', async (_req, reply, payload) => {
      capturedReplyHeaders.push({ ...reply.getHeaders() });
      return payload;
    });
    const addr = await ssr.start();

    try {
      // 1. Verify Fastify SSR edge itself sets zero RFC 9113 hop-by-hop headers on reply
      const injected = await ssr.app.inject({
        method: 'POST',
        url: '/api/ask/stream/finite',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ question: 'inject header check' }),
      });
      expect(injected.statusCode).toBe(200);
      const replyHdrs = capturedReplyHeaders[0] ?? {};
      expect(replyHdrs['connection']).toBeUndefined();
      expect(replyHdrs['transfer-encoding']).toBeUndefined();
      expect(replyHdrs['keep-alive']).toBeUndefined();
      expect(injected.headers['x-accel-buffering']).toBe('no');
      expect(injected.headers['cache-control']).toBe('no-cache');

      // 2. Consumer contract: upstream SSE -> proxyPostSse -> Fastify -> @aklapper/core/sse consumePostSseStream
      const frames = await consumePostSseStream({
        url: `${addr}/api/ask/stream/finite`,
        body: { question: 'consumer contract' },
      });
      expect(frames.map(f => f.event)).toEqual(['meta', 'sources', 'delta', 'done']);
      expect(frames[2]?.data).toContain('Hello from Go SSE');

      // 3. Live TCP disconnect on Fastify reply.raw aborts upstream POST SSE immediately
      upstreamAborted = false;
      const parsed = new URL(addr);
      await new Promise<void>((resolveDone, rejectDone) => {
        const req = http.request(
          {
            hostname: parsed.hostname,
            port: Number(parsed.port),
            path: '/api/ask/stream',
            method: 'POST',
            headers: { 'content-type': 'application/json' },
          },
          res => {
            res.once('data', () => {
              req.destroy();
              resolveDone();
            });
          },
        );
        req.on('error', () => resolveDone());
        req.setTimeout(3_000, () => rejectDone(new Error('timed out waiting for SSE frame')));
        req.end(JSON.stringify({ question: 'hello' }));
      });

      await new Promise(r => setTimeout(r, 150));
      expect(upstreamAborted).toBe(true);
    } finally {
      await ssr.app.close();
      await new Promise<void>(r => upstreamSrv.close(() => r()));
    }
  });

  it('fails closed when APP_ENV=PRODUCTION even if NODE_ENV=development', () => {
    process.env['APP_ENV'] = 'PRODUCTION';
    process.env['NODE_ENV'] = 'development';
    delete process.env['INTERNAL_AUTH_SECRET'];
    delete process.env['TOTP_ENCRYPTION_KEY'];

    expect(isProductionEnv()).toBe(true);
    expect(() => resolveInternalAuthSecret()).toThrow(/INTERNAL_AUTH_SECRET/);
    expect(() => encryptTotpSecret('JBSWY3DPEHPK3PXP')).toThrow(/TOTP_ENCRYPTION_KEY/);
  });
});
