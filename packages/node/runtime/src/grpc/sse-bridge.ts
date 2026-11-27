import { StreamDeadlineError } from '@aklapper/core/server-errors';

import { emitSseTerminationMetric } from '../http-hygiene.ts';
import {
  createFallbackLogger,
  extractCorrelationId,
  type SsrStructuredLogger,
} from '../request-context.ts';
import { classifyGrpcError, type ClassifiedGrpcFailure } from './errors.ts';

export const DEFAULT_GRPC_SSE_HEARTBEAT_MS = 15_000;

export interface MappedSseFrame {
  readonly event: string;
  readonly data: unknown;
}

export interface GrpcSseBridgeOptions<TChunk> {
  readonly startStream: (opts: {
    readonly signal: AbortSignal;
    readonly onHeader: (headers: Headers) => void;
  }) => AsyncIterable<TChunk>;
  readonly mapChunkToSse: (chunk: TChunk) => MappedSseFrame | null;
  readonly buildPostHeaderErrorFrame?: (failure: ClassifiedGrpcFailure) => MappedSseFrame;
  readonly headerTimeoutMs: number;
  readonly heartbeatIntervalMs?: number;
  readonly signal?: AbortSignal;
  readonly correlationId: string;
  readonly source: string;
  readonly logger?: SsrStructuredLogger;
  readonly extraResponseHeaders?: HeadersInit;
  readonly normalizeUnavailableStatus?: 503;
  readonly onPreStreamFailure?: (
    failure: ClassifiedGrpcFailure,
  ) => Response | Promise<Response> | null;
}

const FORBIDDEN_SSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'proxy-connection',
]);

function applyExtraHeaders(target: Headers, extra?: HeadersInit): void {
  if (!extra) return;
  const incoming = new Headers(extra);
  const cookies = typeof incoming.getSetCookie === 'function' ? incoming.getSetCookie() : [];
  for (const cookie of cookies) {
    target.append('set-cookie', cookie);
  }
  incoming.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === 'set-cookie' || FORBIDDEN_SSE_HEADERS.has(lower)) {
      return;
    }
    if (!target.has(key)) {
      target.set(key, value);
    }
  });
}

function encodeSseFrame(event: string, data: unknown): Uint8Array {
  const safeEvent = event.replace(/[\r\n]/g, '');
  return new TextEncoder().encode(`event: ${safeEvent}\ndata: ${JSON.stringify(data)}\n\n`);
}

function defaultPostHeaderErrorFrame(failure: ClassifiedGrpcFailure): MappedSseFrame {
  return {
    event: 'error',
    data: {
      ...failure.publicError,
      ...(failure.quota ? { quota: failure.quota } : {}),
    },
  };
}

function buildPreStreamErrorResponse(
  failure: ClassifiedGrpcFailure,
  extraResponseHeaders?: HeadersInit,
): Response {
  const headers = new Headers({ 'x-correlation-id': failure.publicError.correlationId });
  applyExtraHeaders(headers, extraResponseHeaders);
  const payload = failure.quota
    ? { ...failure.publicError, quota: failure.quota }
    : failure.publicError;
  return Response.json(payload, {
    status: failure.publicError.status,
    headers,
  });
}

