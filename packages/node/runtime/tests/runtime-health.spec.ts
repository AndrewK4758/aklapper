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
    const mockFetch: typeof fetch = async () => {
      fetchCalls += 1;
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
        l => l['event'] === 'runtime.health.upstream_contract_fault' && l['seam'] === 'BOUNDARY_FAULT',
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
        l => l['event'] === 'runtime.health.upstream_contract_fault' && l['seam'] === 'BOUNDARY_FAULT',
      ),
    ).toBe(true);
  });
});
