import { afterEach, describe, expect, it, vi } from 'vitest';

import {
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

  it('sends api-key header on direct QDRANT_URL probes and distinguishes 0-point degraded vs 401/403 error', async () => {
    delete process.env['AI_ASK_URL'];
    process.env['QDRANT_URL'] = 'https://qdrant.bgdkapis.us';
    process.env['QDRANT_API_KEY'] = 'qdrant-secret-key';

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        Response.json({
          result: { status: 'green', points_count: 0 },
        }),
      )
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
      .mockResolvedValueOnce(new Response('Forbidden', { status: 403 }))
      .mockResolvedValueOnce(
        Response.json({
          result: { status: 'green', points_count: 14 },
        }),
      );

    const zeroPts = await fetchQdrantStatus();
    expect(zeroPts).toMatchObject({
      online: true,
      collection: 'portfolio_docs',
      pointsCount: 0,
      status: 'degraded',
      provider: 'qdrant-direct',
    });

    const firstInit = fetchSpy.mock.calls[0]?.[1];
    expect(new Headers(firstInit?.headers).get('api-key')).toBe('qdrant-secret-key');

    const unauth = await fetchQdrantStatus();
    expect(unauth).toMatchObject({
      online: false,
      status: 'error',
      provider: 'qdrant-direct',
    });

    const forbidden = await fetchQdrantStatus();
    expect(forbidden).toMatchObject({
      online: false,
      status: 'error',
      provider: 'qdrant-direct',
    });

    const healthy = await fetchQdrantStatus();
    expect(healthy).toMatchObject({
      online: true,
      pointsCount: 14,
      status: 'green',
      provider: 'qdrant-direct',
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
});
