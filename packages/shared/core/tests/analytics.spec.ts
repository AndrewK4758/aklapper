// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  bootstrapDocumentAnalytics,
  createAnalyticsClient,
  getActiveAnalyticsClient,
  getActiveAnalyticsSessionId,
  isPrivacyOptOut,
  resetAnalyticsBootstrap,
  subscribeAnalyticsSessionId,
  trackPaneOpen,
  trackProfileOutboundClick,
  trackRouteNavigation,
  trackTerminalCommand,
} from '../src/analytics.ts';
import {
  AdminInboxItemSchema,
  AnalyticsBatchSchema,
  parseAdminAnalyticsFilter,
  type AnalyticsBatch,
} from '../src/index.ts';

describe('@aklapper/core/analytics', () => {
  afterEach(() => {
    resetAnalyticsBootstrap();
    Object.defineProperty(navigator, 'doNotTrack', { value: null, configurable: true });
    Object.defineProperty(navigator, 'globalPrivacyControl', {
      value: undefined,
      configurable: true,
    });
    document.head.innerHTML = '';
    window.history.replaceState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('batches and flushes first-party events cleanly, including manual flush', () => {
    const sent: AnalyticsBatch[] = [];
    const client = createAnalyticsClient({
      endpoint: '/api/analytics/ingest',
      respectPrivacySignals: false,
      maxBatchSize: 2,
      transport: (_url, payload) => sent.push(payload),
    });

    // Empty flush is a no-op
    client.flush();
    expect(sent).toHaveLength(0);

    client.track({ type: 'page_view', name: 'greeter', path: '/' });
    expect(sent).toHaveLength(0);

    client.track({ type: 'interaction', name: 'guest_login', path: '/' });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.events).toHaveLength(2);
    expect(sent[0]?.sessionId).toBe(client.sessionId);

    // Partial batch flushed manually
    client.track({ type: 'interaction', name: 'contact_open', path: '/contact' });
    expect(sent).toHaveLength(1);
    client.flush();
    expect(sent).toHaveLength(2);
    expect(sent[1]?.events).toHaveLength(1);
  });

  it('respects DNT and Global Privacy Control opt-out signals by default', () => {
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
    expect(isPrivacyOptOut()).toBe(true);

    const transport = vi.fn<(endpoint: string, payload: AnalyticsBatch) => void>();
    const optedOut = createAnalyticsClient({
      endpoint: '/api/analytics/ingest',
      transport,
    });
    expect(optedOut.enabled).toBe(false);
    optedOut.track({ type: 'page_view', name: 'ignored', path: '/' });
    optedOut.flush();
    expect(transport).not.toHaveBeenCalled();

    Object.defineProperty(navigator, 'doNotTrack', { value: null, configurable: true });
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
    expect(isPrivacyOptOut()).toBe(true);
  });

  it('bootstraps analytics from document meta tags, tracks SPA history transitions, and exposes active client', () => {
    expect(bootstrapDocumentAnalytics(document)).toBeNull();
    expect(getActiveAnalyticsClient()).toBeNull();

    const metaEndpoint = document.createElement('meta');
    metaEndpoint.name = 'aklapper-analytics-endpoint';
    metaEndpoint.content = '/api/analytics/ingest';
    const metaApp = document.createElement('meta');
    metaApp.name = 'aklapper-analytics-app';
    metaApp.content = 'portal';
    document.head.append(metaEndpoint, metaApp);

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));

    const client = bootstrapDocumentAnalytics(document);
    expect(client).not.toBeNull();
    expect(client?.enabled).toBe(true);
    expect(getActiveAnalyticsClient()).toBe(client);

    // SPA route transition via History pushState and explicit helper
    window.history.pushState({}, '', '/menu');
    // Duplicate push to same path is deduplicated
    trackRouteNavigation('/menu');
    trackRouteNavigation('/contact');

    // Triggering pagehide flushes initial + SPA page_view events
    window.dispatchEvent(new Event('pagehide'));
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/analytics/ingest',
      expect.objectContaining({ method: 'POST' }),
    );
    const bodyArg = fetchSpy.mock.calls[0]?.[1]?.body;
    const parsed = JSON.parse(String(bodyArg)) as AnalyticsBatch;
    expect(parsed.events.map(e => e.path)).toEqual(['/', '/menu', '/contact']);
    expect(parsed.events[0]?.metadata).toEqual({ app: 'portal', navigation: 'initial' });
  });

  it('flushes initial page views promptly via debounce while batching web_vital samples and reconciles authoritative sessionId without storage', async () => {
    vi.useFakeTimers();
    try {
      window.history.replaceState(
        {},
        '',
        '/?ref=recruiter&utm_source=linkedin&utm_medium=social&utm_campaign=fall26&utm_content=bio&secret=dropme',
      );
      const metaEndpoint = document.createElement('meta');
      metaEndpoint.name = 'aklapper-analytics-endpoint';
      metaEndpoint.content = '/api/analytics/ingest';
      const metaApp = document.createElement('meta');
      metaApp.name = 'aklapper-analytics-app';
      metaApp.content = 'portal';
      document.head.append(metaEndpoint, metaApp);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            accepted: 1,
            sessionId: 'sess_server_canonical_123',
            ipHash: 'hash_abc',
          }),
          { status: 202, headers: { 'content-type': 'application/json' } },
        ),
      );

      const listener = vi.fn<() => void>();
      const unsubscribe = subscribeAnalyticsSessionId(listener);

      const client = bootstrapDocumentAnalytics(document);
      expect(client).not.toBeNull();
      const initialSessionId = client?.sessionId;
      expect(getActiveAnalyticsSessionId()).toBe(initialSessionId);

      // Prompt debounce has not elapsed yet
      expect(fetchSpy).not.toHaveBeenCalled();

      // Advance past the 300ms prompt flush debounce
      await vi.advanceTimersByTimeAsync(350);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const firstBody = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body)) as AnalyticsBatch;
      expect(firstBody.landingPath).toBe('/');
      expect(firstBody.refParam).toBe('recruiter');
      expect(firstBody.utmSource).toBe('linkedin');
      expect(firstBody.utmMedium).toBe('social');
      expect(firstBody.utmCampaign).toBe('fall26');
      expect(firstBody.utmContent).toBe('bio');
      expect(JSON.stringify(firstBody)).not.toContain('dropme');
      expect(firstBody.events[0]?.metadata).toEqual({ app: 'portal', navigation: 'initial' });

      // Authoritative server sessionId reconciled strictly in memory (zero cookies/storage)
      expect(client?.sessionId).toBe('sess_server_canonical_123');
      expect(getActiveAnalyticsSessionId()).toBe('sess_server_canonical_123');
      expect(listener).toHaveBeenCalled();
      expect(document.cookie).toBe('');
      expect(window.localStorage.length).toBe(0);
      expect(window.sessionStorage.length).toBe(0);

      // Non-urgent web_vital events stay batched below maxBatchSize
      client?.track({ type: 'web_vital', name: 'LCP', path: '/', value: 1200 });
      await vi.advanceTimersByTimeAsync(1000);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Interactive pane opens also flush promptly after the debounce window
      trackPaneOpen('/about', 'desktop');
      await vi.advanceTimersByTimeAsync(350);
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      unsubscribe();
    } finally {
      vi.useRealTimers();
    }
  });

  it('tracks pane opens, terminal commands, and immediately flushes outbound profile clicks', () => {
    const metaEndpoint = document.createElement('meta');
    metaEndpoint.name = 'aklapper-analytics-endpoint';
    metaEndpoint.content = '/api/analytics/ingest';
    const metaApp = document.createElement('meta');
    metaApp.name = 'aklapper-analytics-app';
    metaApp.content = 'portal';
    document.head.append(metaEndpoint, metaApp);

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));

    bootstrapDocumentAnalytics(document);
    trackPaneOpen('/about', 'desktop');
    trackTerminalCommand('about');
    expect(fetchSpy).not.toHaveBeenCalled();

    trackProfileOutboundClick('github');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body)) as AnalyticsBatch;
    expect(payload.events.map(e => e.name)).toEqual([
      'portal_page_view',
      'pane_open',
      'terminal_command',
      'about_outbound_click',
    ]);
    expect(payload.events[1]?.metadata).toEqual({ app: 'portal', surface: 'desktop' });
    expect(payload.events[2]?.metadata).toEqual({ app: 'portal', command: 'about' });
    expect(payload.events[3]?.metadata).toEqual({ app: 'portal', target: 'github' });
  });

  it('validates extended AnalyticsBatch campaign wire bounds, AdminAnalyticsFilter clamping, and AdminInboxItem backward compatibility', () => {
    const longCampaign = 'c'.repeat(300);
    const validBatch = AnalyticsBatchSchema.safeParse({
      sessionId: 'sess_1',
      landingPath: '/about',
      refParam: 'recruiter',
      utmCampaign: longCampaign,
      events: [
        {
          type: 'page_view',
          name: 'portal_page_view',
          path: '/about',
          timestamp: '2026-11-27T00:00:00.000Z',
        },
      ],
    });
    expect(validBatch.success).toBe(true);

    const oversizedBatch = AnalyticsBatchSchema.safeParse({
      sessionId: 'sess_1',
      utmCampaign: 'x'.repeat(513),
      events: [
        {
          type: 'page_view',
          name: 'portal_page_view',
          path: '/about',
          timestamp: '2026-11-27T00:00:00.000Z',
        },
      ],
    });
    expect(oversizedBatch.success).toBe(false);

    const parsedFilter = parseAdminAnalyticsFilter(
      new URLSearchParams(
        'window=bogus&bots=invalid&identified=nope&country=US&source=linkedin.com',
      ),
    );
    expect(parsedFilter.filter).toEqual({
      window: '7d',
      bots: 'exclude',
      identified: 'all',
      country: 'US',
      source: 'linkedin.com',
    });
    expect(parsedFilter.clampedFields).toEqual(
      expect.arrayContaining(['window', 'bots', 'identified']),
    );

    const legacyInboxItem = AdminInboxItemSchema.safeParse({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: null,
      message: 'Hello from legacy fixture',
      attachmentName: null,
      attachmentMimeType: null,
      attachmentSizeBytes: null,
      attachmentSha256: null,
      createdAt: '2026-11-27T00:00:00.000Z',
    });
    expect(legacyInboxItem.success).toBe(true);
  });

  it('caps sessionId to 128 chars, rejects NUL bytes, strips long document.referrer query/hash, and normalizes trailing slashes', () => {
    const oversizedSession = AnalyticsBatchSchema.safeParse({
      sessionId: 's'.repeat(129),
      events: [
        {
          type: 'page_view',
          name: 'portal_page_view',
          path: '/about',
          timestamp: '2026-11-27T00:00:00.000Z',
        },
      ],
    });
    expect(oversizedSession.success).toBe(false);

    const nulSession = AnalyticsBatchSchema.safeParse({
      sessionId: 'sess_\u0000bad',
      events: [
        {
          type: 'page_view',
          name: 'portal_page_view',
          path: '/about',
          timestamp: '2026-11-27T00:00:00.000Z',
        },
      ],
    });
    expect(nulSession.success).toBe(false);

    const nulEventMeta = AnalyticsBatchSchema.safeParse({
      sessionId: 'sess_ok',
      events: [
        {
          type: 'interaction',
          name: 'pane_open',
          path: '/about',
          metadata: { detail: 'bad\u0000value' },
          timestamp: '2026-11-27T00:00:00.000Z',
        },
      ],
    });
    expect(nulEventMeta.success).toBe(false);

    // Client referrer strips query/hash/userinfo and caps to <= 1024 chars; trailing slash normalized
    const origReferrerDescriptor = Object.getOwnPropertyDescriptor(document, 'referrer');
    try {
      const longReferrer = `https://user:pass@www.google.com/${'a'.repeat(1400)}?q=${'secret'.repeat(200)}#frag`;
      Object.defineProperty(document, 'referrer', {
        value: longReferrer,
        configurable: true,
      });
      window.history.replaceState({}, '', '/about/');
      const sent: AnalyticsBatch[] = [];
      const client = createAnalyticsClient({
        endpoint: '/api/analytics/ingest',
        respectPrivacySignals: false,
        transport: (_url, payload) => {
          sent.push(payload);
        },
      });
      client.track({ type: 'page_view', name: 'portal_page_view', path: '/about' });
      client.flush();

      expect(sent).toHaveLength(1);
      expect(sent[0]?.landingPath).toBe('/about');
      expect(sent[0]?.referrer).toBeDefined();
      expect((sent[0]?.referrer ?? '').length).toBeLessThanOrEqual(1024);
      expect(sent[0]?.referrer).not.toContain('secret');
      expect(sent[0]?.referrer).not.toContain('user:pass');
      expect(sent[0]?.referrer).not.toContain('#frag');
      expect(AnalyticsBatchSchema.safeParse(sent[0]).success).toBe(true);
    } finally {
      if (origReferrerDescriptor) {
        Object.defineProperty(document, 'referrer', origReferrerDescriptor);
      } else {
        Object.defineProperty(document, 'referrer', { value: '', configurable: true });
      }
    }
  });

  it('enforces metadata key, value, serialized byte, finite number, and 64 KiB batch bounds while allowing client error reporter & Agensi metadata', () => {
    const baseEvent = {
      type: 'error' as const,
      name: 'client_error',
      path: '/about',
      timestamp: '2026-11-27T00:00:00.000Z',
    };

    // Valid createClientErrorReporter 5-key payload (with 128-char correlationId) and Agensi { slug } pass
    expect(
      AnalyticsBatchSchema.safeParse({
        sessionId: 'sess_bounds_ok',
        events: [
          {
            ...baseEvent,
            metadata: {
              app: 'portal',
              source: 'route_boundary',
              code: 'ERR_UPSTREAM_UNAVAILABLE',
              status: 503,
              correlationId: 'c'.repeat(128),
            },
          },
          {
            type: 'interaction',
            name: 'agensi_outbound_click',
            path: '/agensi',
            metadata: { slug: 'cadence-governed-agentic-sdlc-framework' },
            timestamp: '2026-11-27T00:00:00.000Z',
          },
        ],
      }).success,
    ).toBe(true);

    // >16 metadata keys rejected
    const seventeenKeys: Record<string, string> = {};
    for (let i = 0; i < 17; i++) {
      seventeenKeys[`k${i}`] = 'v';
    }
    expect(
      AnalyticsBatchSchema.safeParse({
        sessionId: 'sess_too_many_keys',
        events: [{ ...baseEvent, metadata: seventeenKeys }],
      }).success,
    ).toBe(false);

    // >256-char string value rejected
    expect(
      AnalyticsBatchSchema.safeParse({
        sessionId: 'sess_long_val',
        events: [{ ...baseEvent, metadata: { detail: 'x'.repeat(257) } }],
      }).success,
    ).toBe(false);

    // >2048 B serialized per-event metadata rejected
    const denseMeta: Record<string, string> = {};
    for (let i = 0; i < 10; i++) {
      denseMeta[`field_${i}`] = 'a'.repeat(240);
    }
    expect(
      AnalyticsBatchSchema.safeParse({
        sessionId: 'sess_dense_meta',
        events: [{ ...baseEvent, metadata: denseMeta }],
      }).success,
    ).toBe(false);

    // Non-finite numbers rejected
    expect(
      AnalyticsBatchSchema.safeParse({
        sessionId: 'sess_nan',
        events: [{ ...baseEvent, value: Number.NaN }],
      }).success,
    ).toBe(false);
    expect(
      AnalyticsBatchSchema.safeParse({
        sessionId: 'sess_inf',
        events: [{ ...baseEvent, metadata: { n: Number.POSITIVE_INFINITY } }],
      }).success,
    ).toBe(false);

    // >64 KiB serialized batch rejected (50 events × ~1.6 KiB each > 64 KiB)
    const bigMeta: Record<string, string> = {};
    for (let i = 0; i < 7; i++) {
      bigMeta[`m${i}`] = 'z'.repeat(220);
    }
    const bigEvents = Array.from({ length: 50 }, (_, idx) => ({
      ...baseEvent,
      name: `ev_${idx}`,
      metadata: bigMeta,
    }));
    expect(
      AnalyticsBatchSchema.safeParse({
        sessionId: 'sess_over_64k',
        events: bigEvents,
      }).success,
    ).toBe(false);
  });
});
