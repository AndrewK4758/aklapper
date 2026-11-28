import {
  createPublicAppError,
  type PrivacySanitizationFinding,
  type PublicAppError,
  type QuotaStatus,
} from '@aklapper/core';
import {
  classifyServerError,
  enforcePublicErrorBoundary,
  StreamDeadlineError,
  type DiagnosticAppError,
} from '@aklapper/core/server-errors';
import { Code, ConnectError } from '@connectrpc/connect';

import { GcpOidcTokenError } from '../gcp-oidc.ts';
import {
  createFallbackLogger,
  extractCorrelationId,
  logDiagnosticError,
  type SsrStructuredLogger,
} from '../request-context.ts';
import {
  GRPC_CATALOG_BY_CODE,
  mapProtoFieldErrorsToDomain,
  mapProtoQuotaToDomain,
  mapProtoSanitizationFindingsToDomain,
  resolveConnectCatalogEntry,
  scrubDiagnosticCause,
} from './error-catalog.ts';
import { ErrorDetailEnvelopeSchema, type ErrorDetailEnvelope } from './gen/common/v1/error_pb.ts';

export {
  mapProtoFieldErrorsToDomain,
  mapProtoQuotaToDomain,
  mapProtoSanitizationFindingsToDomain,
} from './error-catalog.ts';

export interface ClassifiedGrpcFailure {
  readonly publicError: PublicAppError;
  readonly diagnostic: DiagnosticAppError;
  readonly quota?: QuotaStatus;
  readonly retryAfterSeconds?: number;
  readonly sanitizationFindings?: readonly PrivacySanitizationFinding[];
  readonly upstreamCode?: string;
  readonly upstreamMessage?: string;
  readonly isFallbackTransportError: boolean;
}

export interface ClassifyGrpcErrorContext {
  readonly correlationId: string;
  readonly source: string;
  readonly normalizeUnavailableStatus?: 503;
  readonly logger?: SsrStructuredLogger;
}

export class GrpcPayloadContractError extends Error {
  readonly schema: string;

  constructor(schema: string, message?: string) {
    super(message ?? `Upstream gRPC payload failed ${schema} validation`);
    this.name = 'GrpcPayloadContractError';
    this.schema = schema;
  }
}

export function isFallbackTransportError(failure: ClassifiedGrpcFailure): boolean {
  return failure.isFallbackTransportError === true;
}

function extractErrorDetailEnvelope(error: ConnectError): ErrorDetailEnvelope | undefined {
  const details = error.findDetails(ErrorDetailEnvelopeSchema);
  return details[0];
}

const GRPC_NETWORK_ERRNO_RE =
  /^(?:ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EPIPE|EHOSTUNREACH)$/;

function extractNetworkErrno(root: unknown): string | undefined {
  const seen = new WeakSet<object>();
  let current: unknown = root;
  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth += 1) {
    if (seen.has(current)) {
      break;
    }
    seen.add(current);
    const rec = current as Record<string, unknown>;
    if (typeof rec['code'] === 'string' && GRPC_NETWORK_ERRNO_RE.test(rec['code'])) {
      return rec['code'];
    }
    current = rec['cause'];
  }
  return undefined;
}

function logClassifiedGrpcSeam(
  logger: SsrStructuredLogger | undefined,
  diagnostic: DiagnosticAppError,
  grpcCode: string,
  fallbackEligible: boolean,
): void {
  const effectiveLogger = logger ?? createFallbackLogger('node-runtime');
  logDiagnosticError(effectiveLogger, diagnostic);
  effectiveLogger.error(
    {
      seam_type: 'BOUNDARY_FAULT',
      event: 'bff.grpc.upstream_error_classified',
      errorCode: diagnostic.code,
      httpStatus: diagnostic.status,
      grpcCode,
      isFallbackTransportError: fallbackEligible,
      source: diagnostic.source,
      correlationId: diagnostic.correlationId,
    },
    'Classified upstream gRPC failure through fail-closed error boundary',
  );
}

