import {
  QuotaStatusSchema,
  StreamErrorPayloadSchema,
  type AppErrorCode,
  type QuotaStatus,
  type StreamErrorPayload,
} from '@aklapper/core';
import { enforcePublicErrorBoundary } from '@aklapper/core/server-errors';

import type { SsrStructuredLogger } from './request-context.ts';

/** RFC 9113 / RFC 9110 hop-by-hop headers forbidden on HTTP/2 responses. */
export const HOP_BY_HOP_HEADERS: ReadonlySet<string> = new Set([
  'connection',
  'keep-alive',
  'proxy-connection',
  'te',
  'transfer-encoding',
  'upgrade',
]);

/**
 * Symmetric fail-closed production check matching Go internalauth.IsProductionEnv(): returns true
 * if EITHER NODE_ENV OR APP_ENV is "production" (case-insensitive, trimmed).
 */
export function isProductionEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const nodeEnv = (env['NODE_ENV'] ?? '').trim().toLowerCase();
  const appEnv = (env['APP_ENV'] ?? '').trim().toLowerCase();
  return nodeEnv === 'production' || appEnv === 'production';
}

export function collectHopByHopNames(headers: Headers): Set<string> {
  const forbidden = new Set<string>(HOP_BY_HOP_HEADERS);
  const connectionVal = headers.get('connection');
  if (connectionVal) {
    for (const token of connectionVal.split(',')) {
      const normalized = token.trim().toLowerCase();
      if (normalized) {
        forbidden.add(normalized);
      }
    }
  }
  return forbidden;
}

export function stripHopByHopHeaders(
  headers: Headers,
  onStripped?: (stripped: readonly string[]) => void,
): Headers {
  const forbidden = collectHopByHopNames(headers);
  const clean = new Headers();
  const stripped: string[] = [];

  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (forbidden.has(lower)) {
      if (!stripped.includes(lower)) {
        stripped.push(lower);
      }
      return;
    }
    clean.append(key, value);
  });

  if (stripped.length > 0 && onStripped) {
    onStripped(stripped);
  }
  return clean;
}

export type StreamTerminationBranch =
  | 'completed'
  | 'client_aborted'
  | 'header_timeout'
  | 'upstream_error';

export function emitSseTerminationMetric(
  logger: SsrStructuredLogger,
  branch: StreamTerminationBranch,
  source: string,
  correlationId: string,
): void {
  logger.info(
    {
      seam_type: 'RULE_DIVERGENCE',
      event: 'bff.sse.stream_termination',
      branch,
      source,
      correlationId,
    },
    `POST SSE stream terminated (${branch})`,
  );
}

function mapUpstreamStatusToErrorCode(status: number): AppErrorCode {
  switch (status) {
    case 400:
      return 'ERR_VALIDATION';
    case 401:
      return 'ERR_UNAUTHORIZED';
    case 403:
      return 'ERR_FORBIDDEN';
    case 404:
      return 'ERR_NOT_FOUND';
    case 409:
    case 422:
      return 'ERR_CONSTRAINT';
    case 429:
      return 'ERR_RATE_LIMITED';
    case 499:
      return 'ERR_STREAM_ABORTED';
    case 504:
      return 'ERR_STREAM_TIMEOUT';
    default:
      return status >= 500 ? 'ERR_UPSTREAM_UNAVAILABLE' : 'ERR_VALIDATION';
  }
}

