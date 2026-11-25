import {
  AdminWakeDeploymentSchema,
  type AdminServiceHealth,
  type CadenceAdminStatus,
  CadenceAdminStatusSchema,
  type QdrantHealthStatus,
  QdrantHealthStatusSchema,
} from '@aklapper/core';
import { proxyJson } from '@aklapper/node-runtime/http';

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

interface RawCadenceAdminStatus {
  namespace?: string;
  isolated?: boolean;
  mode?: string;
  databaseConnected?: boolean;
  totalSandboxRuns?: number;
  pendingGates?: number;
  timestamp?: string;
}

export async function fetchCadenceAdminStatus(): Promise<CadenceAdminStatus> {
  const baseUrl = process.env['CADENCE_ADMIN_URL']?.trim();
  const now = new Date().toISOString();
  if (!baseUrl) {
    return CadenceAdminStatusSchema.parse({
      online: false,
      namespace: 'cadence-admin',
      isolated: true,
      mode: 'full-cadence-runtime',
      databaseConnected: false,
      totalSandboxRuns: 0,
      pendingGates: 0,
      timestamp: now,
      detail: 'CADENCE_ADMIN_URL not configured (using PG19 direct audit fallback).',
    });
  }

  const result = await proxyJson<RawCadenceAdminStatus>({
    baseUrl,
    path: '/v1/admin/status',
    method: 'GET',
    timeoutMs: 2_500,
    internalAuth: {
      role: 'admin',
      subject: 'admin-console-status',
    },
  });

  if (!result.ok || !result.data) {
    return CadenceAdminStatusSchema.parse({
      online: false,
      namespace: 'cadence-admin',
      isolated: true,
      mode: 'full-cadence-runtime',
      databaseConnected: false,
      totalSandboxRuns: 0,
      pendingGates: 0,
      timestamp: now,
      detail: result.error ?? 'cadence-admin status probe unavailable.',
    });
  }

  return CadenceAdminStatusSchema.parse({
    online: true,
    namespace: result.data.namespace ?? 'cadence-admin',
    isolated: result.data.isolated ?? true,
    mode: result.data.mode ?? 'full-cadence-runtime',
    databaseConnected: Boolean(result.data.databaseConnected),
    totalSandboxRuns: Number(result.data.totalSandboxRuns ?? 0),
    pendingGates: Number(result.data.pendingGates ?? 0),
    timestamp: result.data.timestamp ?? now,
    detail: 'Signed X-Internal-Auth probe verified.',
  });
}

interface RawAiAskStatus {
  status?: string;
  provider?: string;
  pgConnected?: boolean;
  collection?: {
    name?: string;
    status?: string;
    pointsCount?: number;
  };
}

interface RawQdrantCollectionResponse {
  status?: string;
  result?: {
    status?: string;
    points_count?: number;
  };
}

export const QDRANT_REINDEX_TIMEOUT_MS = 90_000;

