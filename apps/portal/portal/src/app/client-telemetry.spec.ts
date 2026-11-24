import { type AnalyticsBatch, createPublicAppError } from '@aklapper/core';
import { createAnalyticsClient, resetAnalyticsBootstrap } from '@aklapper/core/analytics';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  initPortalClientTelemetry,
  reportPortalClientError,
  reportPortalPublicError,
  resetPortalClientTelemetryForTest,
} from './client-telemetry';

describe('portal client telemetry singleton', () => {
  afterEach(() => {
    resetPortalClientTelemetryForTest();
    resetAnalyticsBootstrap();
    document.head.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('deduplicates an identical error across router and hydrateRoot hooks into one analytics event', () => {
    const batches: AnalyticsBatch[] = [];
    const client = createAnalyticsClient({
      endpoint: '/api/analytics/ingest',
      respectPrivacySignals: false,
      maxBatchSize: 10,
      transport: (_endpoint, batch) => {
        batches.push(batch);
      },
    });

    const reporter = initPortalClientTelemetry(client);
    const sharedError = new Error('Hydration mismatch on portal route');

    const first = reportPortalClientError(sharedError, {
      phase: 'router',
      pathname: '/menu',
    });
    const second = reportPortalClientError(sharedError, {
      phase: 'caught',
      pathname: '/menu',
    });

    client.flush();

    expect(first).toBe('emit');
    expect(second).toBe('dedup_weakset');
    expect(reporter.getDecisionCounters()).toMatchObject({
      emit: 1,
      dedup_weakset: 1,
    });
    expect(batches).toHaveLength(1);
    expect(batches[0]?.events).toHaveLength(1);
    expect(batches[0]?.events[0]).toMatchObject({
      type: 'error',
      path: '/menu',
      metadata: {
        app: 'portal',
        phase: 'router',
        errorCode: 'ERR_CLIENT',
      },
    });
  });

  it('emits structured metadata for PublicAppError stream and boundary failures', () => {
    const batches: AnalyticsBatch[] = [];
    const client = createAnalyticsClient({
      endpoint: '/api/analytics/ingest',
      respectPrivacySignals: false,
      maxBatchSize: 10,
      transport: (_endpoint, batch) => {
        batches.push(batch);
      },
    });

    initPortalClientTelemetry(client);
    const publicError = createPublicAppError({
      code: 'ERR_DB_UNAVAILABLE',
      status: 503,
      message: 'Database temporarily unavailable.',
      action: 'Retry shortly or share ID.',
      correlationId: 'corr-portal-503',
    });

    const decision = reportPortalPublicError(publicError, {
      phase: 'boundary',
      pathname: '/agensi',
    });

    expect(decision).toBe('emit');
    expect(batches).toHaveLength(1);
    expect(batches[0]?.events[0]).toMatchObject({
      type: 'error',
      path: '/agensi',
      metadata: {
        app: 'portal',
        phase: 'boundary',
        errorCode: 'ERR_DB_UNAVAILABLE',
        correlationId: 'corr-portal-503',
        status: 503,
      },
    });
  });

  it('degrades safely without throwing when no analytics endpoint is configured', () => {
    initPortalClientTelemetry();

    expect(() =>
      reportPortalClientError(new Error('Offline failure'), {
        phase: 'uncaught',
        pathname: '/',
      }),
    ).not.toThrow();

    const decision = reportPortalClientError(new Error('Second offline failure'), {
      phase: 'recoverable',
      pathname: '/',
    });
    expect(decision).toBe('client_disabled');
  });
});
