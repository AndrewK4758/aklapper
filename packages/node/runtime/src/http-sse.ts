import { createPublicAppError } from '@aklapper/core';
import {
  classifyServerError,
  enforcePublicErrorBoundary,
  StreamDeadlineError,
} from '@aklapper/core/server-errors';

import { evictGcpIdentityTokenCache, resolveGcpIdentityToken } from './gcp-oidc.ts';
import {
  buildSafeUpstreamSseErrorResponse,
  emitSseTerminationMetric,
  stripHopByHopHeaders,
  type StreamTerminationBranch,
} from './http-hygiene.ts';
import {
  INTERNAL_AUTH_HEADER,
  joinUpstreamUrl,
  resolveTargetOidcAudience,
  signInternalAuthToken,
  type OidcAuthMode,
  type SignInternalAuthTokenOptions,
} from './http.ts';
import {
  createFallbackLogger,
  extractCorrelationId,
  logDiagnosticError,
  type SsrStructuredLogger,
} from './request-context.ts';

export const DEFAULT_SSE_HEADER_TIMEOUT_MS = 15_000;

export interface ProxyPostSseOptions {
  readonly baseUrl: string;
  readonly path: string;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  readonly headerTimeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly internalAuth?: SignInternalAuthTokenOptions;
  readonly oidcAuth?: OidcAuthMode;
  readonly correlationId?: string;
  readonly source?: string;
  readonly logger?: SsrStructuredLogger;
  readonly env?: Record<string, string | undefined>;
  readonly fetchImpl?: typeof fetch;
}

function wrapStreamWithTerminationTracking(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal | undefined,
  logger: SsrStructuredLogger,
  source: string,
  correlationId: string,
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  let terminated = false;
  const finish = (branch: StreamTerminationBranch): void => {
    if (terminated) return;
    terminated = true;
    emitSseTerminationMetric(logger, branch, source, correlationId);
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          finish(signal?.aborted ? 'client_aborted' : 'completed');
          controller.close();
          return;
        }
        if (value) {
          controller.enqueue(value);
        }
      } catch (err) {
        finish(signal?.aborted ? 'client_aborted' : 'upstream_error');
        controller.error(err);
      }
    },
    async cancel(reason) {
      finish(signal?.aborted ? 'client_aborted' : 'completed');
      await reader.cancel(reason).catch(() => undefined);
    },
  });
}

/**
 * Proxies an HTTP/2 POST SSE upstream with header-only timeout (cleared on header receipt),
 * full-lifetime caller AbortSignal propagation, Cloud Run OIDC auth (evicting cache on 401/403
 * without retrying non-idempotent POST), RFC 9113 hop-by-hop stripping, and wire-safe
 * PublicAppError + 429 QuotaStatus error classification.
 */