export async function fetchQdrantStatus(): Promise<QdrantHealthStatus> {
  const aiAskUrl = process.env['AI_ASK_URL']?.trim();
  if (aiAskUrl) {
    const result = await proxyJson<RawAiAskStatus>({
      baseUrl: aiAskUrl,
      path: '/v1/ask/status',
      method: 'GET',
      timeoutMs: 2_500,
    });
    if (result.ok && result.data) {
      const collection = result.data.collection;
      const provider = result.data.provider?.trim() || 'dual-provider';
      const pointsCount = Number(collection?.pointsCount ?? 0);
      const status =
        pointsCount === 0 ? 'degraded' : (collection?.status ?? result.data.status ?? 'ok');
      return QdrantHealthStatusSchema.parse({
        online: true,
        collection: collection?.name ?? 'portfolio_docs',
        pointsCount,
        status,
        provider,
        detail:
          pointsCount === 0
            ? `Connected via ai-ask (${provider}) with 0 indexed points.`
            : `Connected via ai-ask (${provider}).`,
      });
    }
  }

  const qdrantUrl = process.env['QDRANT_URL']?.trim();
  if (!qdrantUrl) {
    return QdrantHealthStatusSchema.parse({
      online: false,
      collection: 'portfolio_docs',
      pointsCount: 0,
      status: aiAskUrl ? 'offline' : 'unconfigured',
      provider: 'unconfigured',
      detail: aiAskUrl
        ? 'ai-ask status endpoint unreachable.'
        : 'AI_ASK_URL and QDRANT_URL not configured.',
    });
  }

  const qdrantApiKey = process.env['QDRANT_API_KEY']?.trim();
  const qdrantRes = await proxyJson<RawQdrantCollectionResponse>({
    baseUrl: qdrantUrl,
    path: '/collections/portfolio_docs',
    method: 'GET',
    ...(qdrantApiKey ? { headers: { 'api-key': qdrantApiKey } } : {}),
    timeoutMs: 2_500,
  });

  if (!qdrantRes.ok || !qdrantRes.data) {
    const isAuthError = qdrantRes.status === 401 || qdrantRes.status === 403;
    return QdrantHealthStatusSchema.parse({
      online: false,
      collection: 'portfolio_docs',
      pointsCount: 0,
      status: isAuthError ? 'error' : 'offline',
      provider: 'qdrant-direct',
      detail: isAuthError
        ? `Qdrant authentication failed (HTTP ${qdrantRes.status}).`
        : (qdrantRes.error ?? 'Qdrant collection probe unavailable.'),
    });
  }

  const pointsCount = Number(qdrantRes.data.result?.points_count ?? 0);
  const resolvedStatus =
    pointsCount === 0
      ? 'degraded'
      : (qdrantRes.data.result?.status ?? qdrantRes.data.status ?? 'green');

  return QdrantHealthStatusSchema.parse({
    online: true,
    collection: 'portfolio_docs',
    pointsCount,
    status: resolvedStatus,
    provider: 'qdrant-direct',
    detail:
      pointsCount === 0
        ? 'Direct Qdrant collection online with 0 indexed points.'
        : 'Direct Qdrant collection probe healthy.',
  });
}

export interface ReindexResult {
  ok: boolean;
  indexed: number;
  collection: string;
  message: string;
}

interface RawReindexResponse {
  indexed?: number;
  collection?: string;
  provider?: string;
  error?: string;
  message?: string;
}

export async function triggerQdrantReindex(): Promise<ReindexResult> {
  const aiAskUrl = process.env['AI_ASK_URL']?.trim();
  if (!aiAskUrl) {
    return {
      ok: false,
      indexed: 0,
      collection: 'portfolio_docs',
      message: 'AI_ASK_URL is not configured; start svc-ai-ask to run Qdrant re-indexing.',
    };
  }

  const result = await proxyJson<RawReindexResponse>({
    baseUrl: aiAskUrl,
    path: '/v1/ask/reindex',
    method: 'POST',
    body: {},
    timeoutMs: QDRANT_REINDEX_TIMEOUT_MS,
    internalAuth: {
      role: 'admin',
      subject: 'admin-console-reindex',
    },
  });

  if (!result.ok || !result.data) {
    return {
      ok: false,
      indexed: 0,
      collection: 'portfolio_docs',
      message:
        result.data?.message ??
        result.data?.error ??
        result.error ??
        'Qdrant re-index request failed.',
    };
  }

  const indexed = Number(result.data.indexed ?? 0);
  const collection = result.data.collection ?? 'portfolio_docs';
  return {
    ok: true,
    indexed,
    collection,
    message: `Re-indexed ${indexed} documents into ${collection}.`,
  };
}

export interface WakeDeploymentResult {
  ok: boolean;
  simulated: boolean;
  deployment: string;
  message: string;
}

