import type { StreamResult } from '@aklapper/core';
import { classifyServerError, StreamDeadlineError } from '@aklapper/core/server-errors';
import type { RouterContextProvider } from 'react-router';

import {
  createFallbackLogger,
  getOrCreateCorrelationId,
  getRequestContext,
  logDiagnosticError,
} from './request-context.ts';

export const DEFAULT_STREAM_DEADLINE_MS = 4_000;
export const DEFAULT_STREAM_TIMEOUT_MS = 5_000;
const STREAM_DEADLINE_SAFETY_MARGIN_MS = 250;

export interface DeferStreamResultOptions {
  readonly request: Request;
  readonly context?: Readonly<RouterContextProvider>;
  readonly source: string;
  readonly deadlineMs?: number;
  readonly streamTimeoutMs?: number;
}

export function isReactRouterPrerender(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env['IS_RR_BUILD_REQUEST'] === 'yes';
}

export function isAuthenticPrerenderRequest(
  request: Request,
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return isReactRouterPrerender(env) && request.headers.get('x-react-router-prerender') === 'yes';
}

export function resolveStreamDeadlineMs(
  explicitDeadlineMs?: number,
  streamTimeoutMs = DEFAULT_STREAM_TIMEOUT_MS,
  env: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const maxDeadlineMs = Math.max(1, streamTimeoutMs - STREAM_DEADLINE_SAFETY_MARGIN_MS);
  let requestedMs: number | undefined;

  if (explicitDeadlineMs !== undefined) {
    if (Number.isFinite(explicitDeadlineMs) && explicitDeadlineMs > 0) {
      requestedMs = explicitDeadlineMs;
    }
  } else {
    const raw = env['SSR_STREAM_DEADLINE_MS'];
    if (typeof raw === 'string' && raw.trim() !== '') {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        requestedMs = parsed;
      }
    }
  }

  const effective = requestedMs ?? DEFAULT_STREAM_DEADLINE_MS;
  return Math.min(Math.max(1, effective), maxDeadlineMs);
}

function writeUnloggedFallbackRecord(
  correlationId: string,
  source: string,
  errorCode: string,
  httpStatus: number,
  loggerError: unknown,
): void {
  const record = {
    severity: 'CRITICAL',
    seam_type: 'DELTA_AUDIT_GAP',
    event: 'ssr.stream.deferred_failure_unlogged',
    correlationId,
    source,
    errorCode,
    httpStatus,
    loggerError: loggerError instanceof Error ? loggerError.message : String(loggerError),
  };
  try {
    process.stderr.write(`${JSON.stringify(record)}\n`);
  } catch {
    // Stderr unavailable
  }
}

export async function deferStreamResult<TData>(
  promise: Promise<TData>,
  options: DeferStreamResultOptions,
): Promise<StreamResult<TData>> {
  // Prevent unhandled rejections if the deadline or abort settles before the underlying promise
  void promise.catch(() => undefined);

  const reqCtx = getRequestContext(options.context);
  const correlationId = getOrCreateCorrelationId(options.request, options.context);
  const logger = reqCtx?.logger ?? createFallbackLogger(reqCtx?.serviceName ?? 'ssr');
  const signal = reqCtx?.signal ?? options.request.signal;

  const settleFailure = (err: unknown): StreamResult<TData> => {
    const { publicError, diagnostic } = classifyServerError(err, {
      correlationId,
      source: options.source,
    });
    try {
      logDiagnosticError(logger, diagnostic);
    } catch (logError) {
      writeUnloggedFallbackRecord(
        correlationId,
        options.source,
        diagnostic.code,
        diagnostic.status,
        logError,
      );
    }
    return { ok: false, error: publicError };
  };

  if (signal?.aborted) {
    const reason =
      signal.reason instanceof Error
        ? signal.reason
        : new DOMException('Request aborted', 'AbortError');
    return settleFailure(reason);
  }

  const bypassDeadline = isAuthenticPrerenderRequest(options.request);
  const deadlineMs = resolveStreamDeadlineMs(options.deadlineMs, options.streamTimeoutMs);

  let timerId: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;

  const racers: Array<Promise<TData>> = [promise];

  if (!bypassDeadline) {
    racers.push(
      new Promise<TData>((_resolve, reject) => {
        timerId = setTimeout(() => {
          reject(new StreamDeadlineError(deadlineMs, options.source));
        }, deadlineMs);
      }),
    );
  }

  if (signal) {
    racers.push(
      new Promise<TData>((_resolve, reject) => {
        onAbort = () => {
          const reason =
            signal.reason instanceof Error
              ? signal.reason
              : new DOMException('Request aborted', 'AbortError');
          reject(reason);
        };
        signal.addEventListener('abort', onAbort, { once: true });
      }),
    );
  }

  try {
    const data = await Promise.race(racers);
    return { ok: true, data };
  } catch (error) {
    return settleFailure(error);
  } finally {
    if (timerId !== undefined) {
      clearTimeout(timerId);
      timerId = undefined;
    }
    if (signal && onAbort) {
      signal.removeEventListener('abort', onAbort);
      onAbort = undefined;
    }
  }
}
