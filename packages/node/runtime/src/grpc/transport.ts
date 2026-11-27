import { Code, ConnectError, type CallOptions, type Transport } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';

import { evictGcpIdentityTokenCache, resolveGcpIdentityToken } from '../gcp-oidc.ts';
import {
  INTERNAL_AUTH_HEADER,
  resolveTargetOidcAudience,
  signInternalAuthToken,
  type InternalAuthRole,
  type OidcAuthMode,
} from '../http.ts';
import { extractCorrelationId, type SsrStructuredLogger } from '../request-context.ts';
import { INTERNAL_CLIENT_IP_HEADER } from './client-ip.ts';

export interface GrpcInternalAuth {
  readonly role: InternalAuthRole;
  readonly subject: string;
  readonly secret?: string;
  readonly ttlSeconds?: number;
}

export interface GrpcCallMetadata {
  readonly baseUrl: string;
  readonly internalAuth?: GrpcInternalAuth;
  readonly signedClientIp?: string;
  readonly correlationId: string;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly oidcAuth?: OidcAuthMode;
  readonly env?: Record<string, string | undefined>;
  readonly fetchImpl?: typeof fetch;
  readonly logger?: SsrStructuredLogger;
  readonly transport?: Transport;
}

export interface GrpcTransportOptions {
  readonly pingIntervalMs?: number;
  readonly pingTimeoutMs?: number;
  readonly idleConnectionTimeoutMs?: number;
  readonly writeMaxBytes?: number;
  readonly readMaxBytes?: number;
}

export const IDEMPOTENT_OIDC_RETRY_PROCEDURES: ReadonlySet<string> = new Set([
  '/ai_ask.v1.AskService/GetAskStatus',
  '/ai_ask.v1.AskService/GetTurn',
  '/cadence.v1.CadenceService/ListRuns',
  '/portal.v1.PortalContentService/GetRootContent',
  '/portal.v1.PortalContentService/GetHomeContent',
  '/portal.v1.PortalContentService/GetAboutContent',
  '/portal.v1.PortalContentService/GetAskContent',
  '/portal.v1.PortalContentService/GetCadenceContent',
  '/portal.v1.PortalContentService/GetContactContent',
  '/portal.v1.AgensiService/GetCatalog',
  '/grpc.health.v1.Health/Check',
]);

const DEFAULT_PING_INTERVAL_MS = 30_000;
const DEFAULT_PING_TIMEOUT_MS = 10_000;
const DEFAULT_IDLE_CONNECTION_TIMEOUT_MS = 60_000;

const transportPool = new Map<string, Transport>();

export function clearGoGrpcTransportCacheForTest(): void {
  transportPool.clear();
}

export function getOrCreateGoGrpcTransport(
  baseUrl: string,
  options?: GrpcTransportOptions,
): Transport {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
  const pingIntervalMs = options?.pingIntervalMs ?? DEFAULT_PING_INTERVAL_MS;
  const pingTimeoutMs = options?.pingTimeoutMs ?? DEFAULT_PING_TIMEOUT_MS;
  const idleConnectionTimeoutMs =
    options?.idleConnectionTimeoutMs ?? DEFAULT_IDLE_CONNECTION_TIMEOUT_MS;
  const writeMaxBytes = options?.writeMaxBytes;
  const readMaxBytes = options?.readMaxBytes;

  const key = `${normalizedBaseUrl}|${pingIntervalMs}|${pingTimeoutMs}|${idleConnectionTimeoutMs}|${writeMaxBytes ?? ''}|${readMaxBytes ?? ''}`;
  const existing = transportPool.get(key);
  if (existing) {
    return existing;
  }

  const transport = createGrpcTransport({
    baseUrl: normalizedBaseUrl,
    pingIntervalMs,
    pingTimeoutMs,
    idleConnectionTimeoutMs,
    ...(writeMaxBytes !== undefined ? { writeMaxBytes } : {}),
    ...(readMaxBytes !== undefined ? { readMaxBytes } : {}),
  });
  transportPool.set(key, transport);
  return transport;
}

function emitOidcBranchSeam(
  logger: SsrStructuredLogger | undefined,
  branch: 'gfe_evict_retry_idempotent' | 'gfe_evict_no_retry_mutating' | 'app_auth_passthrough',
  procedure: string,
  correlationId: string,
): void {
  const entry = {
    seam_type: 'RULE_DIVERGENCE',
    event: 'bff.grpc.oidc_auth_branch',
    branch,
    procedure,
    correlationId,
  };
  if (logger) {
    logger.info(entry, 'Classified upstream gRPC auth rejection branch');
  } else {
    console.info(JSON.stringify(entry));
  }
}

