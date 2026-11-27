import { Code, ConnectError, createClient, type Transport } from '@connectrpc/connect';

import { GcpOidcTokenError } from '../gcp-oidc.ts';
import type { OidcAuthMode } from '../http.ts';
import type { SsrStructuredLogger } from '../request-context.ts';
import { Health, HealthCheckResponse_ServingStatus } from './gen/grpc/health/v1/health_pb.ts';
import { getOrCreateGoGrpcTransport, invokeUnaryWithAuth } from './transport.ts';

export interface ProbeGrpcServiceHealthOptions {
  readonly baseUrl: string;
  readonly serviceName: string;
  readonly timeoutMs: number;
  readonly oidcAuth?: OidcAuthMode;
  readonly correlationId?: string;
  readonly env?: Record<string, string | undefined>;
  readonly fetchImpl?: typeof fetch;
  readonly logger?: SsrStructuredLogger;
  readonly transport?: Transport;
}

export interface GrpcHealthProbeResult {
  readonly ok: boolean;
  readonly serving: boolean;
  readonly statusCode: string;
  readonly detail: string;
  readonly isOffline: boolean;
}

export async function probeGrpcServiceHealth(
  options: ProbeGrpcServiceHealthOptions,
): Promise<GrpcHealthProbeResult> {
  try {
    const transport = options.transport ?? getOrCreateGoGrpcTransport(options.baseUrl);
    const client = createClient(Health, transport);
    const res = await invokeUnaryWithAuth(
      '/grpc.health.v1.Health/Check',
      {
        baseUrl: options.baseUrl,
        correlationId: options.correlationId ?? '',
        timeoutMs: options.timeoutMs,
        oidcAuth: options.oidcAuth ?? 'auto',
        ...(options.env ? { env: options.env } : {}),
        ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
        ...(options.logger ? { logger: options.logger } : {}),
        transport,
      },
      callOpts => client.check({ service: options.serviceName }, callOpts),
    );
    const serving = res.status === HealthCheckResponse_ServingStatus.SERVING;
    return {
      ok: true,
      serving,
      statusCode: serving ? 'SERVING' : `STATUS_${String(res.status)}`,
      detail: serving ? 'gRPC SERVING' : `gRPC health status ${String(res.status)}`,
      isOffline: false,
    };
  } catch (error) {
    if (error instanceof GcpOidcTokenError) {
      return {
        ok: false,
        serving: false,
        statusCode: 'GCP_OIDC_TOKEN_UNAVAILABLE',
        detail: 'Cloud Run OIDC token unavailable',
        isOffline: true,
      };
    }
    if (error instanceof ConnectError) {
      const codeName = Code[error.code] ?? String(error.code);
      const isOffline =
        error.code === Code.Unavailable ||
        error.code === Code.DeadlineExceeded ||
        error.code === Code.Canceled;
      return {
        ok: false,
        serving: false,
        statusCode: codeName,
        detail:
          error.code === Code.DeadlineExceeded
            ? `gRPC health probe timed out after ${options.timeoutMs}ms`
            : `gRPC health probe returned ${codeName}`,
        isOffline,
      };
    }
    return {
      ok: false,
      serving: false,
      statusCode: 'UNKNOWN',
      detail: 'gRPC health probe failed',
      isOffline: true,
    };
  }
}
