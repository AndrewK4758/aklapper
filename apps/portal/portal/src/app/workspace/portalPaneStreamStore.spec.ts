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
  type PaneStreamTransport,
  PORTAL_PANE_ROUTE_IDS,
  resetGuestSessionBarrierForTest,
  setActivePaneTransportForTest,
  submitPortalPaneAction,
} from './portalPaneTransport';

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
    const transport: PaneStreamTransport = {
      load: vi.fn<PaneStreamTransport['load']>(async (_routePath, signal) => {
        loadCount += 1;
        signals.set(loadCount, signal);
        return {
          correlationId: `corr-${loadCount}`,
          payload: Promise.resolve<StreamResult<never>>({
            ok: true,
            data: { attempt: loadCount } as never,
          }),
        };
      }),
      submitAction: vi.fn<PaneStreamTransport['submitAction']>(async () => ({ ok: true }) as never),
    };

    const store = createPortalPaneStreamStore({ getTransport: () => transport });
    const prewarmed = store.prewarm('pane-2', '/cadence');
    const strictRender1 = store.getOrStart('pane-2', '/cadence');
    const strictRender2 = store.getOrStart('pane-2', '/cadence');

    expect(strictRender1).toBe(prewarmed);
    expect(strictRender2).toBe(prewarmed);
    expect(transport.load).toHaveBeenCalledTimes(1);

    // Second duplicate /cadence pane gets its own isolated entry
    const pane3Entry = store.getOrStart('pane-3', '/cadence');
    expect(pane3Entry.key).toBe('pane-3:/cadence');
    expect(transport.load).toHaveBeenCalledTimes(2);

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
    const transport: PaneStreamTransport = {
      load: vi.fn<PaneStreamTransport['load']>((_routePath, signal) => {
        abortSignals.push(signal);
        return new Promise(() => undefined);
      }),
      submitAction: vi.fn<PaneStreamTransport['submitAction']>(async () => ({ ok: true }) as never),
    };

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
    const transport: PaneStreamTransport = {
      load: vi.fn<PaneStreamTransport['load']>((_routePath, signal) => {
        signalsByPane.set(currentPane, signal);
        return new Promise(() => undefined);
      }),
      submitAction: vi.fn<PaneStreamTransport['submitAction']>(async () => ({ ok: true }) as never),
    };

    const store = createPortalPaneStreamStore({ getTransport: () => transport });
    for (let idx = 1; idx <= MAX_CACHED_PANE_ENVELOPES + 1; idx += 1) {
      currentPane = `pane-${idx}`;
      store.prewarm(currentPane, '/agensi');
    }

    expect(signalsByPane.get('pane-1')?.aborted).toBe(true);
    expect(signalsByPane.get('pane-2')?.aborted).toBe(false);
    expect(signalsByPane.get(`pane-${MAX_CACHED_PANE_ENVELOPES + 1}`)?.aborted).toBe(false);
  });

  it('guards SSR renders where window is undefined with zero module state mutation', () => {
    const transport: PaneStreamTransport = {
      load: vi.fn<PaneStreamTransport['load']>(async () => ({
        correlationId: 'never',
        payload: Promise.resolve({ ok: true as const, data: null as never }),
      })),
      submitAction: vi.fn<PaneStreamTransport['submitAction']>(async () => ({ ok: true }) as never),
    };

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
      store.getOrStart('pane-1', '/agensi');
      expect(transport.load).not.toHaveBeenCalled();
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
