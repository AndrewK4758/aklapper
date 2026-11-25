import type {
  AskServiceStatus,
  ContactActionResult,
  PortalAskLoaderData,
  StreamResult,
} from '@aklapper/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PortalAskActionResult } from '#pages/ask';
import type { PortalCadenceActionResult } from '#pages/cadence';

import { createPortalPaneStreamStore, MAX_CACHED_PANE_ENVELOPES } from './portalPaneStreamStore';
import {
  createSingleFetchPaneTransport,
  type PaneLoadedEnvelope,
  type PaneStreamTransport,
  PORTAL_PANE_ROUTE_IDS,
  resetGuestSessionBarrierForTest,
  setActivePaneTransportForTest,
  submitPortalPaneAction,
} from './portalPaneTransport';
import type { PortalPaneRoute } from './portalWorkspaceSnapshot';

function createMockTransport(
  loadImpl: (
    routePath: PortalPaneRoute,
    signal: AbortSignal,
  ) => Promise<PaneLoadedEnvelope<unknown>>,
): {
  readonly loadSpy: ReturnType<
    typeof vi.fn<
      (routePath: PortalPaneRoute, signal: AbortSignal) => Promise<PaneLoadedEnvelope<unknown>>
    >
  >;
  readonly transport: PaneStreamTransport;
} {
  const loadSpy =
    vi.fn<
      (routePath: PortalPaneRoute, signal: AbortSignal) => Promise<PaneLoadedEnvelope<unknown>>
    >(loadImpl);
  const transport: PaneStreamTransport = {
    load: <T = unknown>(routePath: PortalPaneRoute, signal: AbortSignal) =>
      loadSpy(routePath, signal) as Promise<PaneLoadedEnvelope<T>>,
    submitAction: async <T = unknown>() => ({ ok: true }) as T,
  };
  return { loadSpy, transport };
}

