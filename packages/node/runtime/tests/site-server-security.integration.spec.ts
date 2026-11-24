import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';

import { afterEach, describe, expect, it } from 'vitest';

import { createSsrServer } from '../src/site-server.ts';

function createJsonLogCollector() {
  const records: Array<Record<string, unknown>> = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      for (const line of chunk.toString('utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          records.push(JSON.parse(trimmed) as Record<string, unknown>);
        } catch {
          // ignore non-JSON diagnostic lines
        }
      }
      callback();
    },
  });
  return { records, stream };
}

function sendRawHttp(
  port: number,
  options: {
    readonly method: string;
    readonly path: string;
    readonly headers?: Record<string, string>;
  },
): Promise<{
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        method: options.method,
        path: options.path,
        headers: options.headers,
      },
      res => {
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

describe('site-server edge request & proxy hardening', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  async function startEchoOriginServer(loggerStream: Writable) {
    const dir = mkdtempSync(join(tmpdir(), 'site-server-sec-'));
    tempDirs.push(dir);
    const serverDir = join(dir, 'server');
    const clientDir = join(dir, 'client');
    const { mkdirSync } = await import('node:fs');
    mkdirSync(serverDir, { recursive: true });
    mkdirSync(clientDir, { recursive: true });

    writeFileSync(
      join(serverDir, 'index.js'),
      `
export const entry = {
  module: {
    default: async function handleRequest(request) {
      return Response.json({
        url: request.url,
        origin: new URL(request.url).origin,
        forwardedProto: request.headers.get('x-forwarded-proto'),
        forwardedHost: request.headers.get('x-forwarded-host'),
      });
    },
  },
};
export const routes = {
  root: {
    id: 'root',
    path: '',
    module: { default: () => null, loader: async () => ({ ok: true }) },
  },
  splat: {
    id: 'splat',
    parentId: 'root',
    path: '*',
    module: { default: () => null },
  },
};
export const assets = {
  version: 'sec-test',
  entry: { module: '/entry.js', imports: [] },
  routes: {
    root: { id: 'root', path: '', hasAction: false, hasLoader: true, hasClientAction: false, hasClientLoader: false, hasClientMiddleware: false, hasErrorBoundary: false, module: '/root.js', imports: [] },
    splat: { id: 'splat', parentId: 'root', path: '*', hasAction: false, hasLoader: false, hasClientAction: false, hasClientLoader: false, hasClientMiddleware: false, hasErrorBoundary: false, module: '/splat.js', imports: [] },
  },
};
export const future = { v8_middleware: false, unstable_subResourceIntegrity: false, unstable_optimizeDeps: false, unstable_enableNodeReadableStream: true };
export const isSpaMode = false;
export const ssr = true;
export const publicPath = '/';
export const assetsBuildDirectory = 'dist/client';
export const prerender = [];
export const routeDiscovery = { mode: 'lazy', manifestPath: '/__manifest' };
export const basename = '/';
`,
      'utf8',
    );

    return createSsrServer({
      serviceName: 'security-edge-test',
      buildDir: dir,
      port: 0,
      host: '127.0.0.1',
      loggerStream,
    });
  }

  it('ignores client-spoofed X-Forwarded-Host and non-HTTP X-Forwarded-Proto values', async () => {
    const logs = createJsonLogCollector();
    const server = await startEchoOriginServer(logs.stream);
    try {
      const spoofedHost = await server.app.inject({
        method: 'GET',
        url: '/api/auth/session',
        headers: {
          host: 'admin.andrew-k.us',
          'x-forwarded-host': 'evil.example.invalid',
          'x-forwarded-proto': 'https',
          'x-correlation-id': 'sec-cid-host-1',
        },
      });
      expect(spoofedHost.statusCode).toBe(200);
      expect(spoofedHost.headers['x-correlation-id']).toBe('sec-cid-host-1');
      expect(spoofedHost.json()).toEqual({
        url: 'https://admin.andrew-k.us/api/auth/session',
        origin: 'https://admin.andrew-k.us',
        forwardedProto: 'https',
        forwardedHost: null,
      });

      const malformedForwardedHost = await server.app.inject({
        method: 'GET',
        url: '/api/auth/session',
        headers: {
          host: 'admin.andrew-k.us',
          'x-forwarded-host': 'user:pass@evil.example.invalid',
          'x-forwarded-proto': 'javascript',
          'x-correlation-id': 'sec-cid-proto-2',
        },
      });
      expect(malformedForwardedHost.statusCode).toBe(200);
      expect(malformedForwardedHost.headers['x-correlation-id']).toBe('sec-cid-proto-2');
      expect(malformedForwardedHost.json()).toEqual({
        url: 'http://admin.andrew-k.us/api/auth/session',
        origin: 'http://admin.andrew-k.us',
        forwardedProto: 'http',
        forwardedHost: null,
      });

      const multiHopHttps = await server.app.inject({
        method: 'GET',
        url: '/api/auth/session',
        headers: {
          host: 'admin.andrew-k.us',
          'x-forwarded-proto': 'http, https',
          'x-correlation-id': 'sec-cid-proto-multi-https',
        },
      });
      expect(multiHopHttps.statusCode).toBe(200);
      expect(multiHopHttps.json()).toEqual({
        url: 'https://admin.andrew-k.us/api/auth/session',
        origin: 'https://admin.andrew-k.us',
        forwardedProto: 'https',
        forwardedHost: null,
      });

      const multiHopUppercaseHttps = await server.app.inject({
        method: 'GET',
        url: '/api/auth/session',
        headers: {
          host: 'admin.andrew-k.us',
          'x-forwarded-proto': 'http, HTTPS',
          'x-correlation-id': 'sec-cid-proto-multi-upper',
        },
      });
      expect(multiHopUppercaseHttps.statusCode).toBe(200);
      expect(multiHopUppercaseHttps.json()).toEqual({
        url: 'https://admin.andrew-k.us/api/auth/session',
        origin: 'https://admin.andrew-k.us',
        forwardedProto: 'https',
        forwardedHost: null,
      });

      const multiHopHttp = await server.app.inject({
        method: 'GET',
        url: '/api/auth/session',
        headers: {
          host: 'admin.andrew-k.us',
          'x-forwarded-proto': 'https, http',
          'x-correlation-id': 'sec-cid-proto-multi-http',
        },
      });
      expect(multiHopHttp.statusCode).toBe(200);
      expect(multiHopHttp.json()).toEqual({
        url: 'http://admin.andrew-k.us/api/auth/session',
        origin: 'http://admin.andrew-k.us',
        forwardedProto: 'http',
        forwardedHost: null,
      });
    } finally {
      await server.app.close();
    }
  });

  it('rejects malformed Host headers, protocol-relative URLs, and TRACE with classified PublicAppError + X-Correlation-Id', async () => {
    const logs = createJsonLogCollector();
    const server = await startEchoOriginServer(logs.stream);
    await server.app.listen({ port: 0, host: '127.0.0.1' });
    const address = server.app.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected TCP listening port');
    }
    const port = address.port;

    try {
      const badHost = await server.app.inject({
        method: 'GET',
        url: '/',
        headers: {
          host: 'user:pass@evil.example.invalid',
          'x-correlation-id': 'sec-cid-bad-host',
        },
      });
      expect(badHost.statusCode).toBe(400);
      expect(badHost.headers['x-correlation-id']).toBe('sec-cid-bad-host');
      expect(badHost.json()).toMatchObject({
        code: 'ERR_VALIDATION',
        status: 400,
        correlationId: 'sec-cid-bad-host',
      });

      const protoRelative = await sendRawHttp(port, {
        method: 'GET',
        path: '//evil.example.invalid/cms',
        headers: {
          host: `127.0.0.1:${port}`,
          'x-correlation-id': 'sec-cid-proto-rel',
        },
      });
      expect(protoRelative.status).toBe(400);
      expect(protoRelative.headers['x-correlation-id']).toBe('sec-cid-proto-rel');
      expect(JSON.parse(protoRelative.body)).toMatchObject({
        code: 'ERR_VALIDATION',
        status: 400,
        correlationId: 'sec-cid-proto-rel',
      });

      const malformedProtoRel = await sendRawHttp(port, {
        method: 'GET',
        path: '//:bad',
        headers: {
          host: `127.0.0.1:${port}`,
          'x-correlation-id': 'sec-cid-bad-url',
        },
      });
      expect(malformedProtoRel.status).toBe(400);
      expect(malformedProtoRel.headers['x-correlation-id']).toBe('sec-cid-bad-url');
      expect(JSON.parse(malformedProtoRel.body)).toMatchObject({
        code: 'ERR_VALIDATION',
        status: 400,
        correlationId: 'sec-cid-bad-url',
      });

      const userinfoAbsolute = await sendRawHttp(port, {
        method: 'GET',
        path: `http://user:pass@127.0.0.1:${port}/`,
        headers: {
          host: `127.0.0.1:${port}`,
          'x-correlation-id': 'sec-cid-userinfo-url',
        },
      });
      expect(userinfoAbsolute.status).toBe(400);
      expect(userinfoAbsolute.headers['x-correlation-id']).toBe('sec-cid-userinfo-url');
      expect(JSON.parse(userinfoAbsolute.body)).toMatchObject({
        code: 'ERR_VALIDATION',
        status: 400,
        correlationId: 'sec-cid-userinfo-url',
      });
      const serializedLogs = JSON.stringify(logs.records);
      expect(serializedLogs).not.toContain('user:pass');
      expect(serializedLogs).toContain('[REDACTED]@');

      const traceRes = await server.app.inject({
        method: 'TRACE',
        url: '/',
        headers: {
          host: `127.0.0.1:${port}`,
          'x-correlation-id': 'sec-cid-trace',
        },
      });
      expect(traceRes.statusCode).toBe(405);
      expect(traceRes.headers['x-correlation-id']).toBe('sec-cid-trace');
      expect(traceRes.headers['allow']).toContain('GET');
      expect(traceRes.json()).toMatchObject({
        code: 'ERR_VALIDATION',
        status: 405,
        correlationId: 'sec-cid-trace',
      });
      expect(traceRes.body).not.toContain('HTTP method is unsupported');
      expect(
        logs.records.some(
          record =>
            record['seam_type'] === 'UNSOUND_CONDITION' &&
            record['correlationId'] === 'sec-cid-trace',
        ),
      ).toBe(true);
    } finally {
      await server.app.close();
    }
  });
});