export function isGfeIamAuthRejection(error: ConnectError): boolean {
  if (error.code !== Code.Unauthenticated && error.code !== Code.PermissionDenied) {
    return false;
  }
  const echoedCorrId = error.metadata.get('x-correlation-id')?.trim() ?? '';
  if (!echoedCorrId) {
    return true;
  }
  const contentType = (error.metadata.get('content-type') ?? '').trim().toLowerCase();
  if (contentType && !contentType.startsWith('application/grpc')) {
    return true;
  }
  return false;
}

async function prepareGrpcCallHeaders(
  meta: GrpcCallMetadata,
  forceOidcRefresh = false,
): Promise<{
  readonly headers: Headers;
  readonly audience: string | null;
  readonly correlationId: string;
}> {
  const env = meta.env ?? process.env;
  const correlationId = extractCorrelationId({
    'x-correlation-id': meta.correlationId,
  }).correlationId;
  const headers = new Headers();
  headers.set('x-correlation-id', correlationId);

  if (meta.internalAuth) {
    headers.set(
      INTERNAL_AUTH_HEADER,
      signInternalAuthToken({
        role: meta.internalAuth.role,
        subject: meta.internalAuth.subject,
        ...(meta.internalAuth.secret !== undefined ? { secret: meta.internalAuth.secret } : {}),
        ...(meta.internalAuth.ttlSeconds !== undefined
          ? { ttlSeconds: meta.internalAuth.ttlSeconds }
          : {}),
      }),
    );
  }
  if (meta.signedClientIp?.trim()) {
    headers.set(INTERNAL_CLIENT_IP_HEADER, meta.signedClientIp.trim());
  }

  const audience = resolveTargetOidcAudience(
    meta.baseUrl,
    meta.oidcAuth ?? 'auto',
    env,
    headers.has('authorization'),
  );
  if (audience) {
    const token = await resolveGcpIdentityToken(audience, {
      ...(meta.fetchImpl ? { fetchImpl: meta.fetchImpl } : {}),
      env,
      forceRefresh: forceOidcRefresh,
    });
    headers.set('authorization', `Bearer ${token}`);
  }

  return { headers, audience, correlationId };
}

export async function invokeUnaryWithAuth<TResult>(
  procedure: string,
  meta: GrpcCallMetadata,
  invoke: (options: CallOptions) => Promise<TResult>,
): Promise<TResult> {
  const { headers, audience, correlationId } = await prepareGrpcCallHeaders(meta, false);
  const baseCallOpts: CallOptions = {
    headers,
    ...(meta.signal ? { signal: meta.signal } : {}),
    ...(meta.timeoutMs !== undefined ? { timeoutMs: meta.timeoutMs } : {}),
  };

  try {
    return await invoke(baseCallOpts);
  } catch (error) {
    if (
      audience &&
      error instanceof ConnectError &&
      (error.code === Code.Unauthenticated || error.code === Code.PermissionDenied)
    ) {
      if (isGfeIamAuthRejection(error)) {
        evictGcpIdentityTokenCache(audience);
        if (IDEMPOTENT_OIDC_RETRY_PROCEDURES.has(procedure)) {
          emitOidcBranchSeam(meta.logger, 'gfe_evict_retry_idempotent', procedure, correlationId);
          const refreshed = await prepareGrpcCallHeaders(meta, true);
          return invoke({
            headers: refreshed.headers,
            ...(meta.signal ? { signal: meta.signal } : {}),
            ...(meta.timeoutMs !== undefined ? { timeoutMs: meta.timeoutMs } : {}),
          });
        }
        emitOidcBranchSeam(meta.logger, 'gfe_evict_no_retry_mutating', procedure, correlationId);
        throw error;
      }
      emitOidcBranchSeam(meta.logger, 'app_auth_passthrough', procedure, correlationId);
    }
    throw error;
  }
}

export function openServerStreamWithAuth<TChunk>(
  procedure: string,
  meta: GrpcCallMetadata,
  openStream: (options: CallOptions) => AsyncIterable<TChunk>,
  onHeader?: (headers: Headers) => void,
): AsyncIterable<TChunk> {
  return {
    async *[Symbol.asyncIterator](): AsyncIterator<TChunk> {
      const { headers, audience, correlationId } = await prepareGrpcCallHeaders(meta, false);
      const callOpts: CallOptions = {
        headers,
        ...(meta.signal ? { signal: meta.signal } : {}),
        ...(onHeader ? { onHeader } : {}),
      };
      try {
        for await (const chunk of openStream(callOpts)) {
          yield chunk;
        }
      } catch (error) {
        if (
          audience &&
          error instanceof ConnectError &&
          (error.code === Code.Unauthenticated || error.code === Code.PermissionDenied)
        ) {
          if (isGfeIamAuthRejection(error)) {
            evictGcpIdentityTokenCache(audience);
            emitOidcBranchSeam(
              meta.logger,
              'gfe_evict_no_retry_mutating',
              procedure,
              correlationId,
            );
          } else {
            emitOidcBranchSeam(meta.logger, 'app_auth_passthrough', procedure, correlationId);
          }
        }
        throw error;
      }
    },
  };
}
