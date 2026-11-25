import type {
  RuntimeEnvironment,
  RuntimeServiceHealthItem,
  RuntimeServiceHealthSnapshot,
  RuntimeServiceHealthState,
  RuntimeServiceName,
} from '@aklapper/core';

import { shouldAttachGcpOidcToken } from './gcp-oidc.ts';
import { isProductionEnv } from './http-hygiene.ts';
import { proxyJson } from './http.ts';

export interface RuntimeProbeTarget {
  readonly service: RuntimeServiceName;
  readonly url?: string | null;
  readonly localStatus?: RuntimeServiceHealthState;
  readonly detail?: string;
}

export interface RuntimeHealthLogger {
  readonly info?: (entry: Record<string, unknown>) => void;
  readonly warn?: (entry: Record<string, unknown>) => void;
}

export interface ProbeRuntimeServicesOptions {
  readonly services: readonly RuntimeProbeTarget[];
  readonly runtime?: RuntimeEnvironment;
  readonly timeoutMs?: number;
  readonly ttlMs?: number;
  readonly bypassCache?: boolean;
  readonly cacheKey?: string;
  readonly correlationId?: string;
  readonly env?: Record<string, string | undefined>;
  readonly fetchImpl?: typeof fetch;
  readonly nowMs?: number;
  readonly logger?: RuntimeHealthLogger;
}

interface CachedRuntimeSnapshot {
  readonly expiresAtMs: number;
  readonly snapshot: RuntimeServiceHealthSnapshot;
}

const DEFAULT_PROBE_TIMEOUT_MS = 1_500;
const DEFAULT_TTL_MS = 60_000;
const snapshotCache = new Map<string, CachedRuntimeSnapshot>();

export function clearRuntimeHealthCacheForTest(): void {
  snapshotCache.clear();
}

export function detectRuntimeEnvironment(
  env: Record<string, string | undefined> = process.env,
): RuntimeEnvironment {
  if (env['K_SERVICE']?.trim() || isProductionEnv(env)) {
    return 'cloud-run';
  }
  return 'docker';
}

function defaultLogInfo(entry: Record<string, unknown>): void {
  console.info(JSON.stringify(entry));
}

function defaultLogWarn(entry: Record<string, unknown>): void {
  console.warn(JSON.stringify(entry));
}

function emitInfo(logger: RuntimeHealthLogger | undefined, entry: Record<string, unknown>): void {
  if (logger?.info) {
    logger.info(entry);
  } else {
    defaultLogInfo(entry);
  }
}

function emitWarn(logger: RuntimeHealthLogger | undefined, entry: Record<string, unknown>): void {
  if (logger?.warn) {
    logger.warn(entry);
  } else {
    defaultLogWarn(entry);
  }
}

function safeHostLabel(rawUrl: string): string {
  try {
    return new URL(rawUrl).host;
  } catch {
    return 'invalid-url';
  }
}

function isJsonObjectPayload(data: unknown): boolean {
  return typeof data === 'object' && data !== null && !Array.isArray(data);
}

function buildSummaryLabel(
  runtime: RuntimeEnvironment,
  items: readonly RuntimeServiceHealthItem[],
): string {
  const prefix = runtime === 'cloud-run' ? 'Cloud Run' : 'Docker';
  const configured = items.filter(item => item.status !== 'unconfigured');
  const healthy = configured.filter(item => item.status === 'healthy').length;
  if (configured.length === 0) {
    return `${prefix} · passive`;
  }
  const degraded = configured.filter(item => item.status === 'degraded').length;
  const offline = configured.filter(item => item.status === 'offline').length;
  if (offline > 0) {
    return `${prefix} · ${healthy}/${configured.length} healthy (${offline} offline)`;
  }
  if (degraded > 0) {
    return `${prefix} · ${healthy}/${configured.length} healthy (${degraded} degraded)`;
  }
  return `${prefix} · ${healthy}/${configured.length} healthy`;
}

