import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Writable } from 'node:stream';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { createSsrServer } from '../src/site-server.ts';
import { extractCorrelationId } from '../src/stream.ts';

function createJsonLogCollector() {
  const records: Array<Record<string, unknown>> = [];
  let buf = '';
  const stream = new Writable({
    write(chunk, _enc, cb) {
      buf += chunk.toString('utf8');
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          records.push(JSON.parse(line) as Record<string, unknown>);
        } catch {
          // Ignore non-JSON log lines
        }
      }
      cb();
    },
  });
  return { stream, records };
}

function makeServerBuildModule(entryBody: string, extraImports = ''): string {
  return `${extraImports}
export const entry = {
  module: {
    default: async (request, status, headers, routerContext, loadContext) => {
      ${entryBody}
    },
  },
};
export const routes = {
  root: {
    id: 'root', path: '',
    module: { default: () => null, loader: async () => ({ ok: true }) },
  },
  submit: {
    id: 'submit', parentId: 'root', path: 'submit',
    module: {
      action: async ({ request }) => {
        const url = new URL(request.url);
        const abortedBefore = request.signal.aborted;
        let parsedName = null;
        if ((request.headers.get('content-type') ?? '').includes('multipart/form-data')) {
          parsedName = (await request.formData()).get('name');
        }
        return Response.json({
          protocol: url.protocol, origin: url.origin,
          abortedBefore, abortedAfter: request.signal.aborted, parsedName,
        });
      },
    },
  },
};
export const assets = {
  version: '1', entry: { module: '/entry.js', imports: [] },
  routes: {
    root: { id: 'root', path: '', hasAction: false, hasLoader: true, hasClientAction: false, hasClientLoader: false, hasClientMiddleware: false, hasErrorBoundary: false, module: '/root.js', imports: [] },
    submit: { id: 'submit', parentId: 'root', path: 'submit', hasAction: true, hasLoader: false, hasClientAction: false, hasClientLoader: false, hasClientMiddleware: false, hasErrorBoundary: false, module: '/submit.js', imports: [] },
  },
};
export const publicPath = '/';
export const assetsBuildDirectory = 'dist/client';
export const future = { v8_middleware: false, unstable_subResourceIntegrity: false, unstable_optimizeDeps: false, unstable_enableNodeReadableStream: true };
export const ssr = true;
export const isSpaMode = false;
export const prerender = [];
export const routeDiscovery = { mode: 'lazy', manifestPath: '/__manifest' };
`;
}