export async function bridgeGrpcStreamToSse<TChunk>(
  options: GrpcSseBridgeOptions<TChunk>,
): Promise<Response> {
  const logger = options.logger ?? createFallbackLogger('node-runtime');
  const correlationId = extractCorrelationId({
    'x-correlation-id': options.correlationId,
  }).correlationId;
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? DEFAULT_GRPC_SSE_HEARTBEAT_MS;
  const buildErrorFrame = options.buildPostHeaderErrorFrame ?? defaultPostHeaderErrorFrame;

  const streamAbort = new AbortController();
  const onCallerAbort = (): void => {
    streamAbort.abort(options.signal?.reason ?? new DOMException('Client aborted', 'AbortError'));
  };
  if (options.signal) {
    if (options.signal.aborted) {
      onCallerAbort();
    } else {
      options.signal.addEventListener('abort', onCallerAbort, { once: true });
    }
  }

  let headerSettled = false;
  let headerTimedOut = false;

  const clearHeaderTimer = (): void => {
    if (headerSettled) return;
    headerSettled = true;
    clearTimeout(headerTimer);
  };

  const headerTimer = setTimeout(() => {
    if (headerSettled) return;
    headerTimedOut = true;
    streamAbort.abort(new StreamDeadlineError(options.headerTimeoutMs, options.source));
  }, options.headerTimeoutMs);

  const cleanupBeforeStream = (): void => {
    clearHeaderTimer();
    if (options.signal) {
      options.signal.removeEventListener('abort', onCallerAbort);
    }
  };

  const handlePreStreamError = async (rawError: unknown): Promise<Response> => {
    cleanupBeforeStream();
    const effectiveError = headerTimedOut
      ? new StreamDeadlineError(options.headerTimeoutMs, options.source)
      : rawError;

    if (headerTimedOut) {
      logger.error(
        {
          seam_type: 'BOUNDARY_FAULT',
          event: 'bff.grpc.stream_header_timeout',
          headerTimeoutMs: options.headerTimeoutMs,
          source: options.source,
          correlationId,
        },
        'Upstream gRPC stream exceeded header-only timeout before first frame',
      );
      emitSseTerminationMetric(logger, 'header_timeout', options.source, correlationId);
    } else if (options.signal?.aborted) {
      emitSseTerminationMetric(logger, 'client_aborted', options.source, correlationId);
    } else {
      emitSseTerminationMetric(logger, 'upstream_error', options.source, correlationId);
    }

    const failure = classifyGrpcError(effectiveError, {
      correlationId,
      source: options.source,
      ...(options.normalizeUnavailableStatus !== undefined
        ? { normalizeUnavailableStatus: options.normalizeUnavailableStatus }
        : {}),
      logger,
    });

    if (options.onPreStreamFailure) {
      const override = await options.onPreStreamFailure(failure);
      if (override) {
        return override;
      }
    }
    return buildPreStreamErrorResponse(failure, options.extraResponseHeaders);
  };

  let iterator: AsyncIterator<TChunk>;
  let firstResult: IteratorResult<TChunk>;
  try {
    const iterable = options.startStream({
      signal: streamAbort.signal,
      onHeader: () => {
        // Response headers may precede trailers-only or zero-message gRPC errors (e.g. 429/403).
        // Await the first stream frame (or immediate terminal rejection) before flushing HTTP 200.
      },
    });
    iterator = iterable[Symbol.asyncIterator]();
    firstResult = await iterator.next();
    clearHeaderTimer();
  } catch (error) {
    return handlePreStreamError(error);
  }

  if (headerTimedOut || streamAbort.signal.aborted) {
    await iterator.return?.().catch(() => undefined);
    return handlePreStreamError(streamAbort.signal.reason);
  }

  const encoder = new TextEncoder();
  const keepaliveBytes = encoder.encode(': keepalive\n\n');
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let queuedFirst: IteratorResult<TChunk> | null = firstResult;

  const stopResources = (branch: 'completed' | 'client_aborted' | 'upstream_error'): void => {
    if (closed) return;
    closed = true;
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (options.signal) {
      options.signal.removeEventListener('abort', onCallerAbort);
    }
    emitSseTerminationMetric(logger, branch, options.source, correlationId);
  };

  const safeCloseController = (controller: ReadableStreamDefaultController<Uint8Array>): void => {
    try {
      controller.close();
    } catch {
      closed = true;
    }
  };

  const responseHeaders = new Headers({
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    'x-accel-buffering': 'no',
    'x-correlation-id': correlationId,
  });
  applyExtraHeaders(responseHeaders, options.extraResponseHeaders);

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (heartbeatIntervalMs > 0) {
        heartbeatTimer = setInterval(() => {
          if (closed) return;
          try {
            controller.enqueue(keepaliveBytes);
          } catch {
            if (!streamAbort.signal.aborted) {
              streamAbort.abort(new DOMException('SSE controller closed', 'AbortError'));
            }
            stopResources('client_aborted');
          }
        }, heartbeatIntervalMs);
        heartbeatTimer.unref?.();
      }
    },
    async pull(controller) {
      while (!closed) {
        try {
          let item: IteratorResult<TChunk>;
          if (queuedFirst !== null) {
            item = queuedFirst;
            queuedFirst = null;
          } else {
            item = await iterator.next();
          }
          if (closed) return;

          if (item.done) {
            stopResources(options.signal?.aborted ? 'client_aborted' : 'completed');
            safeCloseController(controller);
            return;
          }

          const mapped = options.mapChunkToSse(item.value);
          if (mapped) {
            controller.enqueue(encodeSseFrame(mapped.event, mapped.data));
            return;
          }
        } catch (error) {
          if (closed || streamAbort.signal.aborted || options.signal?.aborted) {
            stopResources('client_aborted');
            safeCloseController(controller);
            return;
          }
          if (!streamAbort.signal.aborted) {
            streamAbort.abort(error);
          }
          void iterator.return?.().catch(() => undefined);
          const failure = classifyGrpcError(error, {
            correlationId,
            source: options.source,
            ...(options.normalizeUnavailableStatus !== undefined
              ? { normalizeUnavailableStatus: options.normalizeUnavailableStatus }
              : {}),
            logger,
          });
          const frame = buildErrorFrame(failure);
          stopResources('upstream_error');
          try {
            controller.enqueue(encodeSseFrame(frame.event, frame.data));
            controller.close();
          } catch {
            closed = true;
          }
          return;
        }
      }
    },
    async cancel() {
      if (!streamAbort.signal.aborted) {
        streamAbort.abort(new DOMException('SSE reader cancelled', 'AbortError'));
      }
      stopResources('client_aborted');
      await iterator.return?.().catch(() => undefined);
    },
  });

  return new Response(body, {
    status: 200,
    headers: responseHeaders,
  });
}
