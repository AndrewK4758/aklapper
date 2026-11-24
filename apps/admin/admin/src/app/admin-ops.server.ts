import {
  AdminWakeDeploymentSchema,
  type AdminServiceHealth,
  type CadenceAdminStatus,
  CadenceAdminStatusSchema,
  type QdrantCollectionHealth,
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
  collection?: { name?: string; status?: string; pointsCount?: number };
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

export async function fetchQdrantStatus(): Promise<QdrantHealthStatus> {
  const [aiAskUrl, qdrantUrl, qdrantApiKey] = [
    process.env['AI_ASK_URL']?.trim(),
    process.env['QDRANT_URL']?.trim(),
    process.env['QDRANT_API_KEY']?.trim(),
  ];
  const parse = (p: Partial<QdrantHealthStatus>) =>
    QdrantHealthStatusSchema.parse({ collection: 'portfolio_docs', pointsCount: 0, ...p });

  if (aiAskUrl) {
    const res = await proxyJson<RawAiAskStatus>({
      baseUrl: aiAskUrl,
      path: '/v1/ask/status',
      method: 'GET',
      timeoutMs: 2_500,
    });
    if (res.ok && res.data) {
      const col = res.data.collection;
      const provider = res.data.provider?.trim() || 'dual-provider';
      const rawStatus = col?.status ?? res.data.status ?? 'ok';
      const bad = new Set(['degraded', 'unreachable', 'offline', 'error']);
      const online = !(bad.has(res.data.status ?? '') || bad.has(col?.status ?? ''));
      const pointsCount = Number(col?.pointsCount ?? 0);
      const status = online && pointsCount === 0 ? 'degraded' : rawStatus;
      const portfolio: QdrantCollectionHealth = {
        name: col?.name ?? 'portfolio_docs',
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
