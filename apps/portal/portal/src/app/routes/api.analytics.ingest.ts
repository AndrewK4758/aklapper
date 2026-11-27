import {
  ANALYTICS_MAX_BATCH_BYTES,
  AnalyticsBatchSchema,
  createPublicAppError,
} from '@aklapper/core';
import { classifyGrpcError, ingestPortalAnalytics } from '@aklapper/node-runtime/grpc';
import {
  createFallbackLogger,
  getOrCreateCorrelationId,
  getRequestContext,
} from '@aklapper/node-runtime/ssr/stream';

import { readPassiveGuestSession } from '../contact-analytics-link.server';
import { extractClientRequestContext, resolvePortalApiUrl } from '../portal-api.server';
import type { Route } from './+types/api.analytics.ingest';

const utf8Encoder = new TextEncoder();
const INGEST_TIMEOUT_MS = 4_000;

export async function action({ request, context }: Route.ActionArgs): Promise<Response> {
  const reqCtx = getRequestContext(context);
  const correlationId = getOrCreateCorrelationId(request, context);
  const logger = reqCtx?.logger ?? createFallbackLogger('portal-analytics-ingest');
  const baseHeaders: Record<string, string> = { 'X-Correlation-Id': correlationId };

  if (request.method.toUpperCase() !== 'POST') {
    const publicError = createPublicAppError({
      code: 'ERR_VALIDATION',
      status: 405,
      message: 'Method not allowed.',
      action: 'Submit analytics batches via HTTP POST.',
      correlationId,
    });
    return Response.json(publicError, {
      status: 405,
      headers: { ...baseHeaders, Allow: 'POST' },
    });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    const publicError = createPublicAppError({
      code: 'ERR_VALIDATION',
      status: 400,
      message: 'Malformed analytics payload.',
      action: 'Review event payload formatting and retry.',
      correlationId,
    });
    return Response.json(publicError, { status: 400, headers: baseHeaders });
  }

  if (utf8Encoder.encode(rawBody).byteLength > ANALYTICS_MAX_BATCH_BYTES) {
    const publicError = createPublicAppError({
      code: 'ERR_VALIDATION',
      status: 400,
      message: 'Analytics batch exceeds maximum allowed payload size.',
      action: 'Reduce batch size or metadata size and retry.',
      correlationId,
    });
    return Response.json(publicError, { status: 400, headers: baseHeaders });
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(rawBody);
  } catch {
    const publicError = createPublicAppError({
      code: 'ERR_VALIDATION',
      status: 400,
      message: 'Malformed JSON analytics payload.',
      action: 'Review event payload formatting and retry.',
      correlationId,
    });
    return Response.json(publicError, { status: 400, headers: baseHeaders });
  }

  const parsed = AnalyticsBatchSchema.safeParse(decoded);
  if (!parsed.success) {
    const publicError = createPublicAppError({
      code: 'ERR_VALIDATION',
      status: 400,
      message: 'Submitted analytics batch failed validation.',
      action: 'Review event metadata limits and retry.',
      correlationId,
    });
    return Response.json(publicError, { status: 400, headers: baseHeaders });
  }

  const portalApiUrl = resolvePortalApiUrl();
  if (!portalApiUrl) {
    const publicError = createPublicAppError({
      code: 'ERR_UPSTREAM_UNAVAILABLE',
      status: 503,
      message: 'Upstream service unreachable.',
      action: 'Retry shortly or go home.',
      correlationId,
    });
    return Response.json(publicError, { status: 503, headers: baseHeaders });
  }

  try {
    const { clientContext, signedClientIp } = extractClientRequestContext(
      request,
      readPassiveGuestSession(request),
    );
    const result = await ingestPortalAnalytics(
      {
        baseUrl: portalApiUrl,
        internalAuth: { role: 'service', subject: 'portal-analytics-ingest' },
        signedClientIp,
        correlationId,
        timeoutMs: INGEST_TIMEOUT_MS,
        signal: reqCtx?.signal ?? request.signal,
        logger,
      },
      parsed.data,
      clientContext,
    );
    return Response.json(
      {
        accepted: result.accepted,
        sessionId: result.sessionId,
        ipHash: result.ipHash,
      },
      { status: 202, headers: baseHeaders },
    );
  } catch (error) {
    const failure = classifyGrpcError(error, {
      correlationId,
      source: 'portal.analytics.ingest',
      normalizeUnavailableStatus: 503,
      logger,
    });
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