export function classifyGrpcError(
  error: unknown,
  ctx: ClassifyGrpcErrorContext,
): ClassifiedGrpcFailure {
  const correlationId = extractCorrelationId({
    'x-correlation-id': ctx.correlationId,
  }).correlationId;

  if (
    error instanceof GcpOidcTokenError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { readonly code?: unknown }).code === 'GCP_OIDC_TOKEN_UNAVAILABLE')
  ) {
    const [message, action] = GRPC_CATALOG_BY_CODE.ERR_UPSTREAM_UNAVAILABLE;
    const { publicError } = enforcePublicErrorBoundary(
      createPublicAppError({
        code: 'ERR_UPSTREAM_UNAVAILABLE',
        status: 503,
        message,
        action,
        correlationId,
      }),
      { correlationId, source: ctx.source },
    );
    const diagnostic: DiagnosticAppError = {
      code: publicError.code,
      status: publicError.status,
      severity: 'ERROR',
      reasoning: 'Failed to resolve Cloud Run OIDC identity token for gRPC upstream',
      correlationId,
      source: ctx.source,
      causeName: 'GcpOidcTokenError',
      causeMessage: scrubDiagnosticCause(
        error instanceof Error ? error.message : 'GCP_OIDC_TOKEN_UNAVAILABLE',
      ),
    };
    logClassifiedGrpcSeam(ctx.logger, diagnostic, 'OIDC_UNAVAILABLE', false);
    return { publicError, diagnostic, isFallbackTransportError: false };
  }

  if (
    error instanceof StreamDeadlineError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { readonly name?: unknown }).name === 'StreamDeadlineError')
  ) {
    const [message, action] = GRPC_CATALOG_BY_CODE.ERR_STREAM_TIMEOUT;
    const { publicError } = enforcePublicErrorBoundary(
      createPublicAppError({
        code: 'ERR_STREAM_TIMEOUT',
        status: 504,
        message,
        action,
        correlationId,
      }),
      { correlationId, source: ctx.source },
    );
    const diagnostic: DiagnosticAppError = {
      code: publicError.code,
      status: publicError.status,
      severity: 'ERROR',
      reasoning: 'Upstream gRPC stream header deadline exceeded',
      correlationId,
      source: ctx.source,
      causeName: 'StreamDeadlineError',
      causeMessage: scrubDiagnosticCause(error instanceof Error ? error.message : 'stream timeout'),
    };
    logClassifiedGrpcSeam(ctx.logger, diagnostic, 'HEADER_TIMEOUT', true);
    return { publicError, diagnostic, isFallbackTransportError: true };
  }

  if (
    error instanceof GrpcPayloadContractError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { readonly name?: unknown }).name === 'GrpcPayloadContractError')
  ) {
    const [message, action] = GRPC_CATALOG_BY_CODE.ERR_UPSTREAM_UNAVAILABLE;
    const { publicError } = enforcePublicErrorBoundary(
      createPublicAppError({
        code: 'ERR_UPSTREAM_UNAVAILABLE',
        status: 502,
        message,
        action,
        correlationId,
      }),
      { correlationId, source: ctx.source },
    );
    const diagnostic: DiagnosticAppError = {
      code: publicError.code,
      status: publicError.status,
      severity: 'ERROR',
      reasoning: 'Upstream gRPC response violated core payload schema contract',
      correlationId,
      source: ctx.source,
      causeName: 'GrpcPayloadContractError',
      causeMessage: scrubDiagnosticCause(
        error instanceof Error ? error.message : 'payload contract violation',
      ),
    };
    logClassifiedGrpcSeam(ctx.logger, diagnostic, 'PAYLOAD_CONTRACT_VIOLATION', false);
    return { publicError, diagnostic, isFallbackTransportError: false };
  }

  if (error instanceof ConnectError) {
    const envelope = extractErrorDetailEnvelope(error);
    const quota = mapProtoQuotaToDomain(envelope?.quota);
    const fieldErrors = mapProtoFieldErrorsToDomain(envelope?.error);
    const sanitizationFindings = mapProtoSanitizationFindingsToDomain(envelope);
    const upstreamCode = envelope?.error?.code?.trim() || undefined;
    const upstreamMessage = envelope?.error?.message?.trim() || undefined;
    const retryAfterSeconds =
      typeof envelope?.retryAfterSeconds === 'number' &&
      Number.isInteger(envelope.retryAfterSeconds) &&
      envelope.retryAfterSeconds > 0
        ? envelope.retryAfterSeconds
        : undefined;
    const { entry, isTransportFallback } = resolveConnectCatalogEntry(
      error,
      envelope,
      ctx.normalizeUnavailableStatus,
    );
    const { publicError } = enforcePublicErrorBoundary(
      createPublicAppError({
        code: entry.code,
        status: entry.status,
        message: entry.message,
        action: entry.action,
        correlationId,
        ...(fieldErrors ? { fieldErrors } : {}),
      }),
      { correlationId, source: ctx.source },
    );
    const diagnostic: DiagnosticAppError = {
      code: publicError.code,
      status: publicError.status,
      severity: entry.severity,
      reasoning: `Upstream gRPC failed with Code.${Code[error.code] ?? String(error.code)}`,
      correlationId,
      source: ctx.source,
      causeName: 'ConnectError',
      causeMessage: scrubDiagnosticCause(error.rawMessage || error.message),
    };
    logClassifiedGrpcSeam(
      ctx.logger,
      diagnostic,
      Code[error.code] ?? String(error.code),
      isTransportFallback,
    );
    return {
      publicError,
      diagnostic,
      ...(quota ? { quota } : {}),
      ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
      ...(sanitizationFindings ? { sanitizationFindings } : {}),
      ...(upstreamCode ? { upstreamCode } : {}),
      ...(upstreamMessage ? { upstreamMessage } : {}),
      isFallbackTransportError: isTransportFallback,
    };
  }

  const networkErrno = extractNetworkErrno(error);
  if (networkErrno) {
    const [message, action] = GRPC_CATALOG_BY_CODE.ERR_UPSTREAM_UNAVAILABLE;
    const status = ctx.normalizeUnavailableStatus ?? 502;
    const { publicError } = enforcePublicErrorBoundary(
      createPublicAppError({
        code: 'ERR_UPSTREAM_UNAVAILABLE',
        status,
        message,
        action,
        correlationId,
      }),
      { correlationId, source: ctx.source },
    );
    const diagnostic: DiagnosticAppError = {
      code: publicError.code,
      status: publicError.status,
      severity: 'ERROR',
      reasoning: `Upstream gRPC transport network error (${networkErrno})`,
      correlationId,
      source: ctx.source,
      causeName: error instanceof Error ? error.name || 'Error' : 'NetworkError',
      causeMessage: scrubDiagnosticCause(error instanceof Error ? error.message : networkErrno),
    };
    logClassifiedGrpcSeam(ctx.logger, diagnostic, networkErrno, true);
    return { publicError, diagnostic, isFallbackTransportError: true };
  }

  const classified = classifyServerError(error, { correlationId, source: ctx.source });
  logClassifiedGrpcSeam(ctx.logger, classified.diagnostic, 'NON_GRPC_ERROR', false);
  return {
    publicError: classified.publicError,
    diagnostic: classified.diagnostic,
    isFallbackTransportError: false,
  };
}

export function classifyAdminGrpcError(
  error: unknown,
  ctx: ClassifyGrpcErrorContext,
): ClassifiedGrpcFailure {
  const failure = classifyGrpcError(error, ctx);
  const effectiveLogger = ctx.logger ?? createFallbackLogger('admin-ssr');
  effectiveLogger.error(
    {
      seam_type: 'BOUNDARY_FAULT',
      event: 'bff.grpc.admin_error_classified',
      errorCode: failure.publicError.code,
      httpStatus: failure.publicError.status,
      upstreamCode: failure.upstreamCode ?? failure.publicError.code,
      sanitizationFindingCount: failure.sanitizationFindings?.length ?? 0,
      source: ctx.source,
      correlationId: failure.publicError.correlationId,
    },
    'Classified admin-api gRPC failure through fail-closed error boundary',
  );
  return failure;
}
