import { AnalyticsEventSchema } from './analytics-schemas.ts';
import type { AnalyticsClient } from './analytics.ts';
import { isPublicAppError, type PublicAppError } from './errors.ts';

export const DEFAULT_ERROR_DEDUP_WINDOW_MS = 5_000;
export const DEFAULT_MAX_ERROR_EVENTS_PER_MINUTE = 20;

const MAX_EVENT_NAME_LENGTH = 120;
const MAX_EVENT_PATH_LENGTH = 512;
const BURST_WINDOW_MS = 60_000;
const MAX_FINGERPRINT_ENTRIES = 256;

export type ClientErrorPhase =
  | 'router'
  | 'uncaught'
  | 'caught'
  | 'recoverable'
  | 'stream'
  | 'boundary';

export type ErrorDedupDecision =
  | 'emit'
  | 'dedup_weakset'
  | 'dedup_ttl'
  | 'rate_limited'
  | 'client_disabled';

export interface ErrorDedupCounters {
  readonly emit: number;
  readonly dedup_weakset: number;
  readonly dedup_ttl: number;
  readonly rate_limited: number;
  readonly client_disabled: number;
}

export interface ErrorDedupTelemetryContext {
  readonly event: 'client.telemetry.error_dedup_decision';
  readonly seam_type: 'RULE_DIVERGENCE';
  readonly phase: ClientErrorPhase;
  readonly errorCode: string;
}

export interface ClientErrorReporterOptions {
  readonly app: string;
  readonly client: AnalyticsClient | null | undefined;
  readonly dedupWindowMs?: number;
  readonly maxEventsPerMinute?: number;
  readonly now?: () => number;
  readonly getPathname?: () => string;
  readonly onDecision?: (decision: ErrorDedupDecision, context: ErrorDedupTelemetryContext) => void;
}

export interface ReportErrorContext {
  readonly phase: ClientErrorPhase;
  readonly pathname?: string;
  readonly correlationId?: string;
  readonly errorCode?: string;
  readonly status?: number;
}

export interface ReportPublicErrorContext {
  readonly phase?: ClientErrorPhase;
  readonly pathname?: string;
}

export interface ClientErrorReporter {
  reportError: (error: unknown, context: ReportErrorContext) => ErrorDedupDecision;
  reportPublicError: (
    error: PublicAppError,
    context?: ReportPublicErrorContext,
  ) => ErrorDedupDecision;
  getDecisionCounters: () => ErrorDedupCounters;
}

