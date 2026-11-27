import {
  type AskUpstreamStatusResult,
  Code,
  ConnectError,
  type GrpcCallMetadata,
  type ReindexResult as GrpcReindexResult,
} from '@aklapper/node-runtime/grpc';
import { clearRuntimeHealthCacheForTest } from '@aklapper/node-runtime/runtime-health';
import { afterEach, describe, expect, it, vi } from 'vitest';

const grpcMocks = vi.hoisted(() => ({
  getAskStatus: vi.fn<(meta: GrpcCallMetadata) => Promise<AskUpstreamStatusResult>>(),
  triggerReindex: vi.fn<(meta: GrpcCallMetadata) => Promise<GrpcReindexResult>>(),
}));

vi.mock('@aklapper/node-runtime/grpc', async importOriginal => {
  const actual = await importOriginal<typeof import('@aklapper/node-runtime/grpc')>();
  return {
    ...actual,
    getAskStatus: grpcMocks.getAskStatus,
    triggerReindex: grpcMocks.triggerReindex,
  };
});

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
    clearRuntimeHealthCacheForTest();
    grpcMocks.getAskStatus.mockReset();
    grpcMocks.triggerReindex.mockReset();
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

  it('uses gRPC AskService for AI_ASK_URL primary probe and 90000ms triggerQdrantReindex with admin auth and correlationId', async () => {
    expect(QDRANT_REINDEX_TIMEOUT_MS).toBe(90_000);
    process.env['AI_ASK_URL'] = 'https://ask.bgdkapis.us';
    delete process.env['QDRANT_URL'];

    vi.useFakeTimers();
    grpcMocks.getAskStatus.mockResolvedValueOnce({
      status: 'ready',
      provider: 'vertex-ai-gemini',
      pgConnected: true,
      collection: { name: 'portfolio_docs', status: 'green', pointsCount: 12 },
    });
    grpcMocks.triggerReindex.mockImplementationOnce(meta => {
      expect(meta.timeoutMs).toBe(90_000);
      expect(meta.internalAuth).toEqual({ role: 'admin', subject: 'admin-console-reindex' });
      expect(meta.correlationId).toBe('corr-admin-reindex-1');
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            indexed: 18,
            pruned: 2,
            collection: 'portfolio_docs',
            vectorSize: 768,
            provider: 'vertex-ai-gemini',
            correlationId: 'corr-admin-reindex-1',
          });
        }, 25_000);
      });
    });

    const status = await fetchQdrantStatus('corr-admin-status-1');
    expect(status).toMatchObject({
      online: true,
      collection: 'portfolio_docs',
      pointsCount: 12,
      status: 'green',
      provider: 'vertex-ai-gemini',
      collections: [{ name: 'portfolio_docs', online: true, status: 'green', pointsCount: 12 }],
    });
    expect(grpcMocks.getAskStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'https://ask.bgdkapis.us',
        correlationId: 'corr-admin-status-1',
        internalAuth: { role: 'admin', subject: 'admin-console-status' },
        timeoutMs: 2_500,
      }),
    );

    const reindexPromise = triggerQdrantReindex('corr-admin-reindex-1');
    await vi.advanceTimersByTimeAsync(25_500);
    const reindex = await reindexPromise;

    expect(reindex).toEqual({
      ok: true,
      indexed: 18,
      collection: 'portfolio_docs',
      message: 'Re-indexed 18 documents into portfolio_docs.',
    });
  });

  it('reflects OK(degraded) without masking via direct QDRANT_URL fallback, and falls back only on gRPC Unavailable/DeadlineExceeded', async () => {
    process.env['AI_ASK_URL'] = 'http://ai-ask.local:8083';
    process.env['QDRANT_URL'] = 'http://qdrant.local:6333';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith('/collections/portfolio_docs')) {
        return Response.json({ result: { status: 'green', points_count: 25 } });
      }
      if (url.endsWith('/collections/cadence_patterns')) {
        return new Response('not found', { status: 404 });
      }
      return new Response('not found', { status: 404 });
    });

    // 1. OK(degraded) from ai-ask must NOT fall back portfolio_docs to direct QDRANT_URL.
    grpcMocks.getAskStatus.mockResolvedValue({
      status: 'degraded',
      provider: 'local-llama-swap',
      pgConnected: true,
      collection: { name: 'portfolio_docs', status: 'unreachable', pointsCount: 0 },
    });

    const status = await fetchQdrantStatus('corr-degraded-1');
    expect(status.online).toBe(false);
    expect(status.status).toBe('unreachable');
    expect(status.detail).toContain('ai-ask reported Qdrant unreachable');
    expect(status.collections).toEqual([
      { name: 'portfolio_docs', online: false, status: 'unreachable', pointsCount: 0 },
      { name: 'cadence_patterns', online: false, status: 'offline', pointsCount: 0 },
    ]);
    // Only cadence_patterns was probed directly; portfolio_docs was never masked.
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const summary = await buildOverviewHealthSummary('corr-degraded-2');
    expect(summary.qdrantHealth.status).toBe('offline');

    // 2. Transport Unavailable falls back cleanly to direct QDRANT_URL HTTP probing and threads optional logger.
    fetchSpy.mockClear();
    const errorLogs: Array<Record<string, unknown>> = [];
    const logger = {
      info: () => undefined,
      warn: () => undefined,
      error: (obj: Record<string, unknown>) => {
        errorLogs.push(obj);
      },
    };
    grpcMocks.getAskStatus.mockRejectedValueOnce(
      new ConnectError('dial tcp 127.0.0.1:8083: connection refused', Code.Unavailable),
    );
    const fallbackStatus = await fetchQdrantStatus('corr-fallback-1', logger);
    expect(fallbackStatus.online).toBe(true);
    expect(fallbackStatus.provider).toBe('qdrant-direct');
    expect(fallbackStatus.pointsCount).toBe(25);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(errorLogs).toContainEqual(
      expect.objectContaining({
        seam_type: 'BOUNDARY_FAULT',
        event: 'bff.grpc.upstream_error_classified',
        errorCode: 'ERR_UPSTREAM_UNAVAILABLE',
        grpcCode: 'Unavailable',
        source: 'admin.ops.qdrant_status',
        correlationId: 'corr-fallback-1',
      }),
    );
  });
});