interface RawWakeResponse {
  deployment?: string;
  phase?: string;
  message?: string;
  error?: string;
}

export async function triggerClusterWake(rawDeployment: string): Promise<WakeDeploymentResult> {
  const { deployment } = AdminWakeDeploymentSchema.parse({ deployment: rawDeployment });
  const watchUrl = process.env['K8S_WATCH_URL']?.trim();
  if (!watchUrl) {
    return {
      ok: true,
      simulated: true,
      deployment,
      message: `Simulated wake queued for ${deployment} (K8S_WATCH_URL unset).`,
    };
  }

  const result = await proxyJson<RawWakeResponse>({
    baseUrl: watchUrl,
    path: `/v1/cluster/wake/${encodeURIComponent(deployment)}`,
    method: 'POST',
    body: {},
    timeoutMs: 4_000,
    internalAuth: {
      role: 'admin',
      subject: 'admin-ops-wake',
    },
  });

  if (!result.ok) {
    return {
      ok: false,
      simulated: false,
      deployment,
      message:
        result.data?.message ??
        result.data?.error ??
        result.error ??
        `Wake failed for ${deployment}.`,
    };
  }

  return {
    ok: true,
    simulated: false,
    deployment,
    message: result.data?.message ?? `Wake signal delivered to ${deployment}.`,
  };
}

export async function probePublicClusterHealth(): Promise<AdminServiceHealth> {
  const watchUrl = process.env['K8S_WATCH_URL']?.trim();
  if (!watchUrl) {
    return {
      name: 'portfolio-public',
      status: 'degraded',
      detail: 'Local simulation mode (K8S_WATCH_URL unset).',
    };
  }
  const res = await proxyJson<{ ok?: boolean }>({
    baseUrl: watchUrl,
    path: '/healthz',
    method: 'GET',
    timeoutMs: 2_000,
  });
  return {
    name: 'portfolio-public',
    status: res.ok ? 'ok' : 'offline',
    detail: res.ok
      ? 'k8s-watch scale-from-zero telemetry online.'
      : (res.error ?? 'k8s-watch unreachable.'),
  };
}

export async function buildOverviewHealthSummary(): Promise<{
  qdrantHealth: AdminServiceHealth;
  portfolioPublicHealth: AdminServiceHealth;
  cadenceAdminHealth: AdminServiceHealth;
}> {
  const [qdrant, portfolioPublicHealth, cadenceAdmin] = await Promise.all([
    fetchQdrantStatus(),
    probePublicClusterHealth(),
    fetchCadenceAdminStatus(),
  ]);

  const hasQdrantConfig = Boolean(
    process.env['AI_ASK_URL']?.trim() || process.env['QDRANT_URL']?.trim(),
  );
  const hasCadenceAdminConfig = Boolean(process.env['CADENCE_ADMIN_URL']?.trim());

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
    cadenceAdminHealth: {
      name: 'cadence-admin',
      status: cadenceAdmin.online ? 'ok' : hasCadenceAdminConfig ? 'offline' : 'degraded',
      detail: cadenceAdmin.online
        ? `${cadenceAdmin.mode} · ${cadenceAdmin.pendingGates} pending gate(s)`
        : (cadenceAdmin.detail ?? 'cadence-admin offline.'),
    },
  };
}

export async function forwardCadenceGateOverride(
  runId: string,
  gateVerdict: 'approved' | 'rejected' | 'pending',
): Promise<boolean> {
  const baseUrl = process.env['CADENCE_ADMIN_URL']?.trim();
  if (!baseUrl) return false;
  const res = await proxyJson({
    baseUrl,
    path: `/v1/admin/runs/${encodeURIComponent(runId)}/gate`,
    method: 'POST',
    body: { gateVerdict },
    timeoutMs: 3_000,
    internalAuth: {
      role: 'admin',
      subject: 'admin-ops-gate',
    },
  });
  return res.ok;
}
