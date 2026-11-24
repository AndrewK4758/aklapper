import { describe, expect, it, vi } from 'vitest';

import {
  createAnalyticsClient,
  createClientErrorReporter,
  type ErrorDedupDecision,
} from '../src/analytics.ts';
import {
  AnalyticsEventSchema,
  createClientErrorReporter as createClientErrorReporterFromRoot,
  createPublicAppError,
  type AnalyticsBatch,
} from '../src/index.ts';

describe('@aklapper/core/analytics client error reporter', () => {
  it('deduplicates the same Error reference across router and hydrateRoot hooks into one AnalyticsEvent', () => {
    expect(createClientErrorReporterFromRoot).toBe(createClientErrorReporter);

    const batches: AnalyticsBatch[] = [];
    const client = createAnalyticsClient({
      endpoint: '/api/analytics/ingest',
      respectPrivacySignals: false,
      maxBatchSize: 10,
      transport: (_url, payload) => batches.push(payload),
    });

    const decisions: Array<{ readonly decision: ErrorDedupDecision; readonly event: string }> = [];
    const reporter = createClientErrorReporter({
      app: 'portal',
      client,
      now: () => 1_000,
      onDecision: (decision, meta) => decisions.push({ decision, event: meta.event }),
    });

    const sharedError = new Error('Hydration boundary failure');
    const first = reporter.reportError(sharedError, {
      phase: 'router',
      pathname: '/menu',
      correlationId: 'corr-router-1',
      errorCode: 'ERR_INTERNAL',
      status: 500,
    });
    const second = reporter.reportError(sharedError, {
      phase: 'caught',
      pathname: '/menu',
      correlationId: 'corr-router-1',
      errorCode: 'ERR_INTERNAL',
      status: 500,
    });

    expect(first).toBe('emit');
    expect(second).toBe('dedup_weakset');
    expect(decisions).toEqual([
      { decision: 'emit', event: 'client.telemetry.error_dedup_decision' },
      { decision: 'dedup_weakset', event: 'client.telemetry.error_dedup_decision' },
    ]);

    client.flush();
    expect(batches).toHaveLength(1);
    expect(batches[0]?.events).toHaveLength(1);

    const emitted = batches[0]!.events[0]!;
    expect(emitted.type).toBe('error');
    expect(AnalyticsEventSchema.safeParse(emitted).success).toBe(true);
    expect(emitted.metadata).toEqual({
      app: 'portal',
      phase: 'router',
      errorCode: 'ERR_INTERNAL',
      correlationId: 'corr-router-1',
      status: 500,
    });
  });

  it('deduplicates distinct error instances sharing a fingerprint within 5000ms and enforces a 20 events/min burst cap', () => {
    let clock = 10_000;
    const batches: AnalyticsBatch[] = [];
    const client = createAnalyticsClient({
      endpoint: '/api/analytics/ingest',
      respectPrivacySignals: false,
      maxBatchSize: 50,
      transport: (_url, payload) => batches.push(payload),
    });

    const reporter = createClientErrorReporter({
      app: 'portal',
      client,
      now: () => clock,
    });

    expect(
      reporter.reportError(new Error('Database unreachable'), {
        phase: 'stream',
        pathname: '/ask',
        errorCode: 'ERR_DB_UNAVAILABLE',
      }),
    ).toBe('emit');

    clock += 1_000;
    expect(
      reporter.reportError(new Error('Database unreachable'), {
        phase: 'stream',
        pathname: '/ask',
        errorCode: 'ERR_DB_UNAVAILABLE',
      }),
    ).toBe('dedup_ttl');

    // Burst 30 distinct error fingerprints within 10 seconds -> cap at 20 total emitted per minute
    for (let i = 0; i < 30; i += 1) {
      clock += 200;
      reporter.reportError(new Error(`Distinct failure #${i}`), {
        phase: 'stream',
        pathname: `/route-${i}`,
        errorCode: 'ERR_DB_UNAVAILABLE',
      });
    }

    client.flush();
    const totalEmitted = batches.flatMap(b => b.events).length;
    expect(totalEmitted).toBe(20);

    const counters = reporter.getDecisionCounters();
    expect(counters.emit).toBe(20);
    expect(counters.dedup_ttl).toBe(1);
    expect(counters.rate_limited).toBe(11);
  });

  it('clamps oversized error names and paths to AnalyticsEventSchema limits and flushes immediately on fatal uncaught phase', () => {
    const batches: AnalyticsBatch[] = [];
    const client = createAnalyticsClient({
      endpoint: '/api/analytics/ingest',
      respectPrivacySignals: false,
      maxBatchSize: 50,
      transport: (_url, payload) => batches.push(payload),
    });
    const flushSpy = vi.spyOn(client, 'flush');

    const reporter = createClientErrorReporter({
      app: 'admin',
      client,
      now: () => 50_000,
    });

    const longMessage = 'E'.repeat(400);
    const longPathname = `/${'segment/'.repeat(90)}?email=secret@example.com`;
    const decision = reporter.reportError(new Error(longMessage), {
      phase: 'uncaught',
      pathname: longPathname,
      correlationId: 'corr-fatal-1',
    });

    expect(decision).toBe('emit');
    expect(flushSpy).toHaveBeenCalledTimes(1);
    expect(batches).toHaveLength(1);

    const emitted = batches[0]!.events[0]!;
    expect(emitted.name.length).toBeLessThanOrEqual(120);
    expect(emitted.path.length).toBeLessThanOrEqual(512);
    expect(emitted.path).not.toContain('secret@example.com');
    expect(AnalyticsEventSchema.safeParse(emitted).success).toBe(true);
  });

  it('degrades safely when analytics client is null or disabled and tracks all five RULE_DIVERGENCE branches', () => {
    const nullReporter = createClientErrorReporter({ app: 'portal', client: null });
    const publicErr = createPublicAppError({
      code: 'ERR_DB_UNAVAILABLE',
      status: 503,
      message: 'Database temporarily unavailable.',
      action: 'Retry shortly.',
      correlationId: 'corr-null-1',
    });

    expect(nullReporter.reportError(new Error('offline'), { phase: 'uncaught' })).toBe(
      'client_disabled',
    );
    expect(nullReporter.reportPublicError(publicErr)).toBe('client_disabled');
    expect(nullReporter.getDecisionCounters()).toEqual({
      emit: 0,
      dedup_weakset: 0,
      dedup_ttl: 0,
      rate_limited: 0,
      client_disabled: 2,
    });

    const transport = vi.fn<(endpoint: string, payload: AnalyticsBatch) => void>();
    const disabledClient = {
      enabled: false,
      sessionId: 'disabled-session',
      track: vi.fn<() => void>(),
      startWebVitals: vi.fn<() => void>(),
      flush: vi.fn<() => void>(),
    };
    const disabledReporter = createClientErrorReporter({
      app: 'admin',
      client: disabledClient,
    });
    expect(disabledReporter.reportPublicError(publicErr, { pathname: '/cms' })).toBe(
      'client_disabled',
    );
    expect(disabledClient.track).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  });
});