describe('@aklapper/node-runtime streaming SSR edge integration (unmocked)', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) await rm(dir, { recursive: true, force: true });
    }
  });

  async function startFixtureServer(source: string, loggerStream?: Writable) {
    const dir = await mkdtemp(join(tmpdir(), 'aklapper-ssr-int-'));
    tempDirs.push(dir);
    await mkdir(join(dir, 'client'), { recursive: true });
    await mkdir(join(dir, 'server'), { recursive: true });
    await writeFile(join(dir, 'server', 'index.js'), source, 'utf8');
    return createSsrServer({
      serviceName: 'portal-ssr',
      buildDir: dir,
      port: 0,
      host: '127.0.0.1',
      loggerStream,
    });
  }

  it('flushes initial HTML shell chunk before a 400ms delayed chunk completes with streaming and correlation headers', async () => {
    const server = await startFixtureServer(
      makeServerBuildModule(`
        const enc = new TextEncoder();
        const stream = new ReadableStream({
          start(c) {
            c.enqueue(enc.encode('<!doctype html><html><body><div id="shell">loading</div>'));
            setTimeout(() => { c.enqueue(enc.encode('<div id="deferred">ready</div></body></html>')); c.close(); }, 400);
          },
        });
        headers.set('content-type', 'text/html; charset=utf-8');
        return new Response(stream, { status: 200, headers });
      `),
    );
    const address = await server.start();
    try {
      const startedAt = Date.now();
      const res = await fetch(`${address}/`, {
        headers: { 'x-correlation-id': 'trace-shell-001' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('x-accel-buffering')).toBe('no');
      expect(res.headers.get('x-correlation-id')).toBe('trace-shell-001');

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      const first = await reader.read();
      expect(first.done).toBe(false);
      expect(decoder.decode(first.value)).toContain('<div id="shell">loading</div>');
      expect(Date.now() - startedAt).toBeLessThan(350);

      let rest = '';
      for (let next = await reader.read(); !next.done; next = await reader.read()) {
        rest += decoder.decode(next.value, { stream: true });
      }
      expect(rest).toContain('<div id="deferred">ready</div>');
    } finally {
      await server.app.close();
    }
  });

  it('preserves empty 204 bodies, raw binary PNG octets, incremental SSE streams, and duplicate-free Set-Cookie headers', async () => {
    const pngBytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0xfe, 0x80];
    const server = await startFixtureServer(
      makeServerBuildModule(`
        const path = new URL(request.url).pathname;
        if (path === '/empty') return new Response(null, { status: 204, headers: { 'x-empty': '1' } });
        if (path === '/binary.png') return new Response(Uint8Array.from(${JSON.stringify(pngBytes)}), { status: 200, headers: { 'content-type': 'image/png' } });
        if (path === '/cookies') {
          const h = new Headers({ 'content-type': 'text/plain' });
          h.append('set-cookie', 'a=1; Path=/');
          h.append('set-cookie', 'b=2; Path=/');
          return new Response('cookies-ok', { status: 200, headers: h });
        }
        if (path === '/sse') {
          const enc = new TextEncoder();
          const stream = new ReadableStream({
            start(c) {
              c.enqueue(enc.encode('data: part-1\\n\\n'));
              setTimeout(() => { c.enqueue(enc.encode('data: part-2\\n\\n')); c.close(); }, 80);
            },
          });
          return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
        }
        return new Response('ok', { status: 200 });
      `),
    );
    const address = await server.start();
    try {
      const emptyRes = await fetch(`${address}/empty`);
      expect(emptyRes.status).toBe(204);
      expect(await emptyRes.text()).toBe('');

      const binRes = await fetch(`${address}/binary.png`);
      expect(Buffer.compare(Buffer.from(await binRes.arrayBuffer()), Buffer.from(pngBytes))).toBe(
        0,
      );

      const cookieRes = await fetch(`${address}/cookies`);
      expect(cookieRes.headers.getSetCookie()).toEqual(['a=1; Path=/', 'b=2; Path=/']);

      const sseRes = await fetch(`${address}/sse`);
      expect(sseRes.headers.get('cache-control')).toBe('no-cache');
      expect(sseRes.headers.get('x-accel-buffering')).toBe('no');
      const reader = sseRes.body!.getReader();
      expect(new TextDecoder().decode((await reader.read()).value)).toContain('part-1');
      expect(new TextDecoder().decode((await reader.read()).value)).toContain('part-2');
      await reader.cancel();
    } finally {
      await server.app.close();
    }
  });

  it('aborts downstream signal on premature client disconnect without false-aborting multipart POST, and preserves HTTPS origin behind proxy', async () => {
    const abortFile = join(
      tmpdir(),
      `aklapper-abort-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`,
    );
    const server = await startFixtureServer(
      makeServerBuildModule(
        `
        if (new URL(request.url).pathname === '/slow-stream') {
          request.signal.addEventListener('abort', () => writeFileSync(${JSON.stringify(abortFile)}, 'aborted'));
          const enc = new TextEncoder();
          const stream = new ReadableStream({ start(c) { c.enqueue(enc.encode('chunk-0\\n')); } });
          return new Response(stream, { status: 200, headers: { 'content-type': 'text/plain' } });
        }
        return new Response('ok', { status: 200 });
      `,
        `import { writeFileSync } from 'node:fs';`,
      ),
    );
    const address = await server.start();
    try {
      const fd = new FormData();
      fd.set('name', 'Ada');
      const encoded = new Response(fd);
      const multipartBuf = Buffer.from(await encoded.arrayBuffer());

      const postRes = await server.app.inject({
        method: 'POST',
        url: '/submit',
        headers: {
          'content-type': encoded.headers.get('content-type')!,
          'x-forwarded-proto': 'https',
          host: 'andrew-k.us',
          origin: 'https://andrew-k.us',
        },
        payload: multipartBuf,
      });
      expect(postRes.statusCode).toBe(200);
      expect(postRes.json()).toEqual({
        protocol: 'https:',
        origin: 'https://andrew-k.us',
        abortedBefore: false,
        abortedAfter: false,
        parsedName: 'Ada',
      });

      const parsedAddress = new URL(address);
      await new Promise<void>((resolveDone, rejectDone) => {
        const req = http.request(
          {
            hostname: parsedAddress.hostname,
            port: Number(parsedAddress.port),
            path: '/slow-stream',
            method: 'GET',
          },
          res => {
            res.once('data', () => {
              req.destroy();
              resolveDone();
            });
          },
        );
        req.on('error', () => resolveDone());
        req.setTimeout(3_000, () => rejectDone(new Error('Timed out waiting for chunk-0')));
        req.end();
      });

      await new Promise(r => setTimeout(r, 100));
      expect(readFileSync(abortFile, 'utf8')).toBe('aborted');
    } finally {
      await rm(abortFile, { force: true });
      await server.app.close();
    }
  });

  it('preserves Symbol.for correlationId and Pino child logger across an independently imported ServerBuild realm without Fastify imports', async () => {
    const streamUrl = `${pathToFileURL(resolve(import.meta.dirname, '../src/stream.ts')).href}?realm=isolated-${Date.now()}`;
    const logs = createJsonLogCollector();
    for (const file of ['stream.ts', 'request-context.ts', 'stream-result.ts']) {
      expect(readFileSync(resolve(import.meta.dirname, '../src', file), 'utf8')).not.toMatch(
        /from\s+['"]@?fastify/,
      );
    }

    const server = await startFixtureServer(
      makeServerBuildModule(
        `
        const ctx = getRequestContext(loadContext);
        const cid = getOrCreateCorrelationId(request, loadContext);
        const settled = await deferStreamResult(
          Promise.reject(Object.assign(new Error('db down'), { code: '08006' })),
          { request, context: loadContext, source: 'isolated.realm.loader' },
        );
        return Response.json({ hasContext: ctx !== null, contextCid: ctx?.correlationId ?? null, cid, settled });
      `,
        `import { deferStreamResult, getOrCreateCorrelationId, getRequestContext } from ${JSON.stringify(streamUrl)};`,
      ),
      logs.stream,
    );
    try {
      const res = await server.app.inject({
        method: 'GET',
        url: '/',
        headers: { 'x-correlation-id': 'dual-realm-cid-42' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['x-correlation-id']).toBe('dual-realm-cid-42');
      expect(res.json()).toMatchObject({
        hasContext: true,
        contextCid: 'dual-realm-cid-42',
        cid: 'dual-realm-cid-42',
        settled: {
          ok: false,
          error: { code: 'ERR_DB_UNAVAILABLE', correlationId: 'dual-realm-cid-42' },
        },
      });
      expect(
        logs.records.find(
          r =>
            r['correlationId'] === 'dual-realm-cid-42' && r['errorCode'] === 'ERR_DB_UNAVAILABLE',
        ),
      ).toBeDefined();
    } finally {
      await server.app.close();
    }
  });

  it('extracts Cloud Run 32-hex X-Cloud-Trace-Context cleanly and logs UNSOUND_CONDITION for malformed headers', async () => {
    expect(
      extractCorrelationId({ 'x-cloud-trace-context': '105445aa7843bc8bf206b12000100000/1;o=1' }),
    ).toEqual({
      correlationId: '105445aa7843bc8bf206b12000100000',
      headerRejected: false,
    });
    expect(
      extractCorrelationId({ 'x-cloud-trace-context': 'not-a-valid-hex-trace/1;o=1' })
        .headerRejected,
    ).toBe(true);
    expect(extractCorrelationId({ 'x-request-id': 'bad\r\nid with spaces!!' }).headerRejected).toBe(
      true,
    );

    const logs = createJsonLogCollector();
    const server = await startFixtureServer(
      makeServerBuildModule(`return new Response('ok', { status: 200 });`),
      logs.stream,
    );
    try {
      const okRes = await server.app.inject({
        method: 'GET',
        url: '/',
        headers: { 'x-cloud-trace-context': '105445aa7843bc8bf206b12000100000/1;o=1' },
      });
      expect(okRes.headers['x-correlation-id']).toBe('105445aa7843bc8bf206b12000100000');
      expect(
        logs.records.filter(r => r['event'] === 'ssr.request.invalid_correlation_header'),
      ).toHaveLength(0);

      const badTrace = await server.app.inject({
        method: 'GET',
        url: '/',
        headers: { 'x-cloud-trace-context': 'not-a-valid-hex-trace/1;o=1' },
      });
      const badReq = await server.app.inject({
        method: 'GET',
        url: '/',
        headers: { 'x-request-id': 'bad id with spaces!!' },
      });
      expect(badTrace.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/i);
      expect(badReq.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/i);
      expect(
        logs.records.filter(
          r =>
            r['seam_type'] === 'UNSOUND_CONDITION' &&
            r['event'] === 'ssr.request.invalid_correlation_header',
        ),
      ).toHaveLength(2);
    } finally {
      await server.app.close();
    }
  });
});
