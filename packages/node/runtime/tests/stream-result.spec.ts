import { createElement, Suspense, use } from 'react';
import {
  createStaticHandler,
  RouterContextProvider,
  type EntryContext,
  type StaticHandlerContext,
} from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEntryServer, handleError } from '../src/entry-server.ts';
import {
  DEFAULT_STREAM_DEADLINE_MS,
  deferStreamResult,
  requestContextKey,
  resolveStreamDeadlineMs,
  type SsrStructuredLogger,
} from '../src/stream.ts';

interface CapturedLog {
  readonly level: 'info' | 'warn' | 'error';
  readonly obj: Record<string, unknown>;
}

function createMemoryLogger() {
  const logs: CapturedLog[] = [];
  const logger: SsrStructuredLogger = {
    info: obj => logs.push({ level: 'info', obj }),
    warn: obj => logs.push({ level: 'warn', obj }),
    error: obj => logs.push({ level: 'error', obj }),
  };
  return { logger, logs };
}

function makeLoadContext(correlationId: string, logger: SsrStructuredLogger, signal: AbortSignal) {
  const ctx = new RouterContextProvider();
  ctx.set(requestContextKey, { correlationId, logger, serviceName: 'portal-ssr', signal });
  return ctx;
}

async function createDeferredEntryContext(deferred: Promise<string>): Promise<EntryContext> {
  const DeferredBody = () => createElement('div', { id: 'resolved' }, use(deferred));
  const Root = () =>
    createElement(
      'html',
      null,
      createElement(
        'body',
        null,
        createElement('div', { id: 'shell' }, 'shell-ready'),
        createElement(
          Suspense,
          { fallback: createElement('div', { id: 'loading' }, 'loading-fallback') },
          createElement(DeferredBody),
        ),
      ),
    );
  const handler = createStaticHandler([{ id: 'root', path: '/', Component: Root }]);
  const staticCtx = (await handler.query(new Request('http://localhost/'))) as StaticHandlerContext;
  const routeEntry = Object.assign(
    { id: 'root', path: '/', module: '/root.js' },
    { hasAction: false, hasLoader: false, hasClientAction: false, hasClientLoader: false },
    { hasClientMiddleware: false, hasErrorBoundary: false },
  );
  return {
    manifest: {
      version: '1',
      entry: { module: '/entry.js', imports: [] },
      routes: { root: routeEntry },
    },
    routeModules: { root: { default: Root } },
    staticHandlerContext: staticCtx,
    serverHandoffString: '',
    future: { v8_middleware: false, unstable_enableNodeReadableStream: true },
    ssr: true,
    isSpaMode: false,
    routeDiscovery: { mode: 'lazy', manifestPath: '/__manifest' },
  } as unknown as EntryContext;
}