async function probeSingleService(
  target: RuntimeProbeTarget,
  runtime: RuntimeEnvironment,
  options: {
    timeoutMs: number;
    env: Record<string, string | undefined>;
    fetchImpl: typeof fetch;
    correlationId?: string;
    logger?: RuntimeHealthLogger;
    checkedAt: string;
  },
): Promise<RuntimeServiceHealthItem> {
  const { timeoutMs, env, fetchImpl, correlationId, logger, checkedAt } = options;

  if (target.localStatus) {
    emitInfo(logger, {
      event: 'runtime.health.probe_outcome',
      seam: 'RULE_DIVERGENCE',
      service: target.service,
      branch: target.localStatus,
      ...(correlationId ? { correlationId } : {}),
    });
    return {
      service: target.service,
      runtime,
      status: target.localStatus,
      latencyMs: 0,
      checkedAt,
      ...(target.detail ? { detail: target.detail } : {}),
    };
  }

  const trimmedUrl = target.url?.trim() ?? '';
  if (!trimmedUrl) {
    emitInfo(logger, {
      event: 'runtime.health.probe_outcome',
      seam: 'RULE_DIVERGENCE',
      service: target.service,
      branch: 'unconfigured',
      ...(correlationId ? { correlationId } : {}),
    });
    return {
      service: target.service,
      runtime,
      status: 'unconfigured',
      latencyMs: null,
      checkedAt,
      detail: 'Upstream URL not configured',
    };
  }

  if (
    isProductionEnv(env) &&
    trimmedUrl.toLowerCase().startsWith('https://') &&
    !shouldAttachGcpOidcToken(trimmedUrl, env)
  ) {
    emitWarn(logger, {
      event: 'runtime.oidc.non_run_app_url',
      seam: 'UNSOUND_CONDITION',
      service: target.service,
      host: safeHostLabel(trimmedUrl),
      ...(correlationId ? { correlationId } : {}),
    });
  }

  const startedAt = Date.now();
  const result = await proxyJson<Record<string, unknown>>({
    baseUrl: trimmedUrl,
    path: '/healthz',
    method: 'GET',
    timeoutMs,
    oidcAuth: 'auto',
    env,
    fetchImpl,
  });
  const latencyMs = Math.max(0, Date.now() - startedAt);

  if (result.ok && isJsonObjectPayload(result.data)) {
    emitInfo(logger, {
      event: 'runtime.health.probe_outcome',
      seam: 'RULE_DIVERGENCE',
      service: target.service,
      branch: 'healthy',
      latencyMs,
      ...(correlationId ? { correlationId } : {}),
    });
    return {
      service: target.service,
      runtime,
      status: 'healthy',
      latencyMs,
      checkedAt,
      detail: 'HTTP 200 /healthz',
    };
  }

  const isOffline =
    result.status === 502 ||
    result.status === 503 ||
    result.status === 504 ||
    result.error === 'UPSTREAM_TIMEOUT' ||
    result.error === 'UPSTREAM_UNAVAILABLE' ||
    result.error === 'GCP_OIDC_TOKEN_UNAVAILABLE';
  const status: RuntimeServiceHealthState = isOffline ? 'offline' : 'degraded';
  const detail = result.ok
    ? 'Upstream /healthz returned non-JSON payload'
    : result.error === 'UPSTREAM_TIMEOUT'
      ? `Probe timed out after ${timeoutMs}ms`
      : `Upstream returned HTTP ${result.status}`;

  emitWarn(logger, {
    event: 'runtime.health.upstream_contract_fault',
    seam: 'BOUNDARY_FAULT',
    service: target.service,
    host: safeHostLabel(trimmedUrl),
    httpStatus: result.status,
    errorCode: result.error ?? 'INVALID_HEALTH_PAYLOAD',
    ...(correlationId ? { correlationId } : {}),
  });
  emitInfo(logger, {
    event: 'runtime.health.probe_outcome',
    seam: 'RULE_DIVERGENCE',
    service: target.service,
    branch: status,
    latencyMs,
    ...(correlationId ? { correlationId } : {}),
  });

  return {
    service: target.service,
    runtime,
    status,
    latencyMs,
    checkedAt,
    detail,
  };
}

export async function probeRuntimeServices(
  options: ProbeRuntimeServicesOptions,
): Promise<RuntimeServiceHealthSnapshot> {
  const {
    services,
    timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
    ttlMs = DEFAULT_TTL_MS,
    bypassCache = false,
    cacheKey = 'default',
    correlationId,
    env = process.env,
    fetchImpl = fetch,
    nowMs = Date.now(),
    logger,
  } = options;
  const runtime = options.runtime ?? detectRuntimeEnvironment(env);

  if (!bypassCache && ttlMs > 0) {
    const cached = snapshotCache.get(cacheKey);
    if (cached && cached.expiresAtMs > nowMs) {
      emitInfo(logger, {
        event: 'runtime.health.probe_outcome',
        seam: 'RULE_DIVERGENCE',
        branch: 'cached',
        cacheKey,
        ...(correlationId ? { correlationId } : {}),
      });
      return {
        ...cached.snapshot,
        cached: true,
      };
    }
  }

  const checkedAt = new Date(nowMs).toISOString();
  const items = await Promise.all(
    services.map(target =>
      probeSingleService(target, runtime, {
        timeoutMs,
        env,
        fetchImpl,
        correlationId,
        logger,
        checkedAt,
      }),
    ),
  );

  const snapshot: RuntimeServiceHealthSnapshot = {
    runtime,
    services: items,
    summaryLabel: buildSummaryLabel(runtime, items),
    checkedAt,
    cached: false,
  };

  if (ttlMs > 0) {
    snapshotCache.set(cacheKey, {
      expiresAtMs: nowMs + ttlMs,
      snapshot,
    });
  }

  return snapshot;
}
