import {
  createPublicAppError,
  isPublicAppError,
  PublicAppErrorSchema,
  type AppErrorCode,
  type PublicAppError,
} from './errors.ts';
import type { FormFieldErrorMap } from './forms.ts';

export type DiagnosticSeverity = 'WARN' | 'ERROR' | 'CRITICAL';

export interface DiagnosticAppError {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly severity: DiagnosticSeverity;
  readonly reasoning: string;
  readonly correlationId: string;
  readonly source: string;
  readonly pgCode?: string;
  readonly causeName?: string;
  readonly causeMessage?: string;
  readonly causeStack?: string;
}

export interface ClassificationTelemetry {
  readonly event: 'ssr.error.classification_branch';
  readonly seam_type: 'RULE_DIVERGENCE';
  readonly code: AppErrorCode;
  readonly status: number;
  readonly source: string;
  readonly correlationId: string;
}

export interface BoundaryFaultEvent {
  readonly event: 'ssr.error.public_redaction_violation';
  readonly seam_type: 'BOUNDARY_FAULT';
  readonly severity: 'CRITICAL';
  readonly correlationId: string;
  readonly source: string;
  readonly reason: string;
}

export interface ClassifiedServerError {
  readonly publicError: PublicAppError;
  readonly diagnostic: DiagnosticAppError;
  readonly telemetry: ClassificationTelemetry;
}

export interface ClassifyServerErrorContext {
  readonly correlationId: string;
  readonly source: string;
  readonly onBoundaryFault?: (fault: BoundaryFaultEvent) => void;
}

export class StreamDeadlineError extends Error {
  readonly deadlineMs: number;
  readonly source: string;

  constructor(deadlineMs: number, source: string) {
    super(`Stream deadline exceeded after ${deadlineMs}ms for ${source}`);
    this.name = 'StreamDeadlineError';
    this.deadlineMs = deadlineMs;
    this.source = source;
  }
}

type CatalogTuple = readonly [status: number, message: string, action: string];

const CATALOG: Readonly<Record<AppErrorCode, CatalogTuple>> = {
  ERR_VALIDATION: [400, 'Submitted fields need attention.', 'Review highlighted fields and retry.'],
  ERR_CONSTRAINT: [422, 'Data failed storage validation.', 'Check highlighted fields and retry.'],
  ERR_NOT_FOUND: [404, 'Resource could not be found.', 'Verify the URL or return home.'],
  ERR_UNAUTHORIZED: [401, 'Authentication is required.', 'Sign in with admin credentials.'],
  ERR_FORBIDDEN: [403, 'Permission denied for action.', 'Return home or sign in again.'],
  ERR_RATE_LIMITED: [429, 'Too many requests received.', 'Wait a moment and submit again.'],
  ERR_DB_UNAVAILABLE: [503, 'Database temporarily unavailable.', 'Retry shortly or share ID.'],
  ERR_STREAM_TIMEOUT: [504, 'Section took too long to load.', 'Retry loading or refresh.'],
  ERR_STREAM_ABORTED: [499, 'Request cancelled early.', 'Retry if you still need this view.'],
  ERR_UPSTREAM_UNAVAILABLE: [503, 'Upstream service unreachable.', 'Retry shortly or go home.'],
  ERR_INTERNAL: [500, 'Unexpected server error.', 'Retry or share the reference ID.'],
};

const MAX_CAUSE_DEPTH = 5;
const MAX_DIAG_MSG = 512;
const MAX_DIAG_STACK = 2048;

const NETWORK_ERRNO_RE =
  /^(?:ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EPIPE|EHOSTUNREACH)$/;
const PG_CONSTRAINT_RE = /^(?:23502|23514|23505)$/;
const PG_UNAVAILABLE_RE = /^(?:08|57P|53300$)/;
const DB_MSG_RE =
  /connection terminated|timeout exceeded when trying to connect|too many clients already|DATABASE_URL is required/i;