function defaultCatalogTuple(code: AppErrorCode): readonly [message: string, action: string] {
  switch (code) {
    case 'ERR_VALIDATION':
      return ['Submitted fields need attention.', 'Review highlighted fields and retry.'];
    case 'ERR_CONSTRAINT':
      return ['Request conflicts with an active operation.', 'Wait for completion or refresh.'];
    case 'ERR_NOT_FOUND':
      return ['Resource could not be found.', 'Verify the URL or return home.'];
    case 'ERR_UNAUTHORIZED':
      return ['Authentication is required.', 'Sign in and retry.'];
    case 'ERR_FORBIDDEN':
      return ['Permission denied for action.', 'Return home or sign in again.'];
    case 'ERR_RATE_LIMITED':
      return ['Too many requests received.', 'Wait a moment and submit again.'];
    case 'ERR_STREAM_TIMEOUT':
      return ['Section took too long to load.', 'Retry loading or refresh.'];
    case 'ERR_STREAM_ABORTED':
      return ['Request cancelled early.', 'Retry if you still need this view.'];
    default:
      return ['Upstream service unreachable.', 'Retry shortly or go home.'];
  }
}

export function buildSafeUpstreamSseErrorResponse(
  status: number,
  rawBody: string,
  correlationId: string,
  source: string,
  logger: SsrStructuredLogger,
): Response {
  const safeStatus = status >= 400 && status <= 599 ? status : 502;
  const fallbackCode = mapUpstreamStatusToErrorCode(safeStatus);
  const [fallbackMsg, fallbackAction] = defaultCatalogTuple(fallbackCode);
  const mapped5xxStatus = safeStatus === 502 ? 502 : safeStatus === 504 ? 504 : 503;
  const effectiveStatus = safeStatus < 500 ? safeStatus : mapped5xxStatus;

  let parsedJson: Record<string, unknown> | null = null;
  try {
    const candidate: unknown = JSON.parse(rawBody);
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      parsedJson = candidate as Record<string, unknown>;
    }
  } catch {
    parsedJson = null;
  }

  let validatedQuota: QuotaStatus | undefined;
  if (safeStatus === 429 && parsedJson && 'quota' in parsedJson) {
    const qParsed = QuotaStatusSchema.safeParse(parsedJson['quota']);
    if (qParsed.success) {
      validatedQuota = qParsed.data;
    }
  }

  // Always construct wire-safe error message and action strictly from the allow-listed catalog;
  // never echo raw upstream message/error/action strings (even on 4xx JSON without a code field).
  const catalogCandidate = {
    code: fallbackCode,
    status: effectiveStatus,
    message: fallbackMsg,
    action: fallbackAction,
    correlationId,
  };

  const checked = enforcePublicErrorBoundary(catalogCandidate, {
    correlationId,
    source,
    onViolation: fault => logger.error(fault as unknown as Record<string, unknown>, fault.reason),
  });
  const safeCorrelationId = checked.publicError.correlationId;
  const resolvedError =
    checked.violation !== null
      ? {
          code: fallbackCode,
          status: effectiveStatus,
          message: fallbackMsg,
          action: fallbackAction,
          correlationId: safeCorrelationId,
        }
      : checked.publicError;

  const finalStatus =
    safeStatus === 409 || safeStatus === 504 || safeStatus === 429 || safeStatus === 403
      ? safeStatus
      : resolvedError.status;

  const payload: StreamErrorPayload = StreamErrorPayloadSchema.parse({
    code: finalStatus === 504 ? 'ERR_STREAM_TIMEOUT' : resolvedError.code,
    status: finalStatus,
    message: finalStatus === 504 ? 'Section took too long to load.' : resolvedError.message,
    action: finalStatus === 504 ? 'Retry loading or refresh.' : resolvedError.action,
    correlationId: safeCorrelationId,
    ...(validatedQuota ? { quota: validatedQuota } : {}),
  });

  logger.error(
    {
      seam_type: 'BOUNDARY_FAULT',
      event: 'bff.sse.upstream_error_classified',
      upstreamStatus: status,
      errorCode: payload.code,
      httpStatus: payload.status,
      source,
      correlationId: safeCorrelationId,
    },
    'Classified non-2xx POST SSE upstream response',
  );
  emitSseTerminationMetric(logger, 'upstream_error', source, safeCorrelationId);

  return Response.json(payload, {
    status: payload.status,
    headers: { 'x-correlation-id': safeCorrelationId },
  });
}
