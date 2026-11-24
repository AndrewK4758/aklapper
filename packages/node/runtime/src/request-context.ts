import { randomUUID } from 'node:crypto';

import type { DiagnosticAppError } from '@aklapper/core/server-errors';
import { createContext, type RouterContext, type RouterContextProvider } from 'react-router';

export interface SsrStructuredLogger {
  info: (obj: Record<string, unknown>, msg?: string) => void;
  warn: (obj: Record<string, unknown>, msg?: string) => void;
  error: (obj: Record<string, unknown>, msg?: string) => void;
}

export interface SsrRequestContext {
  readonly correlationId: string;
  readonly logger: SsrStructuredLogger;
  readonly serviceName: string;
  readonly signal: AbortSignal;
}

export interface CorrelationIdExtractionResult {
  readonly correlationId: string;
  readonly headerRejected: boolean;
}

const REQUEST_CONTEXT_KEY_SYMBOL = Symbol.for('aklapper.ssr.requestContextKey');
const REQUEST_CORRELATION_MAP_SYMBOL = Symbol.for('aklapper.ssr.requestCorrelationMap');

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const CLOUD_TRACE_ID_PATTERN = /^[0-9a-fA-F]{32}$/;

function getGlobalStore(): Record<symbol, unknown> {
  return globalThis as unknown as Record<symbol, unknown>;
}

function getOrCreateGlobalContextKey(): RouterContext<SsrRequestContext | null> {
  const store = getGlobalStore();
  const existing = store[REQUEST_CONTEXT_KEY_SYMBOL] as
    | RouterContext<SsrRequestContext | null>
    | undefined;
  if (existing) return existing;
  const created = createContext<SsrRequestContext | null>(null);
  store[REQUEST_CONTEXT_KEY_SYMBOL] = created;
  return created;
}

function getOrCreateGlobalCorrelationMap(): WeakMap<Request, string> {
  const store = getGlobalStore();
  const existing = store[REQUEST_CORRELATION_MAP_SYMBOL] as WeakMap<Request, string> | undefined;
  if (existing) return existing;
  const created = new WeakMap<Request, string>();
  store[REQUEST_CORRELATION_MAP_SYMBOL] = created;
  return created;
}

export const requestContextKey: RouterContext<SsrRequestContext | null> =
  getOrCreateGlobalContextKey();

const requestCorrelationMap: WeakMap<Request, string> = getOrCreateGlobalCorrelationMap();

export function getRequestContext(
  context?: Readonly<RouterContextProvider>,
): SsrRequestContext | null {
  if (!context || typeof context.get !== 'function') return null;
  try {
    return context.get(requestContextKey) ?? null;
  } catch {
    return null;
  }
}

function readHeaderValue(
  headers: Headers | Readonly<Record<string, string | string[] | undefined>>,
  targetName: string,
): string | null {
  if (headers instanceof Headers) {
    return headers.get(targetName);
  }
  const lowerTarget = targetName.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== lowerTarget) continue;
    if (Array.isArray(value)) {
      const first = value.find(item => typeof item === 'string');
      return first ?? null;
    }
    if (typeof value === 'string') return value;
  }
  return null;
}

export function extractCorrelationId(
  headers: Headers | Readonly<Record<string, string | string[] | undefined>>,
): CorrelationIdExtractionResult {
  const direct = readHeaderValue(headers, 'x-correlation-id');
  if (direct !== null) {
    if (CORRELATION_ID_PATTERN.test(direct)) {
      return { correlationId: direct, headerRejected: false };
    }
    return { correlationId: randomUUID(), headerRejected: true };
  }

  const requestId = readHeaderValue(headers, 'x-request-id');
  if (requestId !== null) {
    if (CORRELATION_ID_PATTERN.test(requestId)) {
      return { correlationId: requestId, headerRejected: false };
    }
    return { correlationId: randomUUID(), headerRejected: true };
  }

  const cloudTrace = readHeaderValue(headers, 'x-cloud-trace-context');
  if (cloudTrace !== null) {
    const traceId = cloudTrace.split('/', 1)[0] ?? '';
    if (CLOUD_TRACE_ID_PATTERN.test(traceId)) {
      return { correlationId: traceId, headerRejected: false };
    }
    return { correlationId: randomUUID(), headerRejected: true };
  }

  return { correlationId: randomUUID(), headerRejected: false };
}

export function getOrCreateCorrelationId(
  request: Request,
  context?: Readonly<RouterContextProvider>,
): string {
  const reqCtx = getRequestContext(context);
  if (reqCtx?.correlationId) {
    requestCorrelationMap.set(request, reqCtx.correlationId);
    return reqCtx.correlationId;
  }

  const cached = requestCorrelationMap.get(request);
  if (cached) return cached;

  const { correlationId } = extractCorrelationId(request.headers);
  requestCorrelationMap.set(request, correlationId);
  return correlationId;
}

export function createFallbackLogger(serviceName = 'ssr'): SsrStructuredLogger {
  const emit = (
    level: 'INFO' | 'WARN' | 'ERROR',
    stream: NodeJS.WriteStream,
    obj: Record<string, unknown>,
    msg?: string,
  ): void => {
    const line = JSON.stringify({
      severity: level,
      service: serviceName,
      timestamp: new Date().toISOString(),
      ...obj,
      ...(msg ? { msg } : {}),
    });
    stream.write(`${line}\n`);
  };

  return {
    info: (obj, msg) => emit('INFO', process.stdout, obj, msg),
    warn: (obj, msg) => emit('WARN', process.stderr, obj, msg),
    error: (obj, msg) => emit('ERROR', process.stderr, obj, msg),
  };
}

export function logDiagnosticError(
  logger: SsrStructuredLogger,
  diagnostic: DiagnosticAppError,
): void {
  const payload: Record<string, unknown> = {
    severity: diagnostic.severity,
    errorCode: diagnostic.code,
    httpStatus: diagnostic.status,
    correlationId: diagnostic.correlationId,
    source: diagnostic.source,
    reasoning: diagnostic.reasoning,
    ...(diagnostic.pgCode ? { pgCode: diagnostic.pgCode } : {}),
    ...(diagnostic.causeName ? { causeName: diagnostic.causeName } : {}),
    ...(diagnostic.causeMessage ? { causeMessage: diagnostic.causeMessage } : {}),
    ...(diagnostic.causeStack ? { causeStack: diagnostic.causeStack } : {}),
  };

  if (diagnostic.severity === 'WARN') {
    logger.warn(payload, diagnostic.reasoning);
  } else {
    logger.error(payload, diagnostic.reasoning);
  }
}
