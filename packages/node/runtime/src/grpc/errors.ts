import {
  createPublicAppError,
  QuotaStatusSchema,
  type AppErrorCode,
  type PublicAppError,
  type QuotaStatus,
} from '@aklapper/core';
import {
  classifyServerError,
  enforcePublicErrorBoundary,
  StreamDeadlineError,
  type DiagnosticAppError,
  type DiagnosticSeverity,
} from '@aklapper/core/server-errors';
import { Code, ConnectError } from '@connectrpc/connect';

import { GcpOidcTokenError } from '../gcp-oidc.ts';
import {
  extractCorrelationId,
  logDiagnosticError,
  type SsrStructuredLogger,
} from '../request-context.ts';
import {
  ErrorDetailEnvelopeSchema,
  type ErrorDetailEnvelope,
  type QuotaStatus as ProtoQuotaStatus,
} from './gen/common/v1/error_pb.ts';

export interface ClassifiedGrpcFailure {
  readonly publicError: PublicAppError;
  readonly diagnostic: DiagnosticAppError;
  readonly quota?: QuotaStatus;
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

interface CatalogEntry {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly message: string;
  readonly action: string;
  readonly severity: DiagnosticSeverity;
}

const GRPC_CATALOG_BY_CODE: Readonly<Record<AppErrorCode, readonly [string, string]>> = {
  ERR_VALIDATION: ['Submitted fields need attention.', 'Review highlighted fields and retry.'],
  ERR_CONSTRAINT: ['Data failed storage validation.', 'Check highlighted fields and retry.'],
  ERR_NOT_FOUND: ['Resource could not be found.', 'Verify the URL or return home.'],
  ERR_UNAUTHORIZED: ['Authentication is required.', 'Sign in with admin credentials.'],
  ERR_FORBIDDEN: ['Permission denied for action.', 'Return home or sign in again.'],
  ERR_RATE_LIMITED: ['Too many requests received.', 'Wait a moment and submit again.'],
  ERR_DB_UNAVAILABLE: ['Database temporarily unavailable.', 'Retry shortly or share ID.'],
  ERR_STREAM_TIMEOUT: ['Section took too long to load.', 'Retry loading or refresh.'],
  ERR_STREAM_ABORTED: ['Request cancelled early.', 'Retry if you still need this view.'],
  ERR_UPSTREAM_UNAVAILABLE: ['Upstream service unreachable.', 'Retry shortly or go home.'],
  ERR_INTERNAL: ['Unexpected server error.', 'Retry or share the reference ID.'],
};

const CONFLICT_409_CATALOG: readonly [string, string] = [
  'A conflicting operation is already in progress.',
  'Wait for the active operation to complete and retry.',
];

const PRIVACY_422_CATALOG: readonly [string, string] = [
  'Corpus document rejected by content policy.',
  'Remove restricted content and retry.',
];

export function isFallbackTransportError(failure: ClassifiedGrpcFailure): boolean {
  return failure.isFallbackTransportError === true;
}

export function mapProtoQuotaToDomain(proto?: ProtoQuotaStatus): QuotaStatus | undefined {
  if (!proto) return undefined;
  const parsed = QuotaStatusSchema.safeParse({
    role: proto.role,
    turnsUsed: proto.turnsUsed,
    maxTurns: proto.maxTurns,
    tokensUsed: proto.tokensUsed,
    maxTokens: proto.maxTokens,
  });
  return parsed.success ? parsed.data : undefined;
}

function scrubDiagnosticCause(raw: string): string {
  return raw
    .replace(/x-internal-auth\s*[:=]\s*\S+/gi, 'x-internal-auth=[redacted]')
    .replace(/authorization\s*[:=]\s*\S+(?:\s+\S+)?/gi, 'authorization=[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/\bpostgres(?:ql)?:\/\/\S+/gi, 'postgresql://[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 512);
}

function extractErrorDetailEnvelope(error: ConnectError): ErrorDetailEnvelope | undefined {
  const details = error.findDetails(ErrorDetailEnvelopeSchema);
  return details[0];
}

function resolveConnectCatalogEntry(
  error: ConnectError,
  envelope: ErrorDetailEnvelope | undefined,
  normalizeUnavailableStatus?: 503,
): { readonly entry: CatalogEntry; readonly isTransportFallback: boolean } {
  const detailErr = envelope?.error;
  const hasAppDetail = Boolean(detailErr && (detailErr.code || detailErr.status >= 400));

  switch (error.code) {
    case Code.InvalidArgument: {
      const [message, action] = GRPC_CATALOG_BY_CODE.ERR_VALIDATION;
      return {
        entry: { code: 'ERR_VALIDATION', status: 400, message, action, severity: 'WARN' },
        isTransportFallback: false,
      };
    }
    case Code.Unauthenticated: {
      const [message, action] = GRPC_CATALOG_BY_CODE.ERR_UNAUTHORIZED;
      return {
        entry: { code: 'ERR_UNAUTHORIZED', status: 401, message, action, severity: 'WARN' },
        isTransportFallback: false,
      };
    }
    case Code.PermissionDenied: {
      const [message, action] = GRPC_CATALOG_BY_CODE.ERR_FORBIDDEN;
      return {
        entry: { code: 'ERR_FORBIDDEN', status: 403, message, action, severity: 'WARN' },
        isTransportFallback: false,
      };
    }
    case Code.NotFound: {
      const [message, action] = GRPC_CATALOG_BY_CODE.ERR_NOT_FOUND;
      return {
        entry: { code: 'ERR_NOT_FOUND', status: 404, message, action, severity: 'WARN' },
        isTransportFallback: false,
      };
    }
    case Code.AlreadyExists: {
      const appCode: AppErrorCode =
        detailErr?.code === 'ERR_VALIDATION' ? 'ERR_VALIDATION' : 'ERR_CONSTRAINT';
      const [message, action] =
        appCode === 'ERR_VALIDATION' ? GRPC_CATALOG_BY_CODE.ERR_VALIDATION : CONFLICT_409_CATALOG;
      return {
        entry: { code: appCode, status: 409, message, action, severity: 'WARN' },
        isTransportFallback: false,
      };
    }
    case Code.FailedPrecondition: {
      if (detailErr?.status === 422) {
        const [message, action] = PRIVACY_422_CATALOG;
        return {
          entry: { code: 'ERR_CONSTRAINT', status: 422, message, action, severity: 'WARN' },
          isTransportFallback: false,
        };
      }
      const [message, action] = CONFLICT_409_CATALOG;
      return {
        entry: { code: 'ERR_CONSTRAINT', status: 409, message, action, severity: 'WARN' },
        isTransportFallback: false,
      };
    }
    case Code.ResourceExhausted: {
      const [message, action] = GRPC_CATALOG_BY_CODE.ERR_RATE_LIMITED;
      return {
        entry: { code: 'ERR_RATE_LIMITED', status: 429, message, action, severity: 'WARN' },
        isTransportFallback: false,
      };
    }
    case Code.Canceled: {
      const [message, action] = GRPC_CATALOG_BY_CODE.ERR_STREAM_ABORTED;
      return {
        entry: { code: 'ERR_STREAM_ABORTED', status: 499, message, action, severity: 'WARN' },
        isTransportFallback: false,
      };
    }
    case Code.DeadlineExceeded: {
      const [message, action] = GRPC_CATALOG_BY_CODE.ERR_STREAM_TIMEOUT;
      return {
        entry: { code: 'ERR_STREAM_TIMEOUT', status: 504, message, action, severity: 'ERROR' },
        isTransportFallback: !hasAppDetail,
      };
    }
    case Code.Unavailable: {
      if (hasAppDetail && detailErr?.code === 'ERR_DB_UNAVAILABLE') {
        const [message, action] = GRPC_CATALOG_BY_CODE.ERR_DB_UNAVAILABLE;
        return {
          entry: { code: 'ERR_DB_UNAVAILABLE', status: 503, message, action, severity: 'ERROR' },
          isTransportFallback: false,
        };
      }
      const [message, action] = GRPC_CATALOG_BY_CODE.ERR_UPSTREAM_UNAVAILABLE;
      const status = hasAppDetail
        ? detailErr && detailErr.status >= 500 && detailErr.status <= 599
          ? (normalizeUnavailableStatus ?? detailErr.status)
          : (normalizeUnavailableStatus ?? 502)
        : (normalizeUnavailableStatus ?? 502);
      return {
        entry: { code: 'ERR_UPSTREAM_UNAVAILABLE', status, message, action, severity: 'ERROR' },
        isTransportFallback: !hasAppDetail,
      };
    }
    default: {
      const [message, action] = GRPC_CATALOG_BY_CODE.ERR_INTERNAL;
      return {
        entry: { code: 'ERR_INTERNAL', status: 500, message, action, severity: 'ERROR' },
        isTransportFallback: false,
      };
    }
  }
}

function logClassifiedGrpcSeam(
  logger: SsrStructuredLogger | undefined,
  diagnostic: DiagnosticAppError,
  grpcCode: string,
  fallbackEligible: boolean,
): void {
  if (!logger) return;
  logDiagnosticError(logger, diagnostic);
  logger.error(
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
      isFallbackTransportError: isTransportFallback,
    };
  }

  const classified = classifyServerError(error, { correlationId, source: ctx.source });
  logClassifiedGrpcSeam(ctx.logger, classified.diagnostic, 'NON_GRPC_ERROR', false);
  return {
    publicError: classified.publicError,
    diagnostic: classified.diagnostic,
    isFallbackTransportError: false,
  };
}
