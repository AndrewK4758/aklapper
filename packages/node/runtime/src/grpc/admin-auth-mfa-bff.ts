import { create } from '@bufbuild/protobuf';

import { ADMIN_SESSION_COOKIE_NAME, serializeSessionCookie } from '../auth.ts';
import {
  BeginPasskeyLoginRequestSchema,
  BeginPasskeyRegisterRequestSchema,
  ConfirmTotpEnrollmentRequestSchema,
  createAdminAuthGrpcClient,
  DisableTotpRequestSchema,
  EnrollTotpRequestSchema,
  FinishPasskeyLoginRequestSchema,
  FinishPasskeyRegisterRequestSchema,
  mapProtoAdminSession,
  VerifyTotpStepUpRequestSchema,
} from './admin-auth-client.ts';
import type { AdminGrpcCallContext } from './admin-common.ts';
import { invokeUnaryWithAuth } from './transport.ts';

const ADMIN_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export interface AuthBffDispatchContext {
  readonly method: string;
  readonly splat: string;
  readonly body: Record<string, unknown>;
  readonly sessionId: string | null;
  readonly clientIp: string | null;
  readonly originHeader: string;
  readonly secureCookie: boolean;
  readonly callCtx: AdminGrpcCallContext;
}

export function buildAuthJsonResponse(
  status: number,
  body: Record<string, unknown>,
  options?: { readonly headers?: Record<string, string>; readonly cookies?: readonly string[] },
): Response {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' });
  if (options?.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      headers.set(k, v);
    }
  }
  if (options?.cookies) {
    for (const c of options.cookies) {
      headers.append('set-cookie', c);
    }
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export function buildAdminSessionCookieHeader(sessionId: string, secure: boolean): string {
  return serializeSessionCookie(ADMIN_SESSION_COOKIE_NAME, sessionId, {
    maxAgeSeconds: ADMIN_SESSION_MAX_AGE_SECONDS,
    secure,
  });
}

export async function dispatchAdminMfaAuthBff(
  ctx: AuthBffDispatchContext,
): Promise<Response | null> {
  const { method, splat, body, sessionId, clientIp, originHeader, secureCookie, callCtx } = ctx;
  if (method !== 'POST') return null;

  if (splat === 'passkey/register/options') {
    if (!sessionId) {
      return buildAuthJsonResponse(401, {
        error: 'UNAUTHORIZED',
        message: 'Valid admin session required',
      });
    }
    const { client, meta } = createAdminAuthGrpcClient({ ...callCtx, role: 'admin', sessionId });
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminAuthService/BeginPasskeyRegister',
      meta,
      opts =>
        client.beginPasskeyRegister(
          create(BeginPasskeyRegisterRequestSchema, { sessionId, origin: originHeader }),
          opts,
        ),
    );
    return buildAuthJsonResponse(200, {
      challengeId: res.challengeId,
      options: JSON.parse(res.optionsJson) as unknown,
    });
  }

  if (splat === 'passkey/register/verify') {
    const challengeId = typeof body['challengeId'] === 'string' ? body['challengeId'].trim() : '';
    const responseObj = body['response'];
    if (!challengeId || typeof responseObj !== 'object' || responseObj === null) {
      return buildAuthJsonResponse(400, {
        error: 'INVALID_REQUEST',
        message: 'challengeId and response are required',
      });
    }
    if (!sessionId) {
      return buildAuthJsonResponse(401, {
        error: 'UNAUTHORIZED',
        message: 'Valid admin session required',
      });
    }
    const { client, meta } = createAdminAuthGrpcClient({ ...callCtx, role: 'admin', sessionId });
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminAuthService/FinishPasskeyRegister',
      meta,
      opts =>
        client.finishPasskeyRegister(
          create(FinishPasskeyRegisterRequestSchema, {
            sessionId,
            challengeId,
            credentialJson: JSON.stringify(responseObj),
            origin: originHeader,
          }),
          opts,
        ),
    );
    return buildAuthJsonResponse(201, {
      verified: res.verified,
      credentialId: res.credentialId,
      session: mapProtoAdminSession(res.session),
    });
  }

  if (splat === 'passkey/login/options') {
    const handle =
      typeof body['handle'] === 'string' && body['handle'].trim().length > 0
        ? body['handle'].trim()
        : undefined;
    const { client, meta } = createAdminAuthGrpcClient({
      ...callCtx,
      role: 'service',
      subject: 'admin-auth-bff',
    });
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminAuthService/BeginPasskeyLogin',
      meta,
      opts =>
        client.beginPasskeyLogin(
          create(BeginPasskeyLoginRequestSchema, {
            ...(handle ? { handle } : {}),
            origin: originHeader,
          }),
          opts,
        ),
    );
    return buildAuthJsonResponse(200, {
      challengeId: res.challengeId,
      options: JSON.parse(res.optionsJson) as unknown,
    });
  }

  if (splat === 'passkey/login/verify') {
    const challengeId = typeof body['challengeId'] === 'string' ? body['challengeId'].trim() : '';
    const responseObj = body['response'];
    const totpCode =
      typeof body['totpCode'] === 'string' && body['totpCode'].trim().length > 0
        ? body['totpCode'].trim()
        : undefined;
    if (!challengeId || typeof responseObj !== 'object' || responseObj === null) {
      return buildAuthJsonResponse(400, {
        error: 'INVALID_REQUEST',
        message: 'challengeId and response are required',
      });
    }
    const { client, meta } = createAdminAuthGrpcClient({
      ...callCtx,
      role: 'service',
      subject: 'admin-auth-bff',
    });
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminAuthService/FinishPasskeyLogin',
      meta,
      opts =>
        client.finishPasskeyLogin(
          create(FinishPasskeyLoginRequestSchema, {
            challengeId,
            assertionJson: JSON.stringify(responseObj),
            ...(totpCode ? { totpCode } : {}),
            origin: originHeader,
            ...(clientIp ? { clientIp } : {}),
          }),
          opts,
        ),
    );
    if (res.requiresTotp) {
      return buildAuthJsonResponse(200, {
        verified: false,
        requiresTotp: true,
        pendingToken: res.pendingToken,
      });
    }
    const session = mapProtoAdminSession(res.session);
    return buildAuthJsonResponse(
      200,
      { verified: true, requiresTotp: false, session },
      session
        ? { cookies: [buildAdminSessionCookieHeader(session.sessionId, secureCookie)] }
        : undefined,
    );
  }

  if (splat === 'totp/enroll') {
    if (!sessionId) {
      return buildAuthJsonResponse(401, {
        error: 'UNAUTHORIZED',
        message: 'Admin session required',
      });
    }
    const { client, meta } = createAdminAuthGrpcClient({ ...callCtx, role: 'admin', sessionId });
    const res = await invokeUnaryWithAuth('/admin.v1.AdminAuthService/EnrollTotp', meta, opts =>
      client.enrollTotp(create(EnrollTotpRequestSchema, { sessionId }), opts),
    );
    return buildAuthJsonResponse(200, {
      secret: res.secret,
      otpauthUrl: res.otpauthUrl,
      backupCodes: [...res.backupCodes],
    });
  }

  if (splat === 'totp/verify') {
    const code = typeof body['code'] === 'string' ? body['code'].trim() : '';
    const pendingToken =
      typeof body['pendingToken'] === 'string' ? body['pendingToken'].trim() : '';
    if (!code) {
      return buildAuthJsonResponse(400, {
        error: 'INVALID_REQUEST',
        message: 'TOTP verification code is required',
      });
    }
    if (pendingToken) {
      const { client, meta } = createAdminAuthGrpcClient({
        ...callCtx,
        role: 'service',
        subject: 'admin-auth-bff',
      });
      const res = await invokeUnaryWithAuth(
        '/admin.v1.AdminAuthService/VerifyTotpStepUp',
        meta,
        opts =>
          client.verifyTotpStepUp(
            create(VerifyTotpStepUpRequestSchema, {
              pendingToken,
              code,
              ...(clientIp ? { clientIp } : {}),
            }),
            opts,
          ),
      );
      const session = mapProtoAdminSession(res.session);
      return buildAuthJsonResponse(
        200,
        { verified: true, passkeyCount: res.passkeyCount, session },
        session
          ? { cookies: [buildAdminSessionCookieHeader(session.sessionId, secureCookie)] }
          : undefined,
      );
    }

    if (!sessionId) {
      return buildAuthJsonResponse(401, {
        error: 'UNAUTHORIZED',
        message: 'Admin session or pendingToken required',
      });
    }
    const { client, meta } = createAdminAuthGrpcClient({ ...callCtx, role: 'admin', sessionId });
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminAuthService/ConfirmTotpEnrollment',
      meta,
      opts =>
        client.confirmTotpEnrollment(
          create(ConfirmTotpEnrollmentRequestSchema, {
            sessionId,
            code,
            ...(clientIp ? { clientIp } : {}),
          }),
          opts,
        ),
    );
    return buildAuthJsonResponse(200, { verified: res.verified, enabled: res.enabled });
  }

  if (splat === 'totp/disable') {
    if (!sessionId) {
      return buildAuthJsonResponse(401, {
        error: 'UNAUTHORIZED',
        message: 'Admin session required',
      });
    }
    const { client, meta } = createAdminAuthGrpcClient({ ...callCtx, role: 'admin', sessionId });
    const res = await invokeUnaryWithAuth('/admin.v1.AdminAuthService/DisableTotp', meta, opts =>
      client.disableTotp(create(DisableTotpRequestSchema, { sessionId }), opts),
    );
    return buildAuthJsonResponse(200, { disabled: res.disabled });
  }

  return null;
}
