import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { EntryContext } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { activeHandlerRef } = vi.hoisted(() => ({
  activeHandlerRef: {
    current: async (_request: Request): Promise<Response> => new Response('ok', { status: 200 }),
  },
}));

vi.mock('react-router', async importOriginal => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    createRequestHandler: () => (request: Request) => activeHandlerRef.current(request),
  };
});

import { createEntryServer, streamTimeout } from '../src/entry-server.ts';
import { createSsrServer } from '../src/site-server.ts';

describe('@aklapper/node-runtime/ssr', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        await rm(dir, { recursive: true, force: true });
      }
    }
  });

  async function createFixtureBuildDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'aklapper-ssr-test-'));
    tempDirs.push(dir);
    await mkdir(join(dir, 'client'), { recursive: true });
    await mkdir(join(dir, 'server'), { recursive: true });
    await writeFile(join(dir, 'server', 'index.js'), 'export default { mockBuild: true };\n');
    return dir;
  }

  it('handles HEAD requests without streaming body', async () => {
    const entry = createEntryServer({ streamTimeout: 2_500 });
    expect(entry.streamTimeout).toBe(2_500);
    expect(streamTimeout).toBe(5_000);

    const headers = new Headers({ 'X-Test': 'ok' });
    const res = await entry.handleRequest(
      new Request('http://localhost/health', { method: 'HEAD' }),
      200,
      headers,
      {} as EntryContext,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Test')).toBe('ok');
    expect(res.body).toBeNull();
  });

  it('serves /healthz and bridges SSR GET headers including multi-value Set-Cookie', async () => {
    const buildDir = await createFixtureBuildDir();
    activeHandlerRef.current = async request => {
      const resHeaders = new Headers({ 'content-type': 'text/plain; charset=utf-8' });
      resHeaders.append('set-cookie', 'a=1; Path=/');
      resHeaders.append('set-cookie', 'b=2; Path=/');
      return new Response(`url=${new URL(request.url).pathname}`, {
        status: 200,
        headers: resHeaders,
      });
    };

    const server = await createSsrServer({
      serviceName: 'test-ssr',
      buildDir,
      port: 0,
      host: '127.0.0.1',
    });

    try {
      const health = await server.app.inject({ method: 'GET', url: '/healthz' });
      expect(health.statusCode).toBe(200);
      expect(health.json()).toEqual({ status: 'ok', service: 'test-ssr' });

      const page = await server.app.inject({ method: 'GET', url: '/contact' });
      expect(page.statusCode).toBe(200);
      expect(page.body).toBe('url=/contact');
      expect(page.headers['set-cookie']).toEqual(['a=1; Path=/', 'b=2; Path=/']);
    } finally {
      await server.app.close();
    }
  });

  it('preserves raw Buffer payloads for multipart/form-data, form-urlencoded, and JSON POST requests', async () => {
    const buildDir = await createFixtureBuildDir();
    activeHandlerRef.current = async request => {
      const contentType = request.headers.get('content-type') ?? '';
      if (contentType.startsWith('multipart/form-data')) {
        const fd = await request.formData();
        const uploaded = fd.get('file');
        const fileText = uploaded instanceof File ? await uploaded.text() : null;
        return Response.json(
          {
            kind: 'multipart',
            name: fd.get('name'),
            fileName: uploaded instanceof File ? uploaded.name : null,
            fileText,
          },
          { status: 201 },
        );
      }
      if (contentType.startsWith('application/x-www-form-urlencoded')) {
        const fd = await request.formData();
        return Response.json({ kind: 'urlencoded', email: fd.get('email') }, { status: 200 });
      }
      if (contentType.startsWith('application/json')) {
        const body = (await request.json()) as { ping: string };
        return Response.json({ kind: 'json', ping: body.ping }, { status: 200 });
      }
      return new Response('unsupported', { status: 415 });
    };

    const server = await createSsrServer({
      serviceName: 'test-ssr',
      buildDir,
      port: 0,
      host: '127.0.0.1',
    });

    try {
      const fd = new FormData();
      fd.set('name', 'Ada Lovelace');
      fd.set('file', new File(['binary-safe-notes'], 'notes.txt', { type: 'text/plain' }));
      const encodedMultipart = new Response(fd);
      const multipartContentType = encodedMultipart.headers.get('content-type') ?? '';
      const multipartBuffer = Buffer.from(await encodedMultipart.arrayBuffer());

      const multipartRes = await server.app.inject({
        method: 'POST',
        url: '/contact',
        headers: { 'content-type': multipartContentType },
        payload: multipartBuffer,
      });
      expect(multipartRes.statusCode).toBe(201);
      expect(multipartRes.json()).toEqual({
        kind: 'multipart',
        name: 'Ada Lovelace',
        fileName: 'notes.txt',
        fileText: 'binary-safe-notes',
      });

      const formRes = await server.app.inject({
        method: 'POST',
        url: '/contact',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        payload: 'email=ada%40example.com',
      });
      expect(formRes.statusCode).toBe(200);
      expect(formRes.json()).toEqual({ kind: 'urlencoded', email: 'ada@example.com' });

      const jsonRes = await server.app.inject({
        method: 'POST',
        url: '/api/ping',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ ping: 'pong' }),
      });
      expect(jsonRes.statusCode).toBe(200);
      expect(jsonRes.json()).toEqual({ kind: 'json', ping: 'pong' });
    } finally {
      await server.app.close();
    }
  });

  it('preserves binary bytes (PNG/PDF magic bytes & non-UTF-8 octets) intact without text corruption', async () => {
    const buildDir = await createFixtureBuildDir();
    const binaryPayload = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0xff, 0xfe, 0x80,
      0xc0, 0x9f, 0x25, 0x50, 0x44, 0x46, 0xff,
    ]);
    activeHandlerRef.current = async request => {
      const path = new URL(request.url).pathname;
      if (path === '/download/attachment.png') {
        return new Response(binaryPayload, {
          status: 200,
          headers: {
            'content-type': 'image/png',
            'content-disposition': 'attachment; filename="attachment.png"',
          },
        });
      }
      if (path === '/empty') {
        return new Response(null, { status: 204, headers: { 'x-empty': 'true' } });
      }
      return new Response('ok', { status: 200 });
    };

    const server = await createSsrServer({
      serviceName: 'test-ssr',
      buildDir,
      port: 0,
      host: '127.0.0.1',
    });

    try {
      const binaryRes = await server.app.inject({ method: 'GET', url: '/download/attachment.png' });
      expect(binaryRes.statusCode).toBe(200);
      expect(binaryRes.headers['content-type']).toBe('image/png');
      expect(Buffer.compare(binaryRes.rawPayload, Buffer.from(binaryPayload))).toBe(0);

      const emptyRes = await server.app.inject({ method: 'GET', url: '/empty' });
      expect(emptyRes.statusCode).toBe(204);
      expect(emptyRes.headers['x-empty']).toBe('true');
      expect(emptyRes.rawPayload.length).toBe(0);

      const headRes = await server.app.inject({ method: 'HEAD', url: '/download/attachment.png' });
      expect(headRes.statusCode).toBe(200);
      expect(headRes.rawPayload.length).toBe(0);
    } finally {
      await server.app.close();
    }
  });

  it('streams text/event-stream chunks incrementally without buffering until stream close', async () => {
    const buildDir = await createFixtureBuildDir();
    let emitSecondChunk: (() => void) | null = null;
    const encoder = new TextEncoder();

    activeHandlerRef.current = async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('event: pod\ndata: {"seq":1}\n\n'));
          emitSecondChunk = () => {
            controller.enqueue(encoder.encode('event: pod\ndata: {"seq":2}\n\n'));
            controller.close();
          };
        },
      });

      return new Response(stream, {
        status: 200,
        headers: { 'content-type': 'text/event-stream; charset=utf-8' },
      });
    };

    const server = await createSsrServer({
      serviceName: 'test-ssr',
      buildDir,
      port: 0,
      host: '127.0.0.1',
    });

    const address = await server.start();
    try {
      const response = await fetch(`${address}/api/stream`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/event-stream');
      expect(response.headers.get('cache-control')).toBe('no-cache');
      expect(response.body).not.toBeNull();

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      // Chunk 1 MUST arrive before chunk 2 is emitted or the stream is closed
      const firstRead = await reader.read();
      expect(firstRead.done).toBe(false);
      expect(decoder.decode(firstRead.value)).toContain('{"seq":1}');

      expect(emitSecondChunk).not.toBeNull();
      emitSecondChunk!();

      let rest = '';
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        rest += decoder.decode(next.value, { stream: true });
      }
      expect(rest).toContain('{"seq":2}');
    } finally {
      await server.app.close();
    }
  });

  it('enforces scoped rate limiting, proxy IP fallback, and header forwarding for admin-ssr auth routes only', async () => {
    const buildDir = await createFixtureBuildDir();
    activeHandlerRef.current = async request => {
      return Response.json({
        forwardedFor: request.headers.get('x-forwarded-for'),
        forwardedProto: request.headers.get('x-forwarded-proto'),
      });
    };

    const adminServer = await createSsrServer({
      serviceName: 'admin-ssr',
      buildDir,
      port: 0,
      host: '127.0.0.1',
    });
    const portalServer = await createSsrServer({
      serviceName: 'portal-ssr',
      buildDir,
      port: 0,
      host: '127.0.0.1',
    });

    try {
      const probe = await adminServer.app.inject({
        method: 'POST',
        url: '/api/auth/passkey/login/options',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({}),
      });
      expect(probe.statusCode).toBe(200);
      expect(probe.json().forwardedFor).toBeTruthy();
      expect(probe.json().forwardedProto).toBe('http');

      for (let i = 0; i < 20; i += 1) {
        const res = await adminServer.app.inject({
          method: 'POST',
          url: '/api/auth/password/login',
          headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.50' },
          payload: JSON.stringify({ handle: 'admin', password: 'wrong' }),
        });
        expect(res.statusCode).toBe(200);
      }

      const throttled = await adminServer.app.inject({
        method: 'POST',
        url: '/api/auth/password/login',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.50' },
        payload: JSON.stringify({ handle: 'admin', password: 'wrong' }),
      });
      expect(throttled.statusCode).toBe(429);
      expect(throttled.headers['retry-after']).toBeDefined();
      expect(throttled.json()).toMatchObject({
        statusCode: 429,
        error: 'RATE_LIMITED',
      });

      const unthrottledRoute = await adminServer.app.inject({
        method: 'GET',
        url: '/login',
        headers: { 'x-forwarded-for': '203.0.113.50' },
      });
      expect(unthrottledRoute.statusCode).toBe(200);

      for (let i = 0; i < 25; i += 1) {
        const portalRes = await portalServer.app.inject({
          method: 'POST',
          url: '/api/auth/password/login',
          headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.50' },
          payload: JSON.stringify({}),
        });
        expect(portalRes.statusCode).toBe(200);
      }
    } finally {
      await adminServer.app.close();
      await portalServer.app.close();
    }
  });

  it('strips spoofed leftmost X-Forwarded-For hops and enforces rate limits across trailing-slash and %2F path variants', async () => {
    const buildDir = await createFixtureBuildDir();
    activeHandlerRef.current = async request =>
      Response.json({
        forwardedFor: request.headers.get('x-forwarded-for'),
      });

    const adminServer = await createSsrServer({
      serviceName: 'admin-ssr',
      buildDir,
      port: 0,
      host: '127.0.0.1',
    });

    try {
      for (let i = 0; i < 10; i += 1) {
        const res = await adminServer.app.inject({
          method: 'POST',
          url: '/api/auth/password/login',
          headers: {
            'content-type': 'application/json',
            'x-forwarded-for': `10.0.0.${i + 1}, 203.0.113.91`,
          },
          payload: JSON.stringify({ handle: 'admin', password: 'wrong' }),
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ forwardedFor: '203.0.113.91' });
      }
      for (let i = 0; i < 10; i += 1) {
        const res = await adminServer.app.inject({
          method: 'POST',
          url: '/api/auth/password/login',
          headers: {
            'content-type': 'application/json',
            'x-forwarded-for': `10.1.0.${i + 1}, 203.0.113.91`,
          },
          payload: JSON.stringify({ handle: 'admin', password: 'wrong' }),
        });
        expect(res.statusCode).toBe(200);
      }

      const spoofLimited = await adminServer.app.inject({
        method: 'POST',
        url: '/api/auth/password/login',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '10.2.0.99, 203.0.113.91',
        },
        payload: JSON.stringify({ handle: 'admin', password: 'wrong' }),
      });
      expect(spoofLimited.statusCode).toBe(429);
      expect(spoofLimited.json()).toMatchObject({ statusCode: 429, error: 'RATE_LIMITED' });

      const passwordVariantUrls = ['/api/auth/password/login/', '/api/auth/password%2Flogin'];
      for (let i = 0; i < 20; i += 1) {
        const res = await adminServer.app.inject({
          method: 'POST',
          url: passwordVariantUrls[i % passwordVariantUrls.length]!,
          headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.92' },
          payload: JSON.stringify({ handle: 'admin', password: 'wrong' }),
        });
        expect(res.statusCode).toBe(200);
        expect(res.headers['x-ratelimit-limit']).toBe('20');
      }

      const passwordVariantLimited = await adminServer.app.inject({
        method: 'POST',
        url: '/api/auth/foo/../password%2Flogin/',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.92' },
        payload: JSON.stringify({ handle: 'admin', password: 'wrong' }),
      });
      expect(passwordVariantLimited.statusCode).toBe(429);
      expect(passwordVariantLimited.json()).toMatchObject({
        statusCode: 429,
        error: 'RATE_LIMITED',
      });

      const totpVariantUrls = ['/api/auth/totp/verify/', '/api/auth/totp%2Fverify'];
      for (let i = 0; i < 20; i += 1) {
        const res = await adminServer.app.inject({
          method: 'POST',
          url: totpVariantUrls[i % totpVariantUrls.length]!,
          headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.93' },
          payload: JSON.stringify({ code: '123456' }),
        });
        expect(res.statusCode).toBe(200);
        expect(res.headers['x-ratelimit-limit']).toBe('20');
      }

      const totpVariantLimited = await adminServer.app.inject({
        method: 'POST',
        url: '/api/auth/totp/verify/',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.93' },
        payload: JSON.stringify({ code: '123456' }),
      });
      expect(totpVariantLimited.statusCode).toBe(429);
      expect(totpVariantLimited.json()).toMatchObject({
        statusCode: 429,
        error: 'RATE_LIMITED',
      });
    } finally {
      await adminServer.app.close();
    }
  });
});
