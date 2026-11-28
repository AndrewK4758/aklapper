import {
  ANALYTICS_MAX_BATCH_BYTES,
  AnalyticsBatchSchema,
  createPublicAppError,
} from '@aklapper/core';
import {
  classifyGrpcError,
  ingestAdminAnalyticsViaGrpc,
  resolveRequestClientIp,
} from '@aklapper/node-runtime/grpc';
import {
  createFallbackLogger,
  getOrCreateCorrelationId,
  getRequestContext,
} from '@aklapper/node-runtime/ssr/stream';

import { requireAdminSession } from '../admin-ops.server';
import type { Route } from './+types/api.analytics.ingest';

const INGEST_TIMEOUT_MS = 4_000;

function validationResponse(
  status: number,
  message: string,
  action: string,
  correlationId: string,
  extraHeaders?: Record<string, string>,
): Response {
  const publicError = createPublicAppError({
    code: 'ERR_VALIDATION',
    status,
    message,
    action,
    correlationId,
  });
  return Response.json(publicError, {
    status,
    headers: { 'X-Correlation-Id': correlationId, ...extraHeaders },
  });
}

export async function action({ request, context }: Route.ActionArgs): Promise<Response> {
  const reqCtx = getRequestContext(context);
  const correlationId = getOrCreateCorrelationId(request, context);
  const logger = reqCtx?.logger ?? createFallbackLogger('admin-analytics-ingest');
  const baseHeaders: Record<string, string> = { 'X-Correlation-Id': correlationId };

  if (request.method.toUpperCase() !== 'POST') {
    return validationResponse(
      405,
      'Method not allowed.',
      'Submit analytics batches via HTTP POST.',
      correlationId,
      { Allow: 'POST' },
    );
  }

  let sessionId: string;
  try {
    const auth = await requireAdminSession(request, {
      context,
      source: 'admin.analytics.ingest',
      mode: 'resource',
    });
    sessionId = auth.session.sessionId;
  } catch (error) {
    if (error instanceof Response) {
      if (error.status === 401) {
        logger.info(
          {
            seam_type: 'RULE_DIVERGENCE',
            event: 'admin.analytics.ingest_auth_branch',
            branch: 'unauthenticated_rejected_401',
            correlationId,
          },
          'Rejected unauthenticated admin analytics ingest request',
        );
      }
      return error;
    }
    throw error;
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return validationResponse(
      400,
      'Malformed analytics payload.',
      'Review event payload formatting and retry.',
      correlationId,
    );
  }

  if (Buffer.byteLength(rawBody, 'utf8') > ANALYTICS_MAX_BATCH_BYTES) {
    return validationResponse(
      400,
      'Analytics batch exceeds maximum allowed payload size.',
      'Reduce batch size or metadata size and retry.',
      correlationId,
    );
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(rawBody);
  } catch {
    return validationResponse(
      400,
      'Malformed JSON analytics payload.',
      'Review event payload formatting and retry.',
      correlationId,
    );
  }

  const parsed = AnalyticsBatchSchema.safeParse(decoded);
  if (!parsed.success) {
    return validationResponse(
      400,
      'Submitted analytics batch failed validation.',
      'Review event metadata limits and retry.',
      correlationId,
    );
  }

  try {
    const result = await ingestAdminAnalyticsViaGrpc(
      sessionId,
      parsed.data,
      request.headers.get('user-agent') ?? '',
      {
        correlationId,
        clientIp: resolveRequestClientIp(request),
        timeoutMs: INGEST_TIMEOUT_MS,
        signal: reqCtx?.signal ?? request.signal,
        logger,
      },
    );
    logger.info(
      {
        seam_type: 'RULE_DIVERGENCE',
        event: 'admin.analytics.ingest_auth_branch',
        branch: 'authenticated_accepted',
        accepted: result.accepted,
        correlationId,
      },
      'Accepted authenticated admin analytics batch',
    );
    return Response.json(result, { status: 202, headers: baseHeaders });
  } catch (error) {
    const failure = classifyGrpcError(error, {
      correlationId,
      source: 'admin.analytics.ingest',
      normalizeUnavailableStatus: 503,
      logger,
    });
    if (failure.publicError.status === 429) {
      logger.info(
        {
          seam_type: 'RULE_DIVERGENCE',
          event: 'admin.analytics.ingest_auth_branch',
          branch: 'rate_limited_429',
          correlationId,
        },
        'Rate-limited authenticated admin analytics ingest request',
      );
    }
    return Response.json(failure.publicError, {
      status: failure.publicError.status,
      headers: {
        ...baseHeaders,
        ...(failure.retryAfterSeconds !== undefined
          ? { 'Retry-After': String(failure.retryAfterSeconds) }
          : {}),
      },
    });
  }
}