describe('portalPaneStreamStore', () => {
  beforeEach(() => {
    resetGuestSessionBarrierForTest();
    setActivePaneTransportForTest(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetGuestSessionBarrierForTest();
    setActivePaneTransportForTest(null);
  });

  it('prewarms synchronously, stays idempotent across StrictMode double-calls, and isolates duplicate pane retries', async () => {
    let loadCount = 0;
    const signals = new Map<number, AbortSignal>();
    const { loadSpy, transport } = createMockTransport(async (_routePath, signal) => {
      loadCount += 1;
      signals.set(loadCount, signal);
      return {
        correlationId: `corr-${loadCount}`,
        payload: Promise.resolve<StreamResult<unknown>>({
          ok: true,
          data: { attempt: loadCount },
        }),
      };
    });

    const store = createPortalPaneStreamStore({ getTransport: () => transport });
    const prewarmed = store.prewarm('pane-2', '/cadence');
    const strictRender1 = store.getOrStart('pane-2', '/cadence');
    const strictRender2 = store.getOrStart('pane-2', '/cadence');

    expect(strictRender1).toBe(prewarmed);
    expect(strictRender2).toBe(prewarmed);
    expect(loadSpy).toHaveBeenCalledTimes(1);

    // Second duplicate /cadence pane gets its own isolated entry
    const pane3Entry = store.getOrStart('pane-3', '/cadence');
    expect(pane3Entry.key).toBe('pane-3:/cadence');
    expect(loadSpy).toHaveBeenCalledTimes(2);

    const pane2Listener = vi.fn<() => void>();
    const pane3Listener = vi.fn<() => void>();
    const unsub2 = store.subscribe('pane-2', '/cadence', pane2Listener);
    const unsub3 = store.subscribe('pane-3', '/cadence', pane3Listener);

    await prewarmed.payload;
    await pane3Entry.payload;
    pane2Listener.mockClear();
    pane3Listener.mockClear();

    // Retrying pane-2 does NOT disturb pane-3
    const retried = store.retry('pane-2', '/cadence');
    expect(retried.retryNonce).toBe(1);
    expect(signals.get(1)?.aborted).toBe(true);
    expect(signals.get(2)?.aborted).toBe(false);
    expect(pane2Listener).toHaveBeenCalled();
    expect(pane3Listener).not.toHaveBeenCalled();

    const retriedResult = await retried.payload;
    expect(retriedResult).toEqual({ ok: true, data: { attempt: 3 } });
    unsub2();
    unsub3();
  });

  it('aborts in-flight loads and evicts entries on evictPane and evictPaneViews (pane close & in-pane pop/exit)', () => {
    const abortSignals: AbortSignal[] = [];
    const { transport } = createMockTransport((_routePath, signal) => {
      abortSignals.push(signal);
      return new Promise(() => undefined);
    });

    const store = createPortalPaneStreamStore({ getTransport: () => transport });
    store.prewarm('pane-1', '/agensi');
    store.prewarm('pane-2', '/contact');
    expect(abortSignals).toHaveLength(2);
    expect(abortSignals[0]?.aborted).toBe(false);
    expect(abortSignals[1]?.aborted).toBe(false);

    // Popping in-pane view on pinned pane-1 aborts and evicts only pane-1:/agensi
    store.evictPaneViews([{ paneId: 'pane-1', routePath: '/agensi' }]);
    expect(abortSignals[0]?.aborted).toBe(true);
    expect(abortSignals[1]?.aborted).toBe(false);

    // Closing pane-2 aborts and evicts pane-2:/contact
    store.evictPane('pane-2');
    expect(abortSignals[1]?.aborted).toBe(true);
  });

  it('enforces LRU cap of MAX_CACHED_PANE_ENVELOPES (32) by aborting and evicting the oldest entry', () => {
    expect(MAX_CACHED_PANE_ENVELOPES).toBe(32);
    const signalsByPane = new Map<string, AbortSignal>();
    let currentPane = '';
    const { transport } = createMockTransport((_routePath, signal) => {
      signalsByPane.set(currentPane, signal);
      return new Promise(() => undefined);
    });

    const store = createPortalPaneStreamStore({ getTransport: () => transport });
    for (let idx = 1; idx <= MAX_CACHED_PANE_ENVELOPES + 1; idx += 1) {
      currentPane = `pane-${idx}`;
      store.prewarm(currentPane, '/agensi');
    }

    expect(signalsByPane.get('pane-1')?.aborted).toBe(true);
    expect(signalsByPane.get('pane-2')?.aborted).toBe(false);
    expect(signalsByPane.get(`pane-${MAX_CACHED_PANE_ENVELOPES + 1}`)?.aborted).toBe(false);
  });

  it('never evicts actively subscribed entries past MAX_CACHED_PANE_ENVELOPES while still evicting unsubscribed entries', () => {
    const signalsByPane = new Map<string, AbortSignal>();
    let currentPane = '';
    const { loadSpy, transport } = createMockTransport((_routePath, signal) => {
      signalsByPane.set(currentPane, signal);
      return new Promise(() => undefined);
    });

    const store = createPortalPaneStreamStore({ getTransport: () => transport });
    const unsubs: Array<() => void> = [];

    // Mount/subscribe 35 active pane views (> MAX_CACHED_PANE_ENVELOPES = 32)
    for (let idx = 1; idx <= MAX_CACHED_PANE_ENVELOPES + 3; idx += 1) {
      currentPane = `mounted-${idx}`;
      unsubs.push(store.subscribe(currentPane, '/agensi', () => undefined));
      store.getOrStart(currentPane, '/agensi');
    }

    // Zero subscribed entries were evicted or aborted; re-reading causes zero re-fetch thrash
    for (let idx = 1; idx <= MAX_CACHED_PANE_ENVELOPES + 3; idx += 1) {
      const paneId = `mounted-${idx}`;
      expect(signalsByPane.get(paneId)?.aborted).toBe(false);
      store.getOrStart(paneId, '/agensi');
    }
    expect(loadSpy).toHaveBeenCalledTimes(MAX_CACHED_PANE_ENVELOPES + 3);

    // Unsubscribe mounted-1 -> clears renderAccessed and immediately evicts mounted-1 via enforceLruCap
    unsubs[0]?.();
    expect(signalsByPane.get('mounted-1')?.aborted).toBe(true);
    expect(signalsByPane.get('mounted-2')?.aborted).toBe(false);

    for (const unsub of unsubs.slice(1)) unsub();
  });

  it('prevents self-eviction on prewarm -> getOrStart -> double getOrStart -> subscribe past 32 mounted panes', () => {
    const signalsByPane = new Map<string, AbortSignal>();
    let currentPane = '';
    const { loadSpy, transport } = createMockTransport((_routePath, signal) => {
      signalsByPane.set(currentPane, signal);
      return new Promise(() => undefined);
    });

    const store = createPortalPaneStreamStore({ getTransport: () => transport });
    const unsubs: Array<() => void> = [];

    for (let idx = 1; idx <= MAX_CACHED_PANE_ENVELOPES; idx += 1) {
      currentPane = `pane-${idx}`;
      store.getOrStart(currentPane, '/agensi');
      unsubs.push(store.subscribe(currentPane, '/agensi', () => undefined));
    }
    expect(loadSpy).toHaveBeenCalledTimes(MAX_CACHED_PANE_ENVELOPES);

    // 33rd pane: prewarm -> React render getOrStart -> React dev double getOrStart -> subscribe
    currentPane = 'pane-33';
    const prewarmed = store.prewarm('pane-33', '/agensi');
    const renderFirst = store.getOrStart('pane-33', '/agensi');
    const renderSecond = store.getOrStart('pane-33', '/agensi');
    unsubs.push(store.subscribe('pane-33', '/agensi', () => undefined));

    expect(renderFirst).toBe(prewarmed);
    expect(renderSecond).toBe(prewarmed);
    expect(loadSpy).toHaveBeenCalledTimes(MAX_CACHED_PANE_ENVELOPES + 1);
    for (let idx = 1; idx <= MAX_CACHED_PANE_ENVELOPES + 1; idx += 1) {
      expect(signalsByPane.get(`pane-${idx}`)?.aborted).toBe(false);
    }

    for (const unsub of unsubs) unsub();
  });

  it('preserves all entries across simultaneous 35-pane render-phase getOrStart before any subscribe runs', () => {
    const signalsByPane = new Map<string, AbortSignal>();
    let currentPane = '';
    const { loadSpy, transport } = createMockTransport((_routePath, signal) => {
      signalsByPane.set(currentPane, signal);
      return new Promise(() => undefined);
    });

    const store = createPortalPaneStreamStore({ getTransport: () => transport });
    const total = MAX_CACHED_PANE_ENVELOPES + 3;
    const renderEntries = [];

    // Phase 1: React renders all 35 panes before committing any subscribe() calls
    for (let idx = 1; idx <= total; idx += 1) {
      currentPane = `batch-${idx}`;
      renderEntries.push(store.getOrStart(currentPane, '/agensi'));
    }

    // Phase 2: React dev stability check (second getOrStart per pane) before subscribe
    for (let idx = 1; idx <= total; idx += 1) {
      expect(store.getOrStart(`batch-${idx}`, '/agensi')).toBe(renderEntries[idx - 1]);
    }
    expect(loadSpy).toHaveBeenCalledTimes(total);

    // Phase 3: React commits subscribe() on all 35 panes
    const unsubs: Array<() => void> = [];
    for (let idx = 1; idx <= total; idx += 1) {
      unsubs.push(store.subscribe(`batch-${idx}`, '/agensi', () => undefined));
      expect(signalsByPane.get(`batch-${idx}`)?.aborted).toBe(false);
    }

    // Unmounting batch-1..batch-3 releases them for immediate LRU eviction back to 32
    unsubs[0]?.();
    unsubs[1]?.();
    unsubs[2]?.();
    expect(signalsByPane.get('batch-1')?.aborted).toBe(true);
    expect(signalsByPane.get('batch-2')?.aborted).toBe(true);
    expect(signalsByPane.get('batch-3')?.aborted).toBe(true);
    expect(signalsByPane.get('batch-4')?.aborted).toBe(false);

    for (const unsub of unsubs.slice(3)) unsub();
  });

  it('guards SSR renders where window is undefined with zero module state mutation and emits UNSOUND_CONDITION telemetry', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { loadSpy, transport } = createMockTransport(async () => ({
      correlationId: 'never',
      payload: Promise.resolve({ ok: true as const, data: null }),
    }));

    const store = createPortalPaneStreamStore({ getTransport: () => transport });
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    try {
      const snap1 = store.getServerSnapshot('pane-1', '/agensi');
      const snap2 = store.getServerSnapshot('pane-1', '/agensi');
      expect(snap1).toBe(snap2);
      store.prewarm('pane-1', '/agensi');
      store.retry('pane-1', '/agensi');
      store.evictPane('pane-1');
      store.evictPaneViews([{ paneId: 'pane-1', routePath: '/agensi' }]);
      store.getOrStart('pane-1', '/agensi');
      expect(loadSpy).not.toHaveBeenCalled();
      const ssrWarns = warnSpy.mock.calls
        .map(args => String(args[0] ?? ''))
        .filter(msg => msg.includes('portal.workspace.ssr_mutation_blocked'));
      expect(ssrWarns).toHaveLength(4);
    } finally {
      Object.defineProperty(globalThis, 'window', {
        value: originalWindow,
        configurable: true,
        writable: true,
      });
    }
  });
});

