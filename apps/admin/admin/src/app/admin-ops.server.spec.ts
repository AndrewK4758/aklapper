import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildOverviewHealthSummary,
  fetchQdrantStatus,
  QDRANT_REINDEX_TIMEOUT_MS,
  triggerQdrantReindex,
} from './admin-ops.server';

describe('admin-ops.server Qdrant diagnostics and reindex timeout', () => {
  const originalAiAskUrl = process.env['AI_ASK_URL'];
  const originalQdrantUrl = process.env['QDRANT_URL'];
  const originalQdrantApiKey = process.env['QDRANT_API_KEY'];

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (originalAiAskUrl === undefined) delete process.env['AI_ASK_URL'];
    else process.env['AI_ASK_URL'] = originalAiAskUrl;
    if (originalQdrantUrl === undefined) delete process.env['QDRANT_URL'];
    else process.env['QDRANT_URL'] = originalQdrantUrl;
    if (originalQdrantApiKey === undefined) delete process.env['QDRANT_API_KEY'];
    else process.env['QDRANT_API_KEY'] = originalQdrantApiKey;
  });

  it('sends api-key header on direct QDRANT_URL probes for both collections and distinguishes 0-point degraded vs 401/403 error', async () => {
    delete process.env['AI_ASK_URL'];
    process.env['QDRANT_URL'] = 'https://qdrant.bgdkapis.us';
    process.env['QDRANT_API_KEY'] = 'qdrant-secret-key';

    let mode: 'zero' | 'unauth' | 'forbidden' | 'healthy' = 'zero';
    const seenApiKeys: Array<string | null> = [];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      seenApiKeys.push(new Headers(init?.headers).get('api-key'));
      if (mode === 'unauth') return new Response('Unauthorized', { status: 401 });
      if (mode === 'forbidden') return new Response('Forbidden', { status: 403 });
      if (url.endsWith('/collections/cadence_patterns')) {
        return Response.json({
          result: { status: 'green', points_count: mode === 'zero' ? 0 : 8 },
        });
      }
      return Response.json({
        result: { status: 'green', points_count: mode === 'zero' ? 0 : 14 },
      });
    });

    const zeroPts = await fetchQdrantStatus();
    expect(zeroPts).toMatchObject({
      online: true,
      collection: 'portfolio_docs',
      pointsCount: 0,
      status: 'degraded',
      provider: 'qdrant-direct',
      collections: [
        { name: 'portfolio_docs', online: true, status: 'degraded', pointsCount: 0 },
        { name: 'cadence_patterns', online: true, status: 'degraded', pointsCount: 0 },
      ],
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(seenApiKeys).toEqual(['qdrant-secret-key', 'qdrant-secret-key']);

    mode = 'unauth';
    const unauth = await fetchQdrantStatus();
    expect(unauth).toMatchObject({
      online: false,
      status: 'error',
      provider: 'qdrant-direct',
    });

    mode = 'forbidden';
    const forbidden = await fetchQdrantStatus();
    expect(forbidden).toMatchObject({
      online: false,
      status: 'error',
      provider: 'qdrant-direct',
    });

    mode = 'healthy';
    const healthy = await fetchQdrantStatus();
    expect(healthy).toMatchObject({
      online: true,
      pointsCount: 14,
      status: 'green',
      provider: 'qdrant-direct',
      collections: [
        { name: 'portfolio_docs', online: true, status: 'green', pointsCount: 14 },
        { name: 'cadence_patterns', online: true, status: 'green', pointsCount: 8 },
      ],
    });
  });

  it('supports AI_ASK_URL primary probe and waits up to 90000ms during triggerQdrantReindex', async () => {
    expect(QDRANT_REINDEX_TIMEOUT_MS).toBe(90_000);
    process.env['AI_ASK_URL'] = 'https://ask.bgdkapis.us';
    delete process.env['QDRANT_URL'];

    vi.useFakeTimers();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        Response.json({
          status: 'ready',
          provider: 'vertex-ai-gemini',
          pgConnected: true,
          collection: { name: 'portfolio_docs', status: 'green', pointsCount: 12 },
        }),
      )
      .mockImplementationOnce((_input, init) => {
        return new Promise((resolve, reject) => {
          const sig = init?.signal;
          const timer = setTimeout(() => {
            resolve(
              Response.json({
                indexed: 18,
                collection: 'portfolio_docs',
                provider: 'vertex-ai-gemini',
              }),
            );
          }, 25_000);
          sig?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(sig.reason);
          });
        });
      });

    const status = await fetchQdrantStatus();
    expect(status).toMatchObject({
      online: true,
      collection: 'portfolio_docs',
      pointsCount: 12,
      status: 'green',
      provider: 'vertex-ai-gemini',
      collections: [{ name: 'portfolio_docs', online: true, status: 'green', pointsCount: 12 }],
    });

    const reindexPromise = triggerQdrantReindex();
    await vi.advanceTimersByTimeAsync(25_500);
    const reindex = await reindexPromise;

    expect(reindex).toEqual({
      ok: true,
      indexed: 18,
      collection: 'portfolio_docs',
      message: 'Re-indexed 18 documents into portfolio_docs.',
    });
    const reindexHeaders = new Headers(fetchSpy.mock.calls[1]?.[1]?.headers);
    expect(reindexHeaders.get('x-internal-auth')).toBeTruthy();
  });

  it('reports Qdrant offline/degraded when ai-ask /v1/ask/status returns status=degraded with collection=unreachable', async () => {
    process.env['AI_ASK_URL'] = 'http://ai-ask.local:8083';
    process.env['QDRANT_URL'] = 'http://qdrant.local:6333';

    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith('/v1/ask/status')) {
        return Response.json({
          status: 'degraded',
          provider: 'local-llama-swap',
          collection: { name: 'portfolio_docs', status: 'unreachable', pointsCount: 0 },
        });
      }
      return new Response('not found', { status: 404 });
    });

    const status = await fetchQdrantStatus();
    expect(status.online).toBe(false);
    expect(status.status).toBe('unreachable');
    expect(status.collections).toEqual([
      { name: 'portfolio_docs', online: false, status: 'unreachable', pointsCount: 0 },
      { name: 'cadence_patterns', online: false, status: 'offline', pointsCount: 0 },
    ]);

    const summary = await buildOverviewHealthSummary();
    expect(summary.qdrantHealth.status).toBe('offline');
  });
});
