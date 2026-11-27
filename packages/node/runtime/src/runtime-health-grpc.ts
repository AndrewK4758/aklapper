import type {
  RuntimeEnvironment,
  RuntimeServiceHealthItem,
  RuntimeServiceHealthState,
  RuntimeServiceName,
} from '@aklapper/core';

import { probeGrpcServiceHealth } from './grpc/health-client.ts';
import type { RuntimeHealthLogger } from './runtime-health.ts';

export interface GrpcRuntimeProbeInput {
  readonly service: RuntimeServiceName;
  readonly url: string;
  readonly grpcService?: string;
  readonly oidcAuth: false | 'auto';
  readonly timeoutMs: number;
  readonly env: Record<string, string | undefined>;
  readonly fetchImpl: typeof fetch;
  readonly correlationId?: string;
  readonly logger?: RuntimeHealthLogger;
  readonly checkedAt: string;
}

const DEFAULT_GRPC_SERVICE_BY_NAME: Readonly<Partial<Record<RuntimeServiceName, string>>> = {
  'ai-ask': 'ai_ask.v1.AskService',
  'cadence-demo': 'cadence.v1.CadenceService',
};

function safeHost(rawUrl: string): string {
  try {
    return new URL(rawUrl).host;
  } catch {
    return 'invalid-url';
  }
}

export async function probeGrpcRuntimeTarget(
  input: GrpcRuntimeProbeInput,
  runtime: RuntimeEnvironment,
): Promise<RuntimeServiceHealthItem> {
  const logInfo = (entry: Record<string, unknown>): void => {
    if (input.logger?.info) input.logger.info(entry);
    else console.info(JSON.stringify(entry));
  };
  const logWarn = (entry: Record<string, unknown>): void => {
    if (input.logger?.warn) input.logger.warn(entry);
    else console.warn(JSON.stringify(entry));
  };

  const serviceName = input.grpcService ?? DEFAULT_GRPC_SERVICE_BY_NAME[input.service] ?? '';
  const startedAt = Date.now();
  const result = await probeGrpcServiceHealth({
    baseUrl: input.url,
    serviceName,
    timeoutMs: input.timeoutMs,
    oidcAuth: input.oidcAuth,
    ...(input.correlationId ? { correlationId: input.correlationId } : {}),
    env: input.env,
    fetchImpl: input.fetchImpl,
  });
  const latencyMs = Math.max(0, Date.now() - startedAt);

  if (result.ok && result.serving) {
    logInfo({
      event: 'runtime.health.probe_outcome',
      seam: 'RULE_DIVERGENCE',
      transport: 'grpc',
      service: input.service,
      branch: 'healthy',
      latencyMs,
      ...(input.correlationId ? { correlationId: input.correlationId } : {}),
    });
    return {
      service: input.service,
      runtime,
      status: 'healthy',
      latencyMs,
      checkedAt: input.checkedAt,
      detail: result.detail,
    };
  }

  const status: RuntimeServiceHealthState = result.isOffline ? 'offline' : 'degraded';
  logWarn({
    event: 'runtime.health.upstream_contract_fault',
    seam: 'BOUNDARY_FAULT',
    transport: 'grpc',
    service: input.service,
    host: safeHost(input.url),
    errorCode: result.statusCode,
    ...(input.correlationId ? { correlationId: input.correlationId } : {}),
  });
  logInfo({
    event: 'runtime.health.probe_outcome',
    seam: 'RULE_DIVERGENCE',
    transport: 'grpc',
    service: input.service,
    branch: status,
    latencyMs,
    ...(input.correlationId ? { correlationId: input.correlationId } : {}),
  });
  return {
    service: input.service,
    runtime,
    status,
    latencyMs,
    checkedAt: input.checkedAt,
    detail: result.detail,
  };
}
