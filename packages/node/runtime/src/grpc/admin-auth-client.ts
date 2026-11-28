import { randomUUID } from 'node:crypto';

import { type AuthSessionStatus } from '@aklapper/core';
import { create } from '@bufbuild/protobuf';
import { createClient } from '@connectrpc/connect';

import { ADMIN_SESSION_COOKIE_NAME, parseCookieHeader } from '../auth.ts';
import { createFallbackLogger } from '../request-context.ts';
import { buildAdminGrpcCallMeta, type AdminGrpcCallContext } from './admin-common.ts';
import { classifyAdminGrpcError } from './errors.ts';
import {
  AdminAuthService,
  BeginPasskeyLoginRequestSchema,
  BeginPasskeyRegisterRequestSchema,
  ConfirmTotpEnrollmentRequestSchema,
  DisableTotpRequestSchema,
  EnrollTotpRequestSchema,
  FinishPasskeyLoginRequestSchema,
  FinishPasskeyRegisterRequestSchema,
  GetAdminSessionRequestSchema,
  LogoutAdminSessionRequestSchema,
  PasswordLoginRequestSchema,
  VerifyTotpStepUpRequestSchema,
  type AdminSession,
} from './gen/admin/v1/auth_pb.ts';
import { getOrCreateGoGrpcTransport, invokeUnaryWithAuth } from './transport.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function extractAdminSessionCookieId(
  cookieHeader: string | null | undefined,
): string | null {
  if (!cookieHeader) return null;
  const cookies = parseCookieHeader(cookieHeader);
  const raw = cookies[ADMIN_SESSION_COOKIE_NAME]?.trim();
  if (!raw || !UUID_RE.test(raw)) return null;
  return raw;
}

export function mapProtoAdminSession(
  proto: AdminSession | undefined,
): AuthSessionStatus['session'] {
  if (!proto || !proto.sessionId) return null;
  return {
    sessionId: proto.sessionId,
    role: proto.role === 'admin' ? 'admin' : 'guest',
    handle: proto.handle,
    expiresAt: proto.expiresAt,
  };
}

export function createAdminAuthGrpcClient(ctx: AdminGrpcCallContext = {}) {
  const meta = buildAdminGrpcCallMeta(ctx);
  const transport = getOrCreateGoGrpcTransport(meta.baseUrl);
  return { client: createClient(AdminAuthService, transport), meta };
}

export async function resolveAdminSessionViaGrpc(
  request: Request,
  ctx: AdminGrpcCallContext = {},
): Promise<AuthSessionStatus> {
  const emptyStatus: AuthSessionStatus = {
    authenticated: false,
    session: null,
    totpEnabled: false,
    passkeyCount: 0,
  };
  const sessionId = extractAdminSessionCookieId(request.headers.get('cookie'));
  if (!sessionId) {
    return emptyStatus;
  }

  const correlationId = ctx.correlationId?.trim() || randomUUID();
  const { client, meta } = createAdminAuthGrpcClient({
    ...ctx,
    correlationId,
    role: 'service',
    subject: 'admin-auth-session-gate',
  });

  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminAuthService/GetAdminSession',
      meta,
      opts => client.getAdminSession(create(GetAdminSessionRequestSchema, { sessionId }), opts),
    );
    if (!res.authenticated || !res.session || res.session.role !== 'admin') {
      return emptyStatus;
    }
    return {
      authenticated: true,
      session: mapProtoAdminSession(res.session),
      totpEnabled: res.totpEnabled,
      passkeyCount: res.passkeyCount,
    };
  } catch (error) {
    const failure = classifyAdminGrpcError(error, {
      correlationId,
      source: 'admin.auth.session',
      normalizeUnavailableStatus: 503,
      ...(ctx.logger ? { logger: ctx.logger } : {}),
    });
    const logger = ctx.logger ?? createFallbackLogger('admin-auth');
    logger.error(
      {
        seam_type: 'BOUNDARY_FAULT',
        event: 'admin.auth.session_gate_fault',
        code: failure.publicError.code,
        status: failure.publicError.status,
        correlationId,
      },
      'Admin session gate failed during upstream gRPC verification',
    );
    throw error;
  }
}

export {
  BeginPasskeyLoginRequestSchema,
  BeginPasskeyRegisterRequestSchema,
  ConfirmTotpEnrollmentRequestSchema,
  DisableTotpRequestSchema,
  EnrollTotpRequestSchema,
  FinishPasskeyLoginRequestSchema,
  FinishPasskeyRegisterRequestSchema,
  GetAdminSessionRequestSchema,
  LogoutAdminSessionRequestSchema,
  PasswordLoginRequestSchema,
  VerifyTotpStepUpRequestSchema,
};
