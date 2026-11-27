import { randomUUID } from 'node:crypto';

import type { AdminServiceHealth, AppErrorCode, QdrantHealthStatus } from '@aklapper/core';
import {
  classifyGrpcError,
  getAdminQdrantStatusViaGrpc,
  triggerReindex,
} from '@aklapper/node-runtime/grpc';
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

export const QDRANT_REINDEX_TIMEOUT_MS = 90_000;

export async function fetchQdrantStatus(
  sessionId: string,
  correlationId?: string,
  logger?: SsrStructuredLogger,
): Promise<QdrantHealthStatus> {
  const resolvedCorrId = correlationId?.trim() || randomUUID();
  return getAdminQdrantStatusViaGrpc(sessionId, {
    correlationId: resolvedCorrId,
    ...(logger ? { logger } : {}),
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
      { service: 'admin-api', url: process.env['ADMIN_API_URL'], transport: 'grpc' },
      { service: 'portal-api', url: process.env['PORTAL_API_URL'], transport: 'grpc' },
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
      detail: 'Backend gRPC service URLs are not configured.',
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

export async function buildOverviewHealthSummary(
  sessionId: string,
  correlationId?: string,
  logger?: SsrStructuredLogger,
): Promise<{
  qdrantHealth: AdminServiceHealth;
  portfolioPublicHealth: AdminServiceHealth;
}> {
  const resolvedCorrId = correlationId?.trim() || randomUUID();
  const [qdrantResult, portfolioPublicHealth] = await Promise.all([
    fetchQdrantStatus(sessionId, resolvedCorrId, logger)
      .then(value => ({ ok: true as const, value }))
      .catch(error => ({ ok: false as const, error })),
    probePublicClusterHealth(resolvedCorrId),
  ]);

  if (!qdrantResult.ok) {
    const failure = classifyGrpcError(qdrantResult.error, {
      correlationId: resolvedCorrId,
      source: 'admin.overview.qdrant',
      normalizeUnavailableStatus: 503,
      ...(logger ? { logger } : {}),
    });
    return {
      qdrantHealth: {
        name: 'Qdrant',
        status: 'offline',
        detail: failure.publicError.message,
      },
      portfolioPublicHealth,
    };
  }

  const qdrant = qdrantResult.value;
  return {
    qdrantHealth: {
      name: 'Qdrant',
      status: qdrant.online
        ? qdrant.status === 'degraded'
          ? 'degraded'
          : 'ok'
        : qdrant.status === 'unconfigured'
          ? 'degraded'
          : 'offline',
      detail: qdrant.online
        ? `${qdrant.collection} (${qdrant.pointsCount} points)`
        : (qdrant.detail ?? 'Qdrant unavailable.'),
    },
    portfolioPublicHealth,
  };
}