describe('portalPaneTransport single-fetch behavior', () => {
  beforeEach(() => {
    resetGuestSessionBarrierForTest();
    setActivePaneTransportForTest(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetGuestSessionBarrierForTest();
    setActivePaneTransportForTest(null);
  });

  it('serializes only the cold-session response-header handshake across concurrent /chat and /cadence loads', async () => {
    const firstHeaders = Promise.withResolvers<Response>();
    const secondHeaders = Promise.withResolvers<Response>();
    const requestedUrls: string[] = [];

    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      input => {
        const url = String(input);
        requestedUrls.push(url);
        if (requestedUrls.length === 1) {
          return firstHeaders.promise;
        }
        return secondHeaders.promise;
      },
    );

    const transport = createSingleFetchPaneTransport({
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const controllerA = new AbortController();
    const controllerB = new AbortController();
    const chatLoad = transport.load('/chat', controllerA.signal);
    const cadenceLoad = transport.load('/cadence', controllerB.signal);

    // Second request must wait until first response headers arrive
    await Promise.resolve();
    expect(requestedUrls).toHaveLength(1);
    expect(requestedUrls[0]).toContain('/chat.data?pane=1&_routes=routes%2Fchat');

    // Resolve first response headers (502 short-circuit still releases barrier after headers arrive)
    firstHeaders.resolve(
      new Response('upstream error', {
        status: 502,
        headers: { 'Set-Cookie': 'ak_guest_session=abc; HttpOnly' },
      }),
    );

    await vi.waitFor(() => {
      expect(requestedUrls).toHaveLength(2);
    });
    expect(requestedUrls[1]).toContain('/cadence.data?pane=1&_routes=routes%2Fcadence');

    secondHeaders.resolve(new Response('upstream error', { status: 502 }));
    const [chatEnv, cadenceEnv] = await Promise.all([chatLoad, cadenceLoad]);
    const chatSettled = await chatEnv.payload;
    const cadenceSettled = await cadenceEnv.payload;
    expect(chatSettled.ok).toBe(false);
    expect(cadenceSettled.ok).toBe(false);
  });

  it('does not latch guestSessionPrimed on bare proxy HTTP 502 so pane 2 becomes the next leader while pane 3 still waits', async () => {
    const resp1 = Promise.withResolvers<Response>();
    const resp2 = Promise.withResolvers<Response>();
    const resp3 = Promise.withResolvers<Response>();
    const requestedUrls: string[] = [];

    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      input => {
        requestedUrls.push(String(input));
        if (requestedUrls.length === 1) return resp1.promise;
        if (requestedUrls.length === 2) return resp2.promise;
        return resp3.promise;
      },
    );

    const transport = createSingleFetchPaneTransport({
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const load1 = transport.load('/chat', new AbortController().signal);
    const load2 = transport.load('/cadence', new AbortController().signal);
    const load3 = transport.load('/chat', new AbortController().signal);

    // Only pane 1 is dispatched initially
    await Promise.resolve();
    expect(requestedUrls).toHaveLength(1);

    // Pane 1 receives a bare proxy HTTP 502 (no X-Remix-Response) -> must NOT set guestSessionPrimed
    resp1.resolve(new Response('<html>502 Bad Gateway</html>', { status: 502 }));

    await vi.waitFor(() => {
      expect(requestedUrls).toHaveLength(2);
    });
    // Yield extra microtasks: pane 3 MUST remain gated while pane 2 is the new cold-session leader!
    await Promise.resolve();
    await Promise.resolve();
    expect(requestedUrls).toHaveLength(2);

    // Pane 2 returns HTTP 200 (Fastify SSR handled) -> latches guestSessionPrimed and ungates pane 3
    resp2.resolve(
      new Response('[]\n', {
        status: 200,
        headers: { 'X-Remix-Response': 'yes', 'Set-Cookie': 'ak_guest_session=ok; HttpOnly' },
      }),
    );

    await vi.waitFor(() => {
      expect(requestedUrls).toHaveLength(3);
    });

    resp3.resolve(new Response('[]\n', { status: 200, headers: { 'X-Remix-Response': 'yes' } }));
    await Promise.all([load1, load2, load3]);
  });

  it('classifies bare HTTP 502, HTTP 204 redirect, and offline errors fail-closed for submitPortalPaneAction across contact, chat, and cadence', async () => {
    expect(PORTAL_PANE_ROUTE_IDS['/contact']).toBe('routes/contact');

    const transport502 = createSingleFetchPaneTransport({
      fetchImpl: (async () =>
        new Response('<html>502 Bad Gateway</html>', {
          status: 502,
          headers: { 'content-type': 'text/html' },
        })) as unknown as typeof fetch,
    });
    setActivePaneTransportForTest(transport502);

    const contactFd = new FormData();
    contactFd.set('name', 'Ada');
    const contactRes = await submitPortalPaneAction<ContactActionResult>('/contact', contactFd);
    expect(contactRes).toMatchObject({
      ok: false,
      source: 'server',
      code: 'ERR_UPSTREAM_UNAVAILABLE',
      fieldErrors: {},
    });
    expect(JSON.stringify(contactRes)).not.toContain('502 Bad Gateway');

    const askFd = new FormData();
    askFd.set('mode', 'jd_match');
    const askRes = await submitPortalPaneAction<PortalAskActionResult>('/chat', askFd);
    expect(askRes).toMatchObject({
      ok: false,
      mode: 'jd_match',
      code: 'ERR_UPSTREAM_UNAVAILABLE',
    });

    const cadenceFd = new FormData();
    cadenceFd.set('intent', 'gate');
    const cadenceRes = await submitPortalPaneAction<PortalCadenceActionResult>(
      '/cadence',
      cadenceFd,
    );
    expect(cadenceRes).toMatchObject({
      ok: false,
      intent: 'gate',
      code: 'ERR_UPSTREAM_UNAVAILABLE',
    });

    // HTTP 204 X-Remix-Redirect on POST fails closed
    const transportRedirect = createSingleFetchPaneTransport({
      fetchImpl: (async () =>
        new Response(null, {
          status: 204,
          headers: { 'X-Remix-Redirect': '/login', 'X-Remix-Status': '302' },
        })) as unknown as typeof fetch,
    });
    setActivePaneTransportForTest(transportRedirect);
    const redirectRes = await submitPortalPaneAction<ContactActionResult>('/contact', contactFd);
    expect(redirectRes.ok).toBe(false);

    // Offline TypeError fails closed without throwing
    const transportOffline = createSingleFetchPaneTransport({
      fetchImpl: (async () => {
        throw new TypeError('Failed to fetch: internal socket refused');
      }) as unknown as typeof fetch,
    });
    setActivePaneTransportForTest(transportOffline);
    const offlineRes = await submitPortalPaneAction<PortalAskActionResult>('/chat', askFd);
    expect(offlineRes).toMatchObject({
      ok: false,
      code: 'ERR_UPSTREAM_UNAVAILABLE',
    });
    expect(JSON.stringify(offlineRes)).not.toContain('internal socket refused');
  });

  it('attaches eager fail-closed catch settlement to both payload and askStatusPayload without unhandled rejection', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);

    try {
      const payloadRejected = Promise.reject<StreamResult<PortalAskLoaderData>>(
        new Error('mid-stream payload drop'),
      );
      const statusRejected = Promise.reject<StreamResult<AskServiceStatus | undefined>>(
        new Error('mid-stream status drop'),
      );
      const transport: PaneStreamTransport = {
        load: async () => ({
          correlationId: 'corr-eager-catch',
          payload: payloadRejected,
          askStatusPayload: statusRejected,
        }),
        submitAction: async () => ({ ok: false }) as never,
      };
      const store = createPortalPaneStreamStore({ getTransport: () => transport });
      const entry = store.prewarm('pane-1', '/chat');
      const settledPayload = await entry.payload;
      expect(settledPayload.ok).toBe(false);
      await new Promise(resolveTimer => {
        setTimeout(resolveTimer, 20);
      });
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
