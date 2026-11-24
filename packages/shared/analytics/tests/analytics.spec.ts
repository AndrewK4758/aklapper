import type { AnalyticsBatch } from '@aklapper/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  bootstrapDocumentAnalytics,
  createAnalyticsClient,
  isPrivacyOptOut,
} from '../src/index.ts';

describe('@aklapper/analytics', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'doNotTrack', { value: null, configurable: true });
    Object.defineProperty(navigator, 'globalPrivacyControl', {
      value: undefined,
      configurable: true,
    });
    document.head.innerHTML = '';
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

  it('bootstraps analytics from document meta tags and returns null when unconfigured', () => {
    expect(bootstrapDocumentAnalytics(document)).toBeNull();

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

    // Triggering pagehide flushes the queued initial page_view
    window.dispatchEvent(new Event('pagehide'));
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/analytics/ingest',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