const UNSAFE_PUBLIC_RE =
  /\b(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b[\s\S]{0,300}\b(?:FROM|INTO|SET|TABLE|WHERE|VALUES)\b|Failed query:|params:\s*\[|\b(?:postgres(?:ql)?|mysql|redis|mongodb(?:\+srv)?|amqp|https?):\/\/[^\s:@]+:[^\s@]+@|postgres(?:ql)?:\/\/|^\s*at\s+\S+|\.(?:ts|tsx|js|mjs|cjs):\d+:\d+/im;

const HTTP_STATUS_MAP: Readonly<Record<number, AppErrorCode>> = {
  400: 'ERR_VALIDATION',
  401: 'ERR_UNAUTHORIZED',
  403: 'ERR_FORBIDDEN',
  404: 'ERR_NOT_FOUND',
  422: 'ERR_CONSTRAINT',
  429: 'ERR_RATE_LIMITED',
  502: 'ERR_UPSTREAM_UNAVAILABLE',
  503: 'ERR_UPSTREAM_UNAVAILABLE',
  504: 'ERR_UPSTREAM_UNAVAILABLE',
};

const normalizeId = (raw: string): string => raw.trim().slice(0, 128) || 'unknown';
const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isDrizzle = (v: unknown): boolean =>
  isRec(v) &&
  (v['name'] === 'DrizzleQueryError' ||
    (typeof v['message'] === 'string' && v['message'].includes('Failed query:')));

function collectErrorChain(root: unknown): readonly unknown[] {
  const seen = new WeakSet<object>();
  const queue: Array<{ readonly node: unknown; readonly depth: number }> = [
    { node: root, depth: 0 },
  ];
  const out: unknown[] = [];
  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) continue;
    const { node, depth } = item;
    if (isRec(node)) {
      if (seen.has(node)) continue;
      seen.add(node);
    }
    out.push(node);
    if (depth >= MAX_CAUSE_DEPTH || !isRec(node)) continue;
    if (node['cause'] !== undefined) queue.push({ node: node['cause'], depth: depth + 1 });
    if (Array.isArray(node['errors'])) {
      for (const inner of node['errors']) queue.push({ node: inner, depth: depth + 1 });
    }
  }
  return out;
}

function pickUnderlyingCause(chain: readonly unknown[]): unknown {
  let fallback: unknown = chain[0];
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    const c = chain[i];
    if (c === undefined || c === null) continue;
    if (!isDrizzle(c) && !(isRec(c) && Array.isArray(c['errors']))) return c;
    fallback = c;
  }
  return fallback;
}

function scrubSensitiveText(raw: string): string {
  return raw
    .replace(/Failed query:[\s\S]*/i, '[redacted query]')
    .replace(/params:\s*\[[\s\S]*/i, '[redacted params]')
    .replace(/\bpostgres(?:ql)?:\/\/\S+/gi, 'postgresql://[redacted]')
    .replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, '$1[redacted]@')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[redacted-email]')
    .replace(/[A-Za-z0-9+/]{64,}={0,2}/g, '[redacted-blob]');
}

function sanitizeDiagnosticMessage(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const cleaned = scrubSensitiveText(raw).replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, MAX_DIAG_MSG) : undefined;
}

function sanitizeDiagnosticStack(rawStack: string | undefined): string | undefined {
  if (!rawStack) return undefined;
  const frames = rawStack
    .split(/\r?\n/)
    .filter(line => /^\s+at\s+/.test(line))
    .map(scrubSensitiveText);
  if (frames.length === 0) return undefined;
  const kept: string[] = [];
  let len = 0;
  for (const frame of frames) {
    const sep = kept.length > 0 ? 1 : 0;
    if (len + sep + frame.length > MAX_DIAG_STACK) {
      if (kept.length === 0) kept.push(frame.slice(0, MAX_DIAG_STACK));
      break;
    }
    kept.push(frame);
    len += sep + frame.length;
  }
  return kept.join('\n');
}