describe('@aklapper/node-runtime entry-server and deferStreamResult', () => {
  const origPrerender = process.env['IS_RR_BUILD_REQUEST'];
  const origDeadline = process.env['SSR_STREAM_DEADLINE_MS'];

  afterEach(() => {
    if (origPrerender === undefined) delete process.env['IS_RR_BUILD_REQUEST'];
    else process.env['IS_RR_BUILD_REQUEST'] = origPrerender;
    if (origDeadline === undefined) delete process.env['SSR_STREAM_DEADLINE_MS'];
    else process.env['SSR_STREAM_DEADLINE_MS'] = origDeadline;
    vi.restoreAllMocks();
  });

  it('streams shell immediately for browsers and waits for onAllReady for bots and authentic prerender while recording render mode branches', async () => {
    const entry = createEntryServer({ streamTimeout: 5_000 });
    const { logger, logs } = createMemoryLogger();

    const browserDeferred = Promise.withResolvers<string>();
    const browserReq = new Request('http://localhost/', {
      headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0' },
    });
    const browserRes = await entry.handleRequest(
      browserReq,
      200,
      new Headers(),
      await createDeferredEntryContext(browserDeferred.promise),
      makeLoadContext('cid-browser', logger, browserReq.signal),
    );
    expect(browserRes.headers.get('x-correlation-id')).toBe('cid-browser');
    const reader = browserRes.body!.getReader();
    const decoder = new TextDecoder();
    const firstChunk = decoder.decode((await reader.read()).value);
    expect(firstChunk).toContain('shell-ready');
    expect(firstChunk).toContain('loading-fallback');
    browserDeferred.resolve('BROWSER-DATA');
    let browserRest = '';
    for (let next = await reader.read(); !next.done; next = await reader.read()) {
      browserRest += decoder.decode(next.value, { stream: true });
    }
    expect(browserRest).toContain('BROWSER-DATA');

    const botReq = new Request('http://localhost/', {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
    });
    const botHtml = await (
      await entry.handleRequest(
        botReq,
        200,
        new Headers(),
        await createDeferredEntryContext(new Promise(r => setTimeout(() => r('BOT-DATA'), 50))),
        makeLoadContext('cid-bot', logger, botReq.signal),
      )
    ).text();
    expect(botHtml).toContain('BOT-DATA');
    expect(botHtml).not.toContain('loading-fallback');

    process.env['IS_RR_BUILD_REQUEST'] = 'yes';
    const preReq = new Request('http://localhost/', {
      headers: { 'x-react-router-prerender': 'yes' },
    });
    const preHtml = await (
      await entry.handleRequest(
        preReq,
        200,
        new Headers(),
        await createDeferredEntryContext(
          new Promise(r => setTimeout(() => r('PRERENDER-DATA'), 50)),
        ),
        makeLoadContext('cid-prerender', logger, preReq.signal),
      )
    ).text();
    expect(preHtml).toContain('PRERENDER-DATA');
    expect(preHtml).not.toContain('loading-fallback');

    expect(
      logs
        .filter(l => l.obj['event'] === 'ssr.entry.render_mode_selected')
        .map(l => l.obj['branch']),
    ).toEqual(['onShellReady', 'onAllReady_bot', 'onAllReady_prerender']);
  });

  it('ignores spoofed x-react-router-prerender header in runtime production and emits UNSOUND_CONDITION warning', async () => {
    delete process.env['IS_RR_BUILD_REQUEST'];
    const entry = createEntryServer({ streamTimeout: 5_000 });
    const { logger, logs } = createMemoryLogger();

    const deferred = Promise.withResolvers<string>();
    const req = new Request('http://localhost/', {
      headers: { 'user-agent': 'Mozilla/5.0 Firefox/130.0', 'x-react-router-prerender': 'yes' },
    });
    const res = await entry.handleRequest(
      req,
      200,
      new Headers(),
      await createDeferredEntryContext(deferred.promise),
      makeLoadContext('cid-spoof', logger, req.signal),
    );
    const reader = res.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain('loading-fallback');
    deferred.resolve('DONE');
    await reader.cancel();

    expect(
      logs.find(
        l =>
          l.level === 'warn' &&
          l.obj['seam_type'] === 'UNSOUND_CONDITION' &&
          l.obj['event'] === 'ssr.entry.spoofed_prerender_header',
      ),
    ).toBeDefined();
    expect(
      logs.find(
        l =>
          l.obj['event'] === 'ssr.entry.render_mode_selected' && l.obj['branch'] === 'onShellReady',
      ),
    ).toBeDefined();
  });

  it('logs classified structured JSON in handleError and suppresses aborted request signals', () => {
    const { logger, logs } = createMemoryLogger();
    const activeCtrl = new AbortController();
    handleError(
      Object.assign(new Error('Failed query: SELECT * FROM menu_items'), { code: '08006' }),
      {
        request: new Request('http://localhost/menu', {
          headers: { 'x-correlation-id': 'corr-abc-123' },
          signal: activeCtrl.signal,
        }),
        params: {},
        context: makeLoadContext('corr-abc-123', logger, activeCtrl.signal),
      },
    );

    expect(logs).toHaveLength(1);
    expect(logs[0]?.level).toBe('error');
    expect(logs[0]?.obj).toMatchObject({
      severity: 'ERROR',
      errorCode: 'ERR_DB_UNAVAILABLE',
      httpStatus: 503,
      correlationId: 'corr-abc-123',
    });
    expect(JSON.stringify(logs[0]?.obj)).not.toContain('SELECT * FROM menu_items');

    const abortedCtrl = new AbortController();
    abortedCtrl.abort(new DOMException('Client disconnected', 'AbortError'));
    handleError(new Error('aborted downstream'), {
      request: new Request('http://localhost/menu', { signal: abortedCtrl.signal }),
      params: {},
      context: makeLoadContext('corr-aborted', logger, abortedCtrl.signal),
    });
    expect(logs).toHaveLength(1);
  });

  it('short-circuits pre-aborted requests with 499 and zero timers, and aborts mid-stream cleanly without ERROR logs', async () => {
    const entry = createEntryServer({ streamTimeout: 5_000 });
    const { logger, logs } = createMemoryLogger();

    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const preAborted = new AbortController();
    preAborted.abort(new DOMException('Gone', 'AbortError'));
    const preRes = await entry.handleRequest(
      new Request('http://localhost/', { signal: preAborted.signal }),
      200,
      new Headers(),
      {} as EntryContext,
      makeLoadContext('cid-pre-abort', logger, preAborted.signal),
    );
    expect(preRes.status).toBe(499);
    expect(preRes.body).toBeNull();
    expect(preRes.headers.get('x-correlation-id')).toBe('cid-pre-abort');
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    setTimeoutSpy.mockRestore();

    const midCtrl = new AbortController();
    const midRes = await entry.handleRequest(
      new Request('http://localhost/', {
        headers: { 'user-agent': 'Mozilla/5.0 Chrome/130' },
        signal: midCtrl.signal,
      }),
      200,
      new Headers(),
      await createDeferredEntryContext(new Promise<string>(() => undefined)),
      makeLoadContext('cid-mid-abort', logger, midCtrl.signal),
    );
    const reader = midRes.body!.getReader();
    await reader.read();
    midCtrl.abort(new DOMException('Client closed', 'AbortError'));
    await reader.cancel().catch(() => undefined);
    await new Promise(r => setTimeout(r, 30));
    expect(logs.filter(l => l.level === 'error')).toHaveLength(0);
  });

  it('validates SSR_STREAM_DEADLINE_MS defensively, cleans up timer and abort listener, logs WARN on abort, bypasses on prerender, and emits DELTA_AUDIT_GAP fallback', async () => {
    for (const raw of ['', '   ', '0', '-500', 'not-a-number']) {
      expect(resolveStreamDeadlineMs(undefined, 5_000, { SSR_STREAM_DEADLINE_MS: raw })).toBe(
        DEFAULT_STREAM_DEADLINE_MS,
      );
    }
    expect(resolveStreamDeadlineMs(undefined, 5_000, { SSR_STREAM_DEADLINE_MS: '999999' })).toBe(
      4_750,
    );

    const { logger, logs } = createMemoryLogger();
    const ctrl = new AbortController();
    const removeSpy = vi.spyOn(ctrl.signal, 'removeEventListener');
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    const req = new Request('http://localhost/menu', { signal: ctrl.signal });
    const ctx = makeLoadContext('cid-clean', logger, ctrl.signal);

    expect(
      await deferStreamResult(Promise.resolve({ count: 3 }), {
        request: req,
        context: ctx,
        source: 'portal.menu.loader',
        deadlineMs: 200,
      }),
    ).toEqual({ ok: true, data: { count: 3 } });
    expect(clearSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));

    const slowRes = await deferStreamResult(new Promise<string>(() => undefined), {
      request: req,
      context: ctx,
      source: 'portal.menu.loader',
      deadlineMs: 40,
    });
    expect(slowRes).toMatchObject({
      ok: false,
      error: { code: 'ERR_STREAM_TIMEOUT', status: 504, correlationId: 'cid-clean' },
    });
    expect(
      logs.find(
        l => l.obj['errorCode'] === 'ERR_STREAM_TIMEOUT' && l.obj['correlationId'] === 'cid-clean',
      ),
    ).toBeDefined();

    const abortCtrl = new AbortController();
    const abortLogs = createMemoryLogger();
    const abortPromise = deferStreamResult(new Promise<string>(() => undefined), {
      request: new Request('http://localhost/menu', { signal: abortCtrl.signal }),
      context: makeLoadContext('cid-abort-warn', abortLogs.logger, abortCtrl.signal),
      source: 'portal.menu.loader',
      deadlineMs: 500,
    });
    abortCtrl.abort(new DOMException('Client disconnected', 'AbortError'));
    expect((await abortPromise).ok).toBe(false);
    expect(abortLogs.logs[0]?.level).toBe('warn');
    expect(abortLogs.logs[0]?.obj['errorCode']).toBe('ERR_STREAM_ABORTED');

    const stderrChunks: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation(chunk => {
      stderrChunks.push(String(chunk));
      return true;
    });
    const failLog = () => {
      throw new Error('sink offline');
    };
    const brokenRes = await deferStreamResult(Promise.reject(new Error('boom')), {
      request: new Request('http://localhost/menu'),
      context: makeLoadContext(
        'cid-gap',
        { info: failLog, warn: failLog, error: failLog },
        new AbortController().signal,
      ),
      source: 'portal.menu.loader',
    });
    expect(brokenRes.ok).toBe(false);
    expect(JSON.parse(stderrChunks.join('').trim())).toMatchObject({
      severity: 'CRITICAL',
      seam_type: 'DELTA_AUDIT_GAP',
      event: 'ssr.stream.deferred_failure_unlogged',
      correlationId: 'cid-gap',
    });

    process.env['IS_RR_BUILD_REQUEST'] = 'yes';
    const prerenderResult = await deferStreamResult(
      new Promise<string>(resolve => setTimeout(() => resolve('prerender-ok'), 40)),
      {
        request: new Request('http://localhost/', {
          headers: { 'x-react-router-prerender': 'yes' },
        }),
        context: ctx,
        source: 'portal.root.loader',
        deadlineMs: 10,
      },
    );
    expect(prerenderResult).toEqual({ ok: true, data: 'prerender-ok' });
  });

  it('logs post-shell Suspense render errors on onAllReady crawler requests', async () => {
    const entry = createEntryServer({ streamTimeout: 5_000 });
    const { logger, logs } = createMemoryLogger();
    const rejected = Promise.reject(new Error('suspense render exploded'));
    rejected.catch(() => undefined);
    const botReq = new Request('http://localhost/', {
      headers: { 'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' },
    });
    const res = await entry.handleRequest(
      botReq,
      200,
      new Headers(),
      await createDeferredEntryContext(rejected),
      makeLoadContext('cid-bot-suspense-err', logger, botReq.signal),
    );
    await res.text();
    expect(res.status).toBe(500);
    expect(
      logs.find(
        l =>
          l.level === 'error' &&
          l.obj['source'] === 'ssr.entry.onError' &&
          l.obj['correlationId'] === 'cid-bot-suspense-err',
      ),
    ).toBeDefined();
  });
});