function sanitizeEventPath(rawPath: string | undefined, getPathname?: () => string): string {
  const source =
    rawPath ?? getPathname?.() ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
  const withoutQueryOrHash = source.split(/[?#]/, 1)[0] ?? '/';
  const trimmed = withoutQueryOrHash.trim();
  if (!trimmed) return '/';
  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return normalized.slice(0, MAX_EVENT_PATH_LENGTH);
}

function sanitizeMessageSnippet(error: unknown): string {
  let raw = '';
  if (isPublicAppError(error)) {
    raw = error.message;
  } else if (error instanceof Error) {
    raw = error.message || error.name;
  } else if (typeof error === 'string') {
    raw = error;
  } else if (typeof error === 'object' && error !== null) {
    const rec = error as Record<string, unknown>;
    if (typeof rec['message'] === 'string') raw = rec['message'];
    else if (typeof rec['statusText'] === 'string') raw = rec['statusText'];
  }

  return raw
    .replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, '$1[redacted]@')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[redacted-email]')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildEventName(errorCode: string, message: string): string {
  const combined = message ? `${errorCode}: ${message}` : errorCode;
  const trimmed = combined.trim() || 'client_error';
  return trimmed.slice(0, MAX_EVENT_NAME_LENGTH);
}

export function createClientErrorReporter(
  options: ClientErrorReporterOptions,
): ClientErrorReporter {
  const {
    app,
    client,
    dedupWindowMs = DEFAULT_ERROR_DEDUP_WINDOW_MS,
    maxEventsPerMinute = DEFAULT_MAX_ERROR_EVENTS_PER_MINUTE,
    now = () => Date.now(),
    getPathname,
    onDecision,
  } = options;

  const seenObjects = new WeakSet<object>();
  const recentFingerprints = new Map<string, number>();
  const emitTimestamps: number[] = [];
  const counters = {
    emit: 0,
    dedup_weakset: 0,
    dedup_ttl: 0,
    rate_limited: 0,
    client_disabled: 0,
  };

  const recordDecision = (
    decision: ErrorDedupDecision,
    phase: ClientErrorPhase,
    errorCode: string,
  ): ErrorDedupDecision => {
    counters[decision] += 1;
    onDecision?.(decision, {
      event: 'client.telemetry.error_dedup_decision',
      seam_type: 'RULE_DIVERGENCE',
      phase,
      errorCode,
    });
    return decision;
  };

  const pruneState = (timestamp: number): void => {
    while (emitTimestamps.length > 0 && timestamp - (emitTimestamps[0] ?? 0) >= BURST_WINDOW_MS) {
      emitTimestamps.shift();
    }
    for (const [key, seenAt] of recentFingerprints.entries()) {
      if (timestamp - seenAt >= dedupWindowMs) {
        recentFingerprints.delete(key);
      }
    }
    if (recentFingerprints.size > MAX_FINGERPRINT_ENTRIES) {
      const oldestKey = recentFingerprints.keys().next().value;
      if (oldestKey !== undefined) {
        recentFingerprints.delete(oldestKey);
      }
    }
  };

  const reportError = (error: unknown, context: ReportErrorContext): ErrorDedupDecision => {
    const publicErr = isPublicAppError(error) ? error : null;
    const errorCode = (context.errorCode ?? publicErr?.code ?? 'ERR_CLIENT').slice(0, 64);
    const correlationId = context.correlationId ?? publicErr?.correlationId;
    const status = context.status ?? publicErr?.status;

    if (!client || !client.enabled) {
      return recordDecision('client_disabled', context.phase, errorCode);
    }

    const errorObject = typeof error === 'object' && error !== null ? error : null;
    if (errorObject && seenObjects.has(errorObject)) {
      return recordDecision('dedup_weakset', context.phase, errorCode);
    }

    const timestamp = now();
    pruneState(timestamp);

    const path = sanitizeEventPath(context.pathname, getPathname);
    const snippet = sanitizeMessageSnippet(error);
    const fingerprint = `${context.phase}|${errorCode}|${snippet}|${path}`;
    const previousSeenAt = recentFingerprints.get(fingerprint);
    if (previousSeenAt !== undefined && timestamp - previousSeenAt < dedupWindowMs) {
      if (errorObject) seenObjects.add(errorObject);
      return recordDecision('dedup_ttl', context.phase, errorCode);
    }

    if (emitTimestamps.length >= maxEventsPerMinute) {
      if (errorObject) seenObjects.add(errorObject);
      return recordDecision('rate_limited', context.phase, errorCode);
    }

    const name = buildEventName(errorCode, snippet);
    const metadata: Record<string, string | number | boolean> = {
      app,
      phase: context.phase,
      errorCode,
      ...(correlationId ? { correlationId: correlationId.slice(0, 128) } : {}),
      ...(typeof status === 'number' && Number.isFinite(status) ? { status } : {}),
    };

    const candidateEvent = {
      type: 'error' as const,
      name,
      path,
      metadata,
    };

    const validated = AnalyticsEventSchema.safeParse({
      ...candidateEvent,
      timestamp: new Date(timestamp).toISOString(),
    });
    if (!validated.success) {
      return recordDecision('client_disabled', context.phase, errorCode);
    }

    if (errorObject) seenObjects.add(errorObject);
    recentFingerprints.set(fingerprint, timestamp);
    emitTimestamps.push(timestamp);

    try {
      client.track(candidateEvent);
      if (context.phase === 'uncaught' || context.phase === 'boundary') {
        client.flush();
      }
    } catch {
      // Never allow telemetry transport errors to destabilize application recovery
    }

    return recordDecision('emit', context.phase, errorCode);
  };

  const reportPublicError = (
    error: PublicAppError,
    context?: ReportPublicErrorContext,
  ): ErrorDedupDecision =>
    reportError(error, {
      phase: context?.phase ?? 'stream',
      pathname: context?.pathname,
      correlationId: error.correlationId,
      errorCode: error.code,
      status: error.status,
    });

  const getDecisionCounters = (): ErrorDedupCounters => ({ ...counters });

  return { reportError, reportPublicError, getDecisionCounters };
}
