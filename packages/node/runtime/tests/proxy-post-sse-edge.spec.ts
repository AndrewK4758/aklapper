import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { consumePostSseStream, StreamErrorPayloadSchema } from '@aklapper/core/sse';
import { describe, expect, it } from 'vitest';

import { proxyPostSse } from '../src/http-sse.ts';
import { proxySse } from '../src/http.ts';
import { createSsrServer } from '../src/site-server.ts';

describe('proxyPostSse / proxySse 4xx error parity, correlationId bounds & gzip decompression hygiene', () => {
  it('preserves 4xx HTTP status codes with safe catalog tuples for non-JSON and untrusted 4xx JSON errors', async () => {
    const cases: ReadonlyArray<{
      status: number;
      body: string;
      wantStatus: number;
      wantCode: string;
      expectedTurnsUsed: number | undefined;
    }> = [
      {
        status: 401,
        body: '<html>Cloud Run IAM Unauthorized</html>',
        wantStatus: 401,
        wantCode: 'ERR_UNAUTHORIZED',
        expectedTurnsUsed: undefined,
      },
      {
        status: 404,
        body: '404 page not found',
        wantStatus: 404,
        wantCode: 'ERR_NOT_FOUND',
        expectedTurnsUsed: undefined,
      },
      {
        status: 400,
        body: 'bad json input',
        wantStatus: 400,
        wantCode: 'ERR_VALIDATION',
        expectedTurnsUsed: undefined,
      },
      {
        status: 429,
        body: JSON.stringify({
          code: 'CUSTOM_LIMIT',
          message: 'SQL error stack trace leaked',
          quota: {
            role: 'guest',
            turnsUsed: 5,
            maxTurns: 5,
            tokensUsed: 500,
            maxTokens: 20000,
          },
        }),
        wantStatus: 429,
        wantCode: 'ERR_RATE_LIMITED',
        expectedTurnsUsed: 5,
      },
      {
        status: 403,
        body: JSON.stringify({
          code: 'ERR_FORBIDDEN',
          message: 'postgres://user:pass@db/prod denied',
        }),
        wantStatus: 403,
        wantCode: 'ERR_FORBIDDEN',
        expectedTurnsUsed: undefined,
      },
      {
        status: 401,
        body: JSON.stringify({ code: 'IAM_REJECTED', message: 'Denied' }),
        wantStatus: 401,
        wantCode: 'ERR_UNAUTHORIZED',
        expectedTurnsUsed: undefined,
      },
      {
        status: 401,
        body: JSON.stringify({
          error: 'invalid_token',
          message:
            'Audience https://ai-ask-abc123-uc.a.run.app rejected for sa@games-424800.iam.gserviceaccount.com',
        }),
        wantStatus: 401,
        wantCode: 'ERR_UNAUTHORIZED',
        expectedTurnsUsed: undefined,
      },
      {
        status: 400,
        body: JSON.stringify({
          error: 'pq: relation "ask_turns" does not exist (stream.go:215)',
        }),
        wantStatus: 400,
        wantCode: 'ERR_VALIDATION',
        expectedTurnsUsed: undefined,
      },
      {
        status: 429,
        body: JSON.stringify({
          code: 'ERR_RATE_LIMITED',
          message: 'SQL error stack trace leaked',
          quota: {
            role: 'guest',
            turnsUsed: 5,
            maxTurns: 5,
            tokensUsed: 500,
            maxTokens: 20000,
          },
        }),
        wantStatus: 429,
        wantCode: 'ERR_RATE_LIMITED',
        expectedTurnsUsed: 5,
      },
    ];

    for (const tc of cases) {
      const res = await proxyPostSse({
        baseUrl: 'http://127.0.0.1:8083',
        path: '/v1/ask/stream',
        body: { question: 'Test 4xx error parity' },
        correlationId: 'corr-4xx-test',
        fetchImpl: async () =>
          new Response(tc.body, {
            status: tc.status,
            headers: { 'content-type': 'text/plain' },
          }),
      });
      expect(res.status).toBe(tc.wantStatus);
      const parsed = StreamErrorPayloadSchema.parse(await res.json());
      expect(parsed.code).toBe(tc.wantCode);
      expect(parsed.status).toBe(tc.wantStatus);
      expect(parsed.message).not.toContain('postgres://');
      expect(parsed.message).not.toContain('SQL');
      expect(parsed.message).not.toContain('a.run.app');
      expect(parsed.message).not.toContain('gserviceaccount.com');
      expect(parsed.message).not.toContain('stream.go');
      expect(parsed.quota?.turnsUsed).toBe(tc.expectedTurnsUsed);
    }
  });

  it('normalizes oversized (>128 char) correlationId safely without throwing ZodError', async () => {
    const hugeCorrId = 'x'.repeat(250);
    const res = await proxyPostSse({
      baseUrl: 'http://127.0.0.1:8083',
      path: '/v1/ask/stream',
      body: { question: 'Oversized corr id' },
      correlationId: hugeCorrId,
      fetchImpl: async () => new Response('upstream failure', { status: 503 }),
    });
    expect(res.status).toBe(503);
    const parsed = StreamErrorPayloadSchema.parse(await res.json());
    expect(parsed.correlationId.length).toBeLessThanOrEqual(128);
    expect(parsed.correlationId).not.toBe(hugeCorrId);
  });

  it('strips content-encoding, content-length, and te on Undici-decompressed gzipped SSE streams through Fastify', async () => {
    const ssePayload =
      'event: meta\ndata: {"ok":true}\n\nevent: delta\ndata: {"text":"gzipped"}\n\n';
    const gzipped = gzipSync(Buffer.from(ssePayload, 'utf8'));
    const buildDir = mkdtempSync(join(tmpdir(), 'ssr-gzip-sse-'));
    mkdirSync(join(buildDir, 'client'), { recursive: true });
    mkdirSync(join(buildDir, 'server'), { recursive: true });

    const upstream = createServer((_req, res) => {
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'content-encoding': 'gzip',
        'content-length': String(gzipped.byteLength),
        te: 'trailers',
      });
      res.end(gzipped);
    });
    await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve));
    const upstreamPort = (upstream.address() as AddressInfo).port;
    const upstreamUrl = `http://127.0.0.1:${upstreamPort}`;

    try {
      const getRes = await proxySse({
        baseUrl: upstreamUrl,
        path: '/v1/stream',
      });
      expect(getRes.status).toBe(200);
      expect(getRes.headers.get('content-encoding')).toBeNull();
      expect(getRes.headers.get('content-length')).toBeNull();
      expect(getRes.headers.get('te')).toBeNull();
      expect(await getRes.text()).toContain('gzipped');

      const proxyModUrl = new URL('../src/http.ts', import.meta.url).href;
      writeFileSync(
        join(buildDir, 'server', 'index.js'),
        `
import { proxyPostSse } from ${JSON.stringify(proxyModUrl)};
export const entry = {
  module: {
    default: async (request) =>
      proxyPostSse({
        baseUrl: ${JSON.stringify(upstreamUrl)},
        path: '/v1/ask/stream',
        body: { question: 'gzipped' },
        signal: request.signal,
      }),
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

      const ssr = await createSsrServer({
        serviceName: 'test-gzip-sse',
        buildDir,
        port: 0,
        host: '127.0.0.1',
      });
      const address = await ssr.start();
      try {
        const frames = await consumePostSseStream({
          url: `${address}/api/ask/stream`,
          body: { question: 'gzipped' },
        });
        expect(frames).toEqual([
          { event: 'meta', data: '{"ok":true}' },
          { event: 'delta', data: '{"text":"gzipped"}' },
        ]);
      } finally {
        await ssr.app.close();
      }
    } finally {
      await new Promise<void>(resolve => upstream.close(() => resolve()));
      rmSync(buildDir, { recursive: true, force: true });
    }
  });
});
