import { randomUUID } from 'node:crypto';

import {
  type AdminServiceHealth,
  type AppErrorCode,
  type QdrantCollectionHealth,
  type QdrantHealthStatus,
  QdrantHealthStatusSchema,
} from '@aklapper/core';
import {
  classifyGrpcError,
  getAskStatus,
  isFallbackTransportError,
  triggerReindex,
} from '@aklapper/node-runtime/grpc';
import { proxyJson } from '@aklapper/node-runtime/http';
import { probeRuntimeServices } from '@aklapper/node-runtime/runtime-health';
import { logDiagnosticError, type SsrStructuredLogger } from '@aklapper/node-runtime/ssr/stream';

export {
  type AuthenticatedAdminContext,
  requireAdminSession,
  type RequireAdminSessionOptions,
} from './admin-auth.server';

export function sanitizeDownloadFilename(rawName: string | null | undefined): string {
  const base = (rawName ?? '')
    .split(/[\\/]/)
    .pop()
    ?.replace(/[\r\n\0"<>|:*?]+/g, '')
    .trim();
  if (!base) return 'attachment.bin';
  return base.slice(0, 128);
}

async function probeCollection(
  qdrantUrl: string,
  name: string,
  apiKey?: string,
): Promise<QdrantCollectionHealth & { httpStatus?: number; error?: string }> {
  const res = await proxyJson<{
    status?: string;
    result?: { status?: string; points_count?: number };
  }>({
    baseUrl: qdrantUrl,
    path: `/collections/${encodeURIComponent(name)}`,
    method: 'GET',
    ...(apiKey ? { headers: { 'api-key': apiKey } } : {}),
    oidcAuth: false,
    timeoutMs: 2_500,
  });
  if (!res.ok || !res.data) {
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      console.warn(
        JSON.stringify({
          event: 'admin.qdrant_probe.auth_or_collection',
          seam: 'BOUNDARY_FAULT',
          status: res.status,
          collection: name,
        }),
      );
    }
    const isAuthError = res.status === 401 || res.status === 403;
    return {
      name,
      online: false,
      status: isAuthError ? 'error' : 'offline',
      pointsCount: 0,
      httpStatus: res.status,
      error: res.error,
    };
  }
  const pointsCount = Number(res.data.result?.points_count ?? 0);
  const status =
    pointsCount === 0 ? 'degraded' : (res.data.result?.status ?? res.data.status ?? 'green');
  return {
    name,
    online: true,
    status,
    pointsCount,
  };
}

function toCollectionHealth(entry: QdrantCollectionHealth): QdrantCollectionHealth {
  return {
    name: entry.name,
    online: entry.online,
    status: entry.status,
    pointsCount: entry.pointsCount,
  };
}

export const QDRANT_REINDEX_TIMEOUT_MS = 90_000;

export async function fetchQdrantStatus(correlationId?: string): Promise<QdrantHealthStatus> {
  const resolvedCorrId = correlationId?.trim() || randomUUID();
  const [aiAskUrl, qdrantUrl, qdrantApiKey] = [
    process.env['AI_ASK_URL']?.trim(),
    process.env['QDRANT_URL']?.trim(),
    process.env['QDRANT_API_KEY']?.trim(),
  ];
  const parse = (p: Partial<QdrantHealthStatus>) =>
    QdrantHealthStatusSchema.parse({ collection: 'portfolio_docs', pointsCount: 0, ...p });

  if (aiAskUrl) {
    try {
      const res = await getAskStatus({
        baseUrl: aiAskUrl,
        internalAuth: { role: 'admin', subject: 'admin-console-status' },
        correlationId: resolvedCorrId,
        timeoutMs: 2_500,
      });
      const col = res.collection;
      const provider = res.provider.trim() || 'dual-provider';
      const rawStatus = col?.status || res.status || 'ok';
      const bad = new Set(['degraded', 'unreachable', 'offline', 'error']);
      const online = !(bad.has(res.status) || bad.has(col?.status ?? ''));
      const pointsCount = Number(col?.pointsCount ?? 0);
      const status = online && pointsCount === 0 ? 'degraded' : rawStatus;
      const portfolio: QdrantCollectionHealth = {
        name: col?.name || 'portfolio_docs',
        online,
        status,
        pointsCount,
      };
      const collections = qdrantUrl
        ? [
            portfolio,
            toCollectionHealth(await probeCollection(qdrantUrl, 'cadence_patterns', qdrantApiKey)),
          ]
        : [portfolio];
      return parse({
        online,
        collection: portfolio.name,
        pointsCount: portfolio.pointsCount,
        status: portfolio.status,
        provider,
        detail: !online
          ? `ai-ask reported Qdrant ${status} (${provider}).`
          : pointsCount === 0
            ? `Connected via ai-ask (${provider}) with 0 indexed points.`
            : `Connected via ai-ask (${provider}).`,
        collections,
      });
    } catch (error) {
      const failure = classifyGrpcError(error, {
        correlationId: resolvedCorrId,
        source: 'admin.ops.qdrant_status',
      });
      if (!isFallbackTransportError(failure)) {
        return parse({
          online: false,
          status: 'error',
          provider: 'ai-ask',
          detail: failure.publicError.message,
        });
      }
    }
  }
  if (!qdrantUrl) {
    return parse({
      online: false,
      status: aiAskUrl ? 'offline' : 'unconfigured',
      provider: 'unconfigured',
      detail: aiAskUrl
        ? 'ai-ask status endpoint unreachable.'
        : 'AI_ASK_URL and QDRANT_URL not configured.',
    });
  }
  const [portfolio, cadence] = await Promise.all([
    probeCollection(qdrantUrl, 'portfolio_docs', qdrantApiKey),
    probeCollection(qdrantUrl, 'cadence_patterns', qdrantApiKey),
  ]);
  const isAuthError = portfolio.httpStatus === 401 || portfolio.httpStatus === 403;
  return parse({
    online: portfolio.online,
    pointsCount: portfolio.pointsCount,
    status: portfolio.status,
    provider: 'qdrant-direct',
    detail: isAuthError
      ? `Qdrant authentication failed (HTTP ${portfolio.httpStatus}).`
      : !portfolio.online
        ? (portfolio.error ?? 'Qdrant collection probe unavailable.')
        : portfolio.pointsCount === 0
          ? 'Direct Qdrant collection online with 0 indexed points.'
          : 'Direct Qdrant collection probe healthy.',
    collections: [toCollectionHealth(portfolio), toCollectionHealth(cadence)],
  });
}

export interface ReindexResult {
  ok: boolean;
  indexed: number;
  collection: string;
  message: string;
  status?: number;
  code?: AppErrorCode;
  action?: string;
  correlationId?: string;
}

export async function triggerQdrantReindex(
  correlationId?: string,
  logger?: SsrStructuredLogger,
  source = 'admin.ops.reindex',
): Promise<ReindexResult> {
  const resolvedCorrId = correlationId?.trim() || randomUUID();
  const aiAskUrl = process.env['AI_ASK_URL']?.trim();
  if (!aiAskUrl) {
    if (logger) {
      logDiagnosticError(logger, {
        code: 'ERR_UPSTREAM_UNAVAILABLE',
        status: 503,
        severity: 'ERROR',
        reasoning: 'AI_ASK_URL is not configured for Qdrant re-indexing',
        correlationId: resolvedCorrId,
        source,
      });
    }
    return {
      ok: false,
      indexed: 0,
      collection: 'portfolio_docs',
      status: 503,
      code: 'ERR_UPSTREAM_UNAVAILABLE',
      message: 'Upstream service unreachable.',
      action: 'Retry shortly or go home.',
      correlationId: resolvedCorrId,
    };
  }

  try {
    const res = await triggerReindex({
      baseUrl: aiAskUrl,
      internalAuth: {
        role: 'admin',
        subject: 'admin-console-reindex',
      },
      correlationId: resolvedCorrId,
      timeoutMs: QDRANT_REINDEX_TIMEOUT_MS,
      ...(logger ? { logger } : {}),
    });
    const indexed = Number(res.indexed ?? 0);
    const collection = res.collection || 'portfolio_docs';
    return {
      ok: true,
      indexed,
      collection,
      message: `Re-indexed ${indexed} documents into ${collection}.`,
    };
  } catch (error) {
    const failure = classifyGrpcError(error, {
      correlationId: resolvedCorrId,
      source,
      normalizeUnavailableStatus: 503,
      ...(logger ? { logger } : {}),
    });
    return {
      ok: false,
      indexed: 0,
      collection: 'portfolio_docs',
      status: failure.publicError.status,
      code: failure.publicError.code,
      message: failure.publicError.message,
      action: failure.publicError.action,
      correlationId: failure.publicError.correlationId,
    };
  }
}

export async function probePublicClusterHealth(
  correlationId?: string,
): Promise<AdminServiceHealth> {
  const snapshot = await probeRuntimeServices({
    services: [
      { service: 'ai-ask', url: process.env['AI_ASK_URL'], transport: 'grpc' },
      { service: 'cadence-demo', url: process.env['CADENCE_DEMO_URL'], transport: 'grpc' },
    ],
    timeoutMs: 1_500,
    ttlMs: 30_000,
    cacheKey: 'admin-overview-runtime',
    ...(correlationId ? { correlationId } : {}),
  });
  const configured = snapshot.services.filter(item => item.status !== 'unconfigured');
  if (configured.length === 0) {
    return {
      name: 'Cloud Run Services',
      status: 'degraded',
      detail: 'AI_ASK_URL and CADENCE_DEMO_URL not configured.',
    };
  }
  const hasOffline = configured.some(item => item.status === 'offline');
  const hasDegraded = configured.some(item => item.status === 'degraded');
  return {
    name: 'Cloud Run Services',
    status: hasOffline ? 'offline' : hasDegraded ? 'degraded' : 'ok',
    detail: snapshot.summaryLabel,
  };
}

export async function buildOverviewHealthSummary(correlationId?: string): Promise<{
  qdrantHealth: AdminServiceHealth;
  portfolioPublicHealth: AdminServiceHealth;
}> {
  const [qdrant, portfolioPublicHealth] = await Promise.all([
    fetchQdrantStatus(correlationId),
    probePublicClusterHealth(correlationId),
  ]);

  const hasQdrantConfig = Boolean(
    process.env['AI_ASK_URL']?.trim() || process.env['QDRANT_URL']?.trim(),
  );

  return {
    qdrantHealth: {
      name: 'Qdrant',
      status: qdrant.online
        ? qdrant.status === 'degraded'
          ? 'degraded'
          : 'ok'
        : hasQdrantConfig
          ? 'offline'
          : 'degraded',
      detail: qdrant.online
        ? `${qdrant.collection} (${qdrant.pointsCount} points)`
        : (qdrant.detail ?? 'Qdrant unavailable.'),
    },
    portfolioPublicHealth,
  };
}
