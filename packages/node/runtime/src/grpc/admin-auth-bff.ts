import { randomUUID } from 'node:crypto';

import { create } from '@bufbuild/protobuf';

import {
  ADMIN_SESSION_COOKIE_NAME,
  clearSessionCookie,
  GUEST_SESSION_COOKIE_NAME,
  isSecureRequest,
} from '../auth.ts';
import {
  createAdminAuthGrpcClient,
  extractAdminSessionCookieId,
  GetAdminSessionRequestSchema,
  LogoutAdminSessionRequestSchema,
  mapProtoAdminSession,
  PasswordLoginRequestSchema,
} from './admin-auth-client.ts';
import {
  buildAdminSessionCookieHeader,
  buildAuthJsonResponse,
  dispatchAdminMfaAuthBff,
} from './admin-auth-mfa-bff.ts';
import { resolveRequestClientIp, type AdminGrpcCallContext } from './admin-common.ts';
import { classifyAdminGrpcError } from './errors.ts';
import { invokeUnaryWithAuth } from './transport.ts';

function isInvalidAuthSplat(splat: string): boolean {
  if (splat.length === 0) return false;
  if (splat.includes('%') || splat.includes('..') || !/^[a-z0-9/-]+$/.test(splat)) {
    return true;
  }
  return splat.split('/').some(segment => segment.length === 0 || segment === '.');
}

function buildAuthErrorResponse(
  error: unknown,
  source: string,
  correlationId: string,
  ctx: AdminGrpcCallContext,
): Response {
  const failure = classifyAdminGrpcError(error, {
    correlationId,
    source,
    normalizeUnavailableStatus: 503,
    ...(ctx.logger ? { logger: ctx.logger } : {}),
  });
  const status = failure.publicError.status;
  const code = failure.upstreamCode ?? failure.publicError.code;
  const message = failure.upstreamMessage ?? failure.publicError.message;
  const headers: Record<string, string> = { 'x-correlation-id': correlationId };
  if (failure.retryAfterSeconds !== undefined) {
    headers['retry-after'] = String(failure.retryAfterSeconds);
  }
  return buildAuthJsonResponse(
    status,
    {
      ...(status === 429 ? { statusCode: 429 } : {}),
      error: code,
      message,
    },
    { headers },
  );
}

function parseJsonRecord(body: unknown): Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

export async function handleAdminAuthGrpcBffRequest(
  request: Request,
  splat: string,
  ctx: AdminGrpcCallContext = {},
): Promise<Response> {
  const normalizedSplat = splat.replace(/^\/+|\/+$/g, '');
  if (isInvalidAuthSplat(normalizedSplat)) {
    return buildAuthJsonResponse(400, { error: 'INVALID_REQUEST', message: 'Invalid auth path' });
  }

  const method = request.method.toUpperCase();
  // POST /api/auth/guest is retired on admin console; never mints guest sessions.
  if (normalizedSplat === 'guest') {
    return buildAuthJsonResponse(404, {
      error: 'NOT_FOUND',
      message: `Unknown auth route: ${method} /guest`,
    });
  }

  const reqUrl = new URL(request.url);
  const secureCookie = isSecureRequest(reqUrl, request.headers.get('x-forwarded-proto'));
  const originHeader = request.headers.get('origin') ?? reqUrl.origin;
  const clientIp = resolveRequestClientIp(request);
  const sessionId = extractAdminSessionCookieId(request.headers.get('cookie'));
  const correlationId = ctx.correlationId?.trim() || randomUUID();

  let rawBody: unknown;
  if (method !== 'GET' && method !== 'HEAD') {
    const rawText = await request.text();
    if (rawText.trim().length > 0) {
      try {
        rawBody = JSON.parse(rawText);
      } catch {
        return buildAuthJsonResponse(400, {
          error: 'INVALID_JSON',
          message: 'Request body must be valid JSON',
        });
      }
    }
  }
  const body = parseJsonRecord(rawBody);
  const callCtx: AdminGrpcCallContext = {
    ...ctx,
    correlationId,
    clientIp,
    ...(sessionId ? { sessionId } : {}),
  };

  try {
    if (method === 'GET' && normalizedSplat === 'session') {
      if (!sessionId) {
        return buildAuthJsonResponse(200, {
          authenticated: false,
          session: null,
          totpEnabled: false,
          passkeyCount: 0,
        });
      }
      const { client, meta } = createAdminAuthGrpcClient({
        ...callCtx,
        role: 'service',
        subject: 'admin-auth-bff',
      });
      const res = await invokeUnaryWithAuth(
        '/admin.v1.AdminAuthService/GetAdminSession',
        meta,
        opts => client.getAdminSession(create(GetAdminSessionRequestSchema, { sessionId }), opts),
      );
      if (!res.authenticated || !res.session) {
        return buildAuthJsonResponse(200, {
          authenticated: false,
          session: null,
          totpEnabled: false,
          passkeyCount: 0,
        });
      }
      return buildAuthJsonResponse(200, {
        authenticated: true,
        session: mapProtoAdminSession(res.session),
        totpEnabled: res.totpEnabled,
        passkeyCount: res.passkeyCount,
      });
    }

    if (method === 'POST' && normalizedSplat === 'logout') {
      if (sessionId) {
        const { client, meta } = createAdminAuthGrpcClient({
          ...callCtx,
          role: 'service',
          subject: 'admin-auth-bff',
        });
        await invokeUnaryWithAuth('/admin.v1.AdminAuthService/LogoutAdminSession', meta, opts =>
          client.logoutAdminSession(create(LogoutAdminSessionRequestSchema, { sessionId }), opts),
        );
      }
      return buildAuthJsonResponse(
        200,
        { loggedOut: true },
        {
          cookies: [
            clearSessionCookie(ADMIN_SESSION_COOKIE_NAME, { secure: secureCookie }),
            clearSessionCookie(GUEST_SESSION_COOKIE_NAME, { secure: secureCookie }),
          ],
        },
      );
    }

    if (method === 'POST' && normalizedSplat === 'password/login') {
      const handle = typeof body['handle'] === 'string' ? body['handle'].trim() : '';
      const password = typeof body['password'] === 'string' ? body['password'] : '';
      if (!handle || !password) {
        return buildAuthJsonResponse(400, {
          error: 'INVALID_REQUEST',
          message: 'Handle and password are required',
        });
      }
      const { client, meta } = createAdminAuthGrpcClient({
        ...callCtx,
        role: 'service',
        subject: 'admin-auth-bff',
      });
      const res = await invokeUnaryWithAuth(
        '/admin.v1.AdminAuthService/PasswordLogin',
        meta,
        opts =>
          client.passwordLogin(
            create(PasswordLoginRequestSchema, {
              handle,
              password,
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
        {
          verified: true,
          requiresTotp: false,
          passkeyCount: res.passkeyCount,
          session,
        },
        session
          ? { cookies: [buildAdminSessionCookieHeader(session.sessionId, secureCookie)] }
          : undefined,
      );
    }

    const mfaRes = await dispatchAdminMfaAuthBff({
      method,
      splat: normalizedSplat,
      body,
      sessionId,
      clientIp,
      originHeader,
      secureCookie,
      callCtx,
    });
    if (mfaRes) return mfaRes;

    return buildAuthJsonResponse(404, {
      error: 'NOT_FOUND',
      message: `Unknown auth route: ${method} /${normalizedSplat}`,
    });
  } catch (error) {
    return buildAuthErrorResponse(error, `admin.auth.${normalizedSplat}`, correlationId, callCtx);
  }
}
