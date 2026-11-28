import type { QdrantHealthStatus } from '@aklapper/core';
import {
  Code,
  ConnectError,
  type AdminGrpcCallContext,
  type GrpcCallMetadata,
  type ReindexResult as GrpcReindexResult,
} from '@aklapper/node-runtime/grpc';
import { clearRuntimeHealthCacheForTest } from '@aklapper/node-runtime/runtime-health';
import { afterEach, describe, expect, it, vi } from 'vitest';

const grpcMocks = vi.hoisted(() => ({
  getAdminQdrantStatusViaGrpc:
    vi.fn<(sessionId: string, ctx?: AdminGrpcCallContext) => Promise<QdrantHealthStatus>>(),
  triggerReindex: vi.fn<(meta: GrpcCallMetadata) => Promise<GrpcReindexResult>>(),
}));

vi.mock('@aklapper/node-runtime/grpc', async importOriginal => {
  const actual = await importOriginal<typeof import('@aklapper/node-runtime/grpc')>();
  return {
    ...actual,
    getAdminQdrantStatusViaGrpc: grpcMocks.getAdminQdrantStatusViaGrpc,
    triggerReindex: grpcMocks.triggerReindex,
  };
});

import {
  buildOverviewHealthSummary,
  fetchQdrantStatus,
  probePublicClusterHealth,
  QDRANT_REINDEX_TIMEOUT_MS,
  triggerQdrantReindex,
} from './admin-ops.server';

const TEST_SESSION_ID = '11111111-1111-4111-8111-111111111111';

describe('admin-ops.server Qdrant gRPC diagnostics, cluster probes, and reindex timeout', () => {
  const originalAiAskUrl = process.env['AI_ASK_URL'];
  const originalAdminApiUrl = process.env['ADMIN_API_URL'];
  const originalPortalApiUrl = process.env['PORTAL_API_URL'];
  const originalCadenceUrl = process.env['CADENCE_DEMO_URL'];

  afterEach(() => {
    clearRuntimeHealthCacheForTest();
    grpcMocks.getAdminQdrantStatusViaGrpc.mockReset();
    grpcMocks.triggerReindex.mockReset();
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (originalAiAskUrl === undefined) delete process.env['AI_ASK_URL'];
    else process.env['AI_ASK_URL'] = originalAiAskUrl;
    if (originalAdminApiUrl === undefined) delete process.env['ADMIN_API_URL'];
    else process.env['ADMIN_API_URL'] = originalAdminApiUrl;
    if (originalPortalApiUrl === undefined) delete process.env['PORTAL_API_URL'];
    else process.env['PORTAL_API_URL'] = originalPortalApiUrl;
    if (originalCadenceUrl === undefined) delete process.env['CADENCE_DEMO_URL'];
    else process.env['CADENCE_DEMO_URL'] = originalCadenceUrl;
  });

  it('delegates multi-collection Qdrant diagnostics to admin-api without reading QDRANT_API_KEY in Node SSR', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    grpcMocks.getAdminQdrantStatusViaGrpc.mockResolvedValueOnce({
      online: true,
      collection: 'portfolio_docs',
      pointsCount: 14,
      status: 'green',
      provider: 'ai-ask',
      detail: 'Connected via ai-ask (vertex-ai-gemini).',
      collections: [
        { name: 'portfolio_docs', online: true, status: 'green', pointsCount: 14 },
        { name: 'cadence_patterns', online: true, status: 'green', pointsCount: 8 },
      ],
    });

    const status = await fetchQdrantStatus(TEST_SESSION_ID, 'corr-qdrant-1');
    expect(status).toMatchObject({
      online: true,
      collection: 'portfolio_docs',
      pointsCount: 14,
      status: 'green',
      collections: [
        { name: 'portfolio_docs', online: true, status: 'green', pointsCount: 14 },
        { name: 'cadence_patterns', online: true, status: 'green', pointsCount: 8 },
      ],
    });
    expect(grpcMocks.getAdminQdrantStatusViaGrpc).toHaveBeenCalledWith(
      TEST_SESSION_ID,
      expect.objectContaining({ correlationId: 'corr-qdrant-1' }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('honors 90000ms triggerQdrantReindex with admin auth and correlationId', async () => {
    expect(QDRANT_REINDEX_TIMEOUT_MS).toBe(90_000);
    process.env['AI_ASK_URL'] = 'https://ask.bgdkapis.us';

    vi.useFakeTimers();
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

  it('degrades Qdrant overview health cleanly when admin-api returns degraded or transport Unavailable', async () => {
    delete process.env['ADMIN_API_URL'];
    delete process.env['PORTAL_API_URL'];
    delete process.env['AI_ASK_URL'];
    delete process.env['CADENCE_DEMO_URL'];

    grpcMocks.getAdminQdrantStatusViaGrpc.mockResolvedValueOnce({
      online: false,
      collection: 'portfolio_docs',
      pointsCount: 0,
      status: 'unreachable',
      provider: 'ai-ask',
      detail: 'ai-ask reported Qdrant unreachable.',
      collections: [
        { name: 'portfolio_docs', online: false, status: 'unreachable', pointsCount: 0 },
        { name: 'cadence_patterns', online: false, status: 'offline', pointsCount: 0 },
      ],
    });
    const summaryDegraded = await buildOverviewHealthSummary(TEST_SESSION_ID, 'corr-degraded-1');
    expect(summaryDegraded.qdrantHealth.status).toBe('offline');
    expect(summaryDegraded.portfolioPublicHealth.status).toBe('degraded');

    const errorLogs: Array<Record<string, unknown>> = [];
    const logger = {
      info: () => undefined,
      warn: () => undefined,
      error: (obj: Record<string, unknown>) => {
        errorLogs.push(obj);
      },
    };
    grpcMocks.getAdminQdrantStatusViaGrpc.mockRejectedValueOnce(
      new ConnectError('dial tcp 127.0.0.1:8085: connection refused', Code.Unavailable),
    );
    const summaryUnavailable = await buildOverviewHealthSummary(
      TEST_SESSION_ID,
      'corr-unavail-1',
      logger,
    );
    expect(summaryUnavailable.qdrantHealth.status).toBe('offline');
    expect(errorLogs).toContainEqual(
      expect.objectContaining({
        seam_type: 'BOUNDARY_FAULT',
        event: 'bff.grpc.upstream_error_classified',
        errorCode: 'ERR_UPSTREAM_UNAVAILABLE',
        correlationId: 'corr-unavail-1',
      }),
    );

    const cluster = await probePublicClusterHealth('corr-cluster-1');
    expect(cluster.name).toBe('Cloud Run Services');
    expect(cluster.status).toBe('degraded');
  });
});
