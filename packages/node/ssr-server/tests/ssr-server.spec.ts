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

import { createEntryServer, createSsrServer, streamTimeout } from '../src/index.ts';

describe('@aklapper/ssr-server', () => {
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
});