function buildCatalogError(
  code: AppErrorCode,
  correlationId: string,
  fieldErrors?: FormFieldErrorMap,
): PublicAppError {
  const [status, message, action] = CATALOG[code];
  return createPublicAppError({
    code,
    status,
    message,
    action,
    correlationId,
    ...(fieldErrors ? { fieldErrors } : {}),
  });
}

export function enforcePublicErrorBoundary(
  candidate: unknown,
  context: {
    readonly correlationId: string;
    readonly source: string;
    readonly onViolation?: (fault: BoundaryFaultEvent) => void;
  },
): { readonly publicError: PublicAppError; readonly violation: BoundaryFaultEvent | null } {
  const correlationId = normalizeId(context.correlationId);
  const parsed = PublicAppErrorSchema.safeParse(candidate);
  const reason = !parsed.success
    ? 'Candidate failed PublicAppErrorSchema validation'
    : UNSAFE_PUBLIC_RE.test(parsed.data.message) ||
        UNSAFE_PUBLIC_RE.test(parsed.data.action) ||
        Object.values(parsed.data.fieldErrors ?? {}).some(list =>
          list.some(msg => UNSAFE_PUBLIC_RE.test(msg)),
        )
      ? 'Candidate matched disallowed internal pattern'
      : null;

  if (reason !== null) {
    const fault: BoundaryFaultEvent = {
      event: 'ssr.error.public_redaction_violation',
      seam_type: 'BOUNDARY_FAULT',
      severity: 'CRITICAL',
      correlationId,
      source: context.source,
      reason,
    };
    if (context.onViolation) context.onViolation(fault);
    else if (typeof console !== 'undefined') console.error(JSON.stringify(fault));
    return { publicError: buildCatalogError('ERR_INTERNAL', correlationId), violation: fault };
  }
  return { publicError: parsed.data as PublicAppError, violation: null };
}

interface Match {
  readonly code: AppErrorCode;
  readonly severity: DiagnosticSeverity;
  readonly reasoning: string;
  readonly pgCode?: string;
  readonly fieldErrors?: FormFieldErrorMap;
}

const mkMatch = (
  code: AppErrorCode,
  severity: DiagnosticSeverity,
  reasoning: string,
  extra?: { readonly pgCode?: string; readonly fieldErrors?: FormFieldErrorMap },
): Match => ({ code, severity, reasoning, ...extra });

