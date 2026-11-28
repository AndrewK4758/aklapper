import { randomUUID } from 'node:crypto';

import { PrivacySanitizationError } from '../cli/go-privacy-check.ts';
import {
  extractRightmostForwardedIp,
  isProductionEnv,
  resolveAdminInternalAuthSecret,
  type InternalAuthRole,
  type OidcAuthMode,
} from '../http.ts';
import type { SsrStructuredLogger } from '../request-context.ts';
import { signInternalClientIpHeader } from './client-ip.ts';
import { classifyAdminGrpcError, GrpcPayloadContractError } from './errors.ts';
import type { GrpcCallMetadata } from './transport.ts';

export const ADMIN_SESSION_HEADER = 'x-admin-session-id';
export const ADMIN_CHROME_SUBJECT = 'admin-ssr-chrome';

export interface AdminGrpcCallContext {
  readonly baseUrl?: string;
  readonly sessionId?: string;
  readonly role?: InternalAuthRole;
  readonly subject?: string;
  readonly clientIp?: string | null;
  readonly correlationId?: string;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly oidcAuth?: OidcAuthMode;
  readonly env?: Record<string, string | undefined>;
  readonly fetchImpl?: typeof fetch;
  readonly logger?: SsrStructuredLogger;
}

export function resolveAdminApiBaseUrl(
  explicitUrl?: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const direct = explicitUrl?.trim();
  if (direct) return direct.replace(/\/+$/, '');
  const fromEnv = env['ADMIN_API_URL']?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  if (!isProductionEnv(env) && !isProductionEnv(process.env)) {
    return 'http://127.0.0.1:8085';
  }
  throw new Error('ADMIN_API_URL is required in production');
}

export function buildAdminGrpcCallMeta(ctx: AdminGrpcCallContext = {}): GrpcCallMetadata {
  const env = ctx.env ?? process.env;
  const baseUrl = resolveAdminApiBaseUrl(ctx.baseUrl, env);
  const adminSecret = resolveAdminInternalAuthSecret(undefined, env);
  const correlationId = ctx.correlationId?.trim() || randomUUID();
  const role: InternalAuthRole = ctx.role ?? (ctx.sessionId ? 'admin' : 'service');
  const subject =
    ctx.subject?.trim() ||
    (ctx.sessionId ? `admin-session:${ctx.sessionId.trim()}` : 'admin-ssr-bff');

  let signedClientIp: string | undefined;
  const ip = ctx.clientIp?.trim();
  if (ip && ip !== 'unknown') {
    try {
      signedClientIp = signInternalClientIpHeader(ip, adminSecret);
    } catch {
      signedClientIp = undefined;
    }
  }

  const extraHeaders: Record<string, string> = {};
  if (ctx.sessionId?.trim()) {
    extraHeaders[ADMIN_SESSION_HEADER] = ctx.sessionId.trim();
  }

  return {
    baseUrl,
    internalAuth: {
      role,
      subject,
      secret: adminSecret,
    },
    ...(signedClientIp ? { signedClientIp } : {}),
    ...(Object.keys(extraHeaders).length > 0 ? { extraHeaders } : {}),
    correlationId,
    ...(ctx.signal ? { signal: ctx.signal } : {}),
    ...(ctx.timeoutMs !== undefined ? { timeoutMs: ctx.timeoutMs } : {}),
    ...(ctx.oidcAuth !== undefined ? { oidcAuth: ctx.oidcAuth } : {}),
    env,
    ...(ctx.fetchImpl ? { fetchImpl: ctx.fetchImpl } : {}),
    ...(ctx.logger ? { logger: ctx.logger } : {}),
  };
}

export function resolveRequestClientIp(request: Request): string | null {
  const ip = extractRightmostForwardedIp(
    request.headers.get('x-forwarded-for'),
    request.headers.get('x-real-ip'),
    'unknown',
  );
  return ip === 'unknown' ? null : ip;
}

export function rethrowAdminGrpcError(
  error: unknown,
  source: string,
  ctx: AdminGrpcCallContext,
): never {
  const failure = classifyAdminGrpcError(error, {
    correlationId: ctx.correlationId?.trim() || randomUUID(),
    source,
    ...(ctx.logger ? { logger: ctx.logger } : {}),
  });
  if (failure.sanitizationFindings && failure.sanitizationFindings.length > 0) {
    throw new PrivacySanitizationError(failure.sanitizationFindings);
  }
  throw error;
}

export function parseAdminJsonObject<T>(
  rawJson: string,
  schemaName: string,
  parse: (value: unknown) => T,
): T {
  let decoded: unknown;
  try {
    decoded = JSON.parse(rawJson);
  } catch (error) {
    throw new GrpcPayloadContractError(
      schemaName,
      error instanceof Error ? error.message : 'Invalid JSON payload from admin-api',
    );
  }
  try {
    return parse(decoded);
  } catch (error) {
    throw new GrpcPayloadContractError(
      schemaName,
      error instanceof Error ? error.message : `Schema validation failed for ${schemaName}`,
    );
  }
}
