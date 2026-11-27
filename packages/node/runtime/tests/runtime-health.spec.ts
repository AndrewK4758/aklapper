import { afterEach, describe, expect, it } from 'vitest';

import { clearGcpIdentityTokenCacheForTest } from '../src/http.ts';
import { clearRuntimeHealthCacheForTest, probeRuntimeServices } from '../src/runtime-health.ts';

describe('@aklapper/node-runtime/runtime-health', () => {
  afterEach(() => {
    clearRuntimeHealthCacheForTest();
    clearGcpIdentityTokenCacheForTest();
  });

  it('serves cached snapshot within TTL window without waking scale-to-zero containers', async () => {
    let fetchCalls = 0;
    const requestedUrls: string[] = [];
    const mockFetch: typeof fetch = async input => {
      fetchCalls += 1;
      requestedUrls.push(
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      );
      return Response.json({ status: 'ok', service: 'ai-ask' });
    };

    const first = await probeRuntimeServices({
      runtime: 'cloud-run',
      services: [
        { service: 'portal', localStatus: 'healthy', detail: 'SSR ready' },
        { service: 'ai-ask', url: 'http://127.0.0.1:8083' },
      ],
      ttlMs: 60_000,
      cacheKey: 'portal-public',
      nowMs: 1_000_000,
      fetchImpl: mockFetch,
    });

    expect(first.cached).toBe(false);
    expect(fetchCalls).toBe(1);
    expect(requestedUrls).toEqual(['http://127.0.0.1:8083/health']);
    expect(first.services.find(s => s.service === 'ai-ask')?.status).toBe('healthy');

    const second = await probeRuntimeServices({
      runtime: 'cloud-run',
      services: [
        { service: 'portal', localStatus: 'healthy', detail: 'SSR ready' },
        { service: 'ai-ask', url: 'http://127.0.0.1:8083' },
      ],
      ttlMs: 60_000,
      cacheKey: 'portal-public',
      nowMs: 1_030_000,
      fetchImpl: mockFetch,
    });

    expect(second.cached).toBe(true);
    expect(fetchCalls).toBe(1);
  });

  it('bypasses TTL cache when bypassCache is true, classifies timeouts as offline, and never leaks URL credentials', async () => {
    const logs: Array<Record<string, unknown>> = [];
    const logger = {
      info: (entry: Record<string, unknown>) => logs.push(entry),
      warn: (entry: Record<string, unknown>) => logs.push(entry),
    };

    const mockFetch: typeof fetch = async input => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('ai-ask')) {
        return Response.json({ status: 'ok' });
      }
      const timeoutErr = new Error('The operation was aborted due to timeout');
      timeoutErr.name = 'TimeoutError';
      throw timeoutErr;
    };

    const snapshot = await probeRuntimeServices({
      runtime: 'cloud-run',
      services: [
        { service: 'ai-ask', url: 'http://ai-ask.internal:8083' },
        { service: 'cadence-demo', url: 'http://user:supersecret@cadence-demo.internal:8082' },
        { service: 'postgres', localStatus: 'healthy' },
      ],
      bypassCache: true,
      timeoutMs: 1500,
      fetchImpl: mockFetch,
      logger,
    });

    expect(snapshot.cached).toBe(false);
    expect(snapshot.services.find(s => s.service === 'ai-ask')?.status).toBe('healthy');
    expect(snapshot.services.find(s => s.service === 'cadence-demo')?.status).toBe('offline');
    expect(JSON.stringify(snapshot)).not.toContain('supersecret');
    expect(JSON.stringify(logs)).not.toContain('supersecret');
    expect(
      logs.some(
        l =>
          l['event'] === 'runtime.health.upstream_contract_fault' && l['seam'] === 'BOUNDARY_FAULT',
      ),
    ).toBe(true);
    expect(
      logs.some(
        l => l['event'] === 'runtime.health.probe_outcome' && l['seam'] === 'RULE_DIVERGENCE',
      ),
    ).toBe(true);
  });

  it('emits UNSOUND_CONDITION when a production HTTPS backend uses a non-run.app host without allowlist', async () => {
    const logs: Array<Record<string, unknown>> = [];
    const logger = {
      info: (entry: Record<string, unknown>) => logs.push(entry),
      warn: (entry: Record<string, unknown>) => logs.push(entry),
    };

    const mockFetch: typeof fetch = async () => new Response('not-json-body', { status: 200 });

    const snapshot = await probeRuntimeServices({
      runtime: 'cloud-run',
      services: [{ service: 'ai-ask', url: 'https://ask.bgdkapis.us' }],
      env: { NODE_ENV: 'production' },
      fetchImpl: mockFetch,
      logger,
    });

    expect(snapshot.services[0]?.status).toBe('degraded');
    expect(
      logs.some(
        l => l['event'] === 'runtime.oidc.non_run_app_url' && l['seam'] === 'UNSOUND_CONDITION',
      ),
    ).toBe(true);
    expect(
      logs.some(
        l =>
          l['event'] === 'runtime.health.upstream_contract_fault' && l['seam'] === 'BOUNDARY_FAULT',
      ),
    ).toBe(true);
  });

  it('prevents slower in-flight probes from overwriting newer refresh snapshots and coalesces concurrent misses', async () => {
    let resolveSlow!: (res: Response) => void;
    let callCount = 0;

    const mockFetch: typeof fetch = async () => {
      callCount += 1;
      if (callCount === 1) {
        return new Promise<Response>(resolve => {
          resolveSlow = resolve;
        });
      }
      return Response.json({ status: 'ok', rev: 'fresh' });
    };

    const slowProbeA = probeRuntimeServices({
      runtime: 'cloud-run',
      services: [{ service: 'ai-ask', url: 'http://127.0.0.1:8083' }],
      ttlMs: 60_000,
      cacheKey: 'race-test',
      nowMs: 2_000_000,
      fetchImpl: mockFetch,
    });
    const slowProbeB = probeRuntimeServices({
      runtime: 'cloud-run',
      services: [{ service: 'ai-ask', url: 'http://127.0.0.1:8083' }],
      ttlMs: 60_000,
      cacheKey: 'race-test',
      nowMs: 2_000_050,
      fetchImpl: mockFetch,
    });

    expect(callCount).toBe(1);

    const fastRefresh = await probeRuntimeServices({
      runtime: 'cloud-run',
      services: [{ service: 'ai-ask', url: 'http://127.0.0.1:8083' }],
      ttlMs: 60_000,
      bypassCache: true,
      cacheKey: 'race-test',
      nowMs: 2_000_100,
      fetchImpl: mockFetch,
    });
    expect(fastRefresh.services[0]?.status).toBe('healthy');
    expect(callCount).toBe(2);

    resolveSlow(new Response('error', { status: 500 }));
    const [resA, resB] = await Promise.all([slowProbeA, slowProbeB]);
    expect(resA.services[0]?.status).toBe('degraded');
    expect(resB.services[0]?.status).toBe('degraded');

    const cachedAfter = await probeRuntimeServices({
      runtime: 'cloud-run',
      services: [{ service: 'ai-ask', url: 'http://127.0.0.1:8083' }],
      ttlMs: 60_000,
      cacheKey: 'race-test',
      nowMs: 2_000_200,
      fetchImpl: mockFetch,
    });
    expect(cachedAfter.cached).toBe(true);
    expect(cachedAfter.services[0]?.status).toBe('healthy');
    expect(callCount).toBe(2);
  });

  it('skips non-run.app OIDC warning when target sets oidcAuth: false', async () => {
    const logs: Array<Record<string, unknown>> = [];
    const logger = {
      info: (entry: Record<string, unknown>) => logs.push(entry),
      warn: (entry: Record<string, unknown>) => logs.push(entry),
    };

    const snapshot = await probeRuntimeServices({
      runtime: 'cloud-run',
      services: [{ service: 'portal', url: 'https://andrew-k.us', oidcAuth: false }],
      env: { NODE_ENV: 'production' },
      fetchImpl: async () => Response.json({ ok: true }),
      logger,
    });

    expect(snapshot.services[0]?.status).toBe('healthy');
    expect(logs.some(l => l['event'] === 'runtime.oidc.non_run_app_url')).toBe(false);
  });
});