function extractFieldErrors(value: unknown): FormFieldErrorMap | undefined {
  if (!isRec(value)) return undefined;
  const out: FormFieldErrorMap = {};
  for (const [k, v] of Object.entries(value)) {
    if (Array.isArray(v) && v.every(item => typeof item === 'string')) out[k] = [...v];
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function matchErrorChain(chain: readonly unknown[]): Match {
  for (const node of chain) {
    if (isPublicAppError(node)) {
      return mkMatch(
        node.code,
        node.status >= 500 ? 'ERROR' : 'WARN',
        `Preserved ${node.code}`,
        node.fieldErrors ? { fieldErrors: node.fieldErrors } : undefined,
      );
    }
    if (!isRec(node)) continue;
    if (node instanceof StreamDeadlineError || node['name'] === 'StreamDeadlineError') {
      return mkMatch('ERR_STREAM_TIMEOUT', 'ERROR', 'Server stream deadline expired');
    }
    if (node['name'] === 'AbortError' || node['code'] === 'ABORT_ERR') {
      return mkMatch('ERR_STREAM_ABORTED', 'WARN', 'Request cancelled before completion');
    }
    if (node['name'] === 'ContactDbConstraintError') {
      const fieldErrors = extractFieldErrors(node['fieldErrors']);
      return mkMatch(
        'ERR_CONSTRAINT',
        'WARN',
        'Database constraint violation',
        fieldErrors ? { fieldErrors } : undefined,
      );
    }
  }
  for (const node of chain) {
    if (!isRec(node) || typeof node['code'] !== 'string') continue;
    const code = node['code'];
    if (PG_CONSTRAINT_RE.test(code)) {
      return mkMatch('ERR_CONSTRAINT', 'WARN', `PostgreSQL constraint (${code})`, { pgCode: code });
    }
    if (PG_UNAVAILABLE_RE.test(code)) {
      return mkMatch('ERR_DB_UNAVAILABLE', 'ERROR', `PostgreSQL unavailable (${code})`, {
        pgCode: code,
      });
    }
    if (NETWORK_ERRNO_RE.test(code)) {
      return mkMatch('ERR_DB_UNAVAILABLE', 'ERROR', `Database network error (${code})`);
    }
  }
  for (const node of chain) {
    if (!isRec(node)) continue;
    if (node['name'] === 'ZodError' && Array.isArray(node['issues'])) {
      return mkMatch('ERR_VALIDATION', 'WARN', 'Zod schema validation failed');
    }
    if (
      typeof node['status'] === 'number' &&
      typeof node['statusText'] === 'string' &&
      'data' in node
    ) {
      if (isPublicAppError(node['data'])) {
        const inner = node['data'];
        return mkMatch(
          inner.code,
          inner.status >= 500 ? 'ERROR' : 'WARN',
          `Route ${inner.code}`,
          inner.fieldErrors ? { fieldErrors: inner.fieldErrors } : undefined,
        );
      }
      return mkMatch(
        HTTP_STATUS_MAP[node['status']] ?? 'ERR_INTERNAL',
        node['status'] >= 500 ? 'ERROR' : 'WARN',
        `Route ErrorResponse (${node['status']})`,
      );
    }
    if (typeof node['message'] === 'string' && DB_MSG_RE.test(node['message'])) {
      return mkMatch('ERR_DB_UNAVAILABLE', 'ERROR', 'PostgreSQL connection failure');
    }
  }
  return mkMatch('ERR_INTERNAL', 'ERROR', 'Unclassified runtime exception');
}

function extractCauseFields(underlying: unknown) {
  const src =
    underlying instanceof Error
      ? { name: underlying.name || 'Error', message: underlying.message, stack: underlying.stack }
      : isRec(underlying)
        ? underlying
        : null;
  const causeName = typeof src?.['name'] === 'string' ? src['name'] : undefined;
  const rawMsg =
    typeof src?.['message'] === 'string'
      ? src['message']
      : underlying !== undefined && underlying !== null
        ? String(underlying)
        : undefined;
  const rawStack = typeof src?.['stack'] === 'string' ? src['stack'] : undefined;
  const causeMessage = sanitizeDiagnosticMessage(rawMsg);
  const causeStack =
    underlying && !isDrizzle(underlying) ? sanitizeDiagnosticStack(rawStack) : undefined;
  return {
    ...(causeName ? { causeName } : {}),
    ...(causeMessage ? { causeMessage } : {}),
    ...(causeStack ? { causeStack } : {}),
  };
}

export function classifyServerError(
  error: unknown,
  context: ClassifyServerErrorContext,
): ClassifiedServerError {
  const correlationId = normalizeId(context.correlationId);
  const chain = collectErrorChain(error);
  const matched = matchErrorChain(chain);
  const { publicError } = enforcePublicErrorBoundary(
    buildCatalogError(matched.code, correlationId, matched.fieldErrors),
    { correlationId, source: context.source, onViolation: context.onBoundaryFault },
  );
  return {
    publicError,
    diagnostic: {
      code: publicError.code,
      status: publicError.status,
      severity: matched.severity,
      reasoning: matched.reasoning,
      correlationId,
      source: context.source,
      ...(matched.pgCode ? { pgCode: matched.pgCode } : {}),
      ...extractCauseFields(pickUnderlyingCause(chain)),
    },
    telemetry: {
      event: 'ssr.error.classification_branch',
      seam_type: 'RULE_DIVERGENCE',
      code: publicError.code,
      status: publicError.status,
      source: context.source,
      correlationId,
    },
  };
}