export async function proxyPostSse(options: ProxyPostSseOptions): Promise<Response> {
  const {
    baseUrl,
    path,
    body,
    headers = {},
    headerTimeoutMs = DEFAULT_SSE_HEADER_TIMEOUT_MS,
    signal,
    internalAuth,
    oidcAuth = 'auto',
    source = 'bff.proxyPostSse',
    logger = createFallbackLogger('node-runtime'),
    env = process.env,
    fetchImpl = fetch,
  } = options;

  const targetUrl = joinUpstreamUrl(baseUrl, path);
  const requestHeaders = new Headers(headers);
  const correlationId =
    options.correlationId?.trim() || extractCorrelationId(requestHeaders).correlationId;

  requestHeaders.set('accept', 'text/event-stream');
  requestHeaders.set('x-correlation-id', correlationId);
  if (internalAuth) {
    requestHeaders.set(INTERNAL_AUTH_HEADER, signInternalAuthToken(internalAuth));
  }

  const audience = resolveTargetOidcAudience(
    baseUrl,
    oidcAuth,
    env,
    requestHeaders.has('authorization'),
  );
  if (audience) {
    try {
      const token = await resolveGcpIdentityToken(audience, { fetchImpl, env });
      requestHeaders.set('authorization', `Bearer ${token}`);
    } catch (error) {
      const publicError = createPublicAppError({
        code: 'ERR_UPSTREAM_UNAVAILABLE',
        status: 503,
        message: 'Upstream service unreachable.',
        action: 'Retry shortly or go home.',
        correlationId,
      });
      logger.error(
        {
          seam_type: 'BOUNDARY_FAULT',
          event: 'bff.sse.upstream_error_classified',
          errorCode: publicError.code,
          reason: error instanceof Error ? error.name : 'GcpOidcTokenError',
          source,
          correlationId,
        },
        'Failed to resolve Cloud Run OIDC identity token for POST SSE upstream',
      );
      emitSseTerminationMetric(logger, 'upstream_error', source, correlationId);
      return Response.json(publicError, {
        status: 503,
        headers: { 'x-correlation-id': correlationId },
      });
    }
  }

  let encodedBody: BodyInit | undefined;
  if (body !== undefined) {
    if (typeof body === 'string' || body instanceof Uint8Array || body instanceof ArrayBuffer) {
      encodedBody = body as BodyInit;
    } else {
      encodedBody = JSON.stringify(body);
      if (!requestHeaders.has('content-type')) {
        requestHeaders.set('content-type', 'application/json');
      }
    }
  }

  const headerController = new AbortController();
  let headerTimedOut = false;
  const headerTimer = setTimeout(() => {
    headerTimedOut = true;
    headerController.abort(new StreamDeadlineError(headerTimeoutMs, source));
  }, headerTimeoutMs);

  const compositeSignal = signal
    ? AbortSignal.any([signal, headerController.signal])
    : headerController.signal;

  let upstream: Response;
  try {
    upstream = await fetchImpl(targetUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: encodedBody,
      signal: compositeSignal,
    });
  } catch (error) {
    clearTimeout(headerTimer);

    if (headerTimedOut || error instanceof StreamDeadlineError) {
      const deadlineErr = new StreamDeadlineError(headerTimeoutMs, source);
      const { publicError, diagnostic } = classifyServerError(deadlineErr, {
        correlationId,
        source,
      });
      logDiagnosticError(logger, diagnostic);
      logger.error(
        {
          seam_type: 'BOUNDARY_FAULT',
          event: 'bff.sse.upstream_error_classified',
          errorCode: publicError.code,
          httpStatus: publicError.status,
          source,
          correlationId,
        },
        'POST SSE upstream response header timeout exceeded',
      );
      emitSseTerminationMetric(logger, 'header_timeout', source, correlationId);
      return Response.json(publicError, {
        status: 504,
        headers: { 'x-correlation-id': correlationId },
      });
    }

    if (signal?.aborted) {
      const abortErr = new DOMException('Client aborted request', 'AbortError');
      const { publicError, diagnostic } = classifyServerError(abortErr, { correlationId, source });
      logDiagnosticError(logger, diagnostic);
      emitSseTerminationMetric(logger, 'client_aborted', source, correlationId);
      return Response.json(publicError, {
        status: 499,
        headers: { 'x-correlation-id': correlationId },
      });
    }

    const { publicError } = enforcePublicErrorBoundary(
      createPublicAppError({
        code: 'ERR_UPSTREAM_UNAVAILABLE',
        status: 502,
        message: 'Upstream service unreachable.',
        action: 'Retry shortly or go home.',
        correlationId,
      }),
      { correlationId, source },
    );
    logger.error(
      {
        seam_type: 'BOUNDARY_FAULT',
        event: 'bff.sse.upstream_error_classified',
        errorCode: publicError.code,
        httpStatus: publicError.status,
        causeName: error instanceof Error ? error.name : typeof error,
        source,
        correlationId,
      },
      'POST SSE upstream transport failure',
    );
    emitSseTerminationMetric(logger, 'upstream_error', source, correlationId);
    return Response.json(publicError, {
      status: 502,
      headers: { 'x-correlation-id': correlationId },
    });
  }

  clearTimeout(headerTimer);

  // Match proxyJson canRetryAuth discipline: evict stale OIDC token on 401/403 without auto-retrying POST.
  if (audience && (upstream.status === 401 || upstream.status === 403)) {
    evictGcpIdentityTokenCache(audience);
  }

  if (!upstream.ok || !upstream.body) {
    const rawBody = await upstream.text().catch(() => '');
    return buildSafeUpstreamSseErrorResponse(
      upstream.ok ? 502 : upstream.status,
      rawBody,
      correlationId,
      source,
      logger,
    );
  }

  const responseHeaders = stripHopByHopHeaders(upstream.headers, stripped => {
    logger.warn(
      {
        seam_type: 'BOUNDARY_FAULT',
        event: 'ssr.request.hop_by_hop_stripped',
        strippedHeaders: stripped,
        source,
        correlationId,
      },
      'Stripped RFC 9113 hop-by-hop headers from upstream SSE response',
    );
  });
  responseHeaders.set(
    'content-type',
    upstream.headers.get('content-type') ?? 'text/event-stream; charset=utf-8',
  );
  responseHeaders.set('cache-control', 'no-cache');
  responseHeaders.set('x-accel-buffering', 'no');
  responseHeaders.set('x-correlation-id', correlationId);

  const trackedBody = wrapStreamWithTerminationTracking(
    upstream.body,
    signal,
    logger,
    source,
    correlationId,
  );

  return new Response(trackedBody, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
