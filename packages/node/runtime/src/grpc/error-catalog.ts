import {
  QuotaStatusSchema,
  type AppErrorCode,
  type FormFieldErrorMap,
  type QuotaStatus,
} from '@aklapper/core';
import type { DiagnosticSeverity } from '@aklapper/core/server-errors';
import { Code, type ConnectError } from '@connectrpc/connect';

import type {
  ErrorDetailEnvelope,
  PublicAppError as ProtoPublicAppError,
  QuotaStatus as ProtoQuotaStatus,
} from './gen/common/v1/error_pb.ts';

export interface GrpcCatalogEntry {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly message: string;
  readonly action: string;
  readonly severity: DiagnosticSeverity;
}

export const GRPC_CATALOG_BY_CODE: Readonly<Record<AppErrorCode, readonly [string, string]>> = {
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

export function mapProtoFieldErrorsToDomain(
  protoErr?: ProtoPublicAppError,
): FormFieldErrorMap | undefined {
  if (!protoErr?.fieldErrors) return undefined;
  const out: FormFieldErrorMap = {};
  let count = 0;
  for (const [field, list] of Object.entries(protoErr.fieldErrors)) {
    const cleanField = field.trim();
    if (!cleanField || !list?.messages?.length) continue;
    const msgs = list.messages.map(m => m.trim()).filter(Boolean);
    if (msgs.length > 0) {
      out[cleanField] = msgs;
      count++;
    }
  }
  return count > 0 ? out : undefined;
}

export function scrubDiagnosticCause(raw: string): string {
  return raw
    .replace(/x-internal-auth\s*[:=]\s*\S+/gi, 'x-internal-auth=[redacted]')
    .replace(/x-internal-client-ip\s*[:=]\s*\S+/gi, 'x-internal-client-ip=[redacted]')
    .replace(/authorization\s*[:=]\s*\S+(?:\s+\S+)?/gi, 'authorization=[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/\bpostgres(?:ql)?:\/\/\S+/gi, 'postgresql://[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 512);
}

export function resolveConnectCatalogEntry(
  error: ConnectError,
  envelope: ErrorDetailEnvelope | undefined,
  normalizeUnavailableStatus?: 503,
): { readonly entry: GrpcCatalogEntry; readonly isTransportFallback: boolean } {
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
        const hasFieldErrors = mapProtoFieldErrorsToDomain(detailErr) !== undefined;
        const [message, action] = hasFieldErrors
          ? GRPC_CATALOG_BY_CODE.ERR_CONSTRAINT
          : PRIVACY_422_CATALOG;
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
      const status =
        hasAppDetail && detailErr && detailErr.status >= 500 && detailErr.status <= 599
          ? (normalizeUnavailableStatus ?? detailErr.status)
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
