import { type AuthSessionStatus, AuthSessionStatusSchema } from '@aklapper/core';
import {
  ADMIN_SESSION_COOKIE_NAME,
  buildTotpOtpAuthUrl,
  clearSessionCookie,
  decryptTotpSecret,
  encryptTotpSecret,
  generateBackupCodes,
  generateTotpSecret,
  GUEST_SESSION_COOKIE_NAME,
  hashBackupCode,
  isSecureRequest,
  parseCookieHeader,
  serializeSessionCookie,
  timingSafeStringEqual,
  verifyBackupCode,
  verifyTotpCode,
} from '@aklapper/node-runtime/auth';
import {
  joinUpstreamUrl,
  signInternalAuthToken,
  verifyInternalAuthToken,
} from '@aklapper/node-runtime/http';
import {
  type AuthenticationResponseJSON,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type RegistrationResponseJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { z } from 'zod';

import { type AppDatabase, getSharedDb } from './client.ts';
import {
  consumeTotpBackupCode,
  consumeWebauthnChallenge,
  createAuthSession,
  createWebauthnChallenge,
  disableUserTotpSecret,
  enableUserTotpSecret,
  findAdminUser,
  findOrCreateAdminUser,
  getUserById,
  getUserTotpSecret,
  getValidAuthSession,
  getWebauthnCredentialById,
  listUserWebauthnCredentials,
  revokeAuthSession,
  saveWebauthnCredential,
  updateWebauthnCredentialCounter,
  upsertUserTotpSecret,
} from './queries.ts';

const GUEST_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const PENDING_TOTP_TTL_SECONDS = 300;
const PENDING_TOTP_PREFIX = 'totp-pending:';

export interface AuthDispatchRequest {
  method: string;
  action: string;
  cookieHeader?: string | null;
  bootstrapTokenHeader?: string | null;
  originHeader?: string | null;
  isSecure?: boolean;
  body?: unknown;
}

export interface AuthDispatchResult {
  status: number;
  body: Record<string, unknown>;
  cookies?: string[];
}

export interface AuthServiceOptions {
  db?: AppDatabase;
  env?: Record<string, string | undefined>;
}

const RegisterOptionsBodySchema = z
  .object({
    handle: z.string().trim().min(1).max(64).optional(),
    bootstrapToken: z.string().min(1).optional(),
  })
  .optional();

const RegisterVerifyBodySchema = z.object({
  challengeId: z.string().min(1),
  response: z.record(z.string(), z.unknown()),
});

const LoginOptionsBodySchema = z
  .object({
    handle: z.string().trim().min(1).max(64).optional(),
  })
  .optional();

const LoginVerifyBodySchema = z.object({
  challengeId: z.string().min(1),
  response: z.record(z.string(), z.unknown()),
  totpCode: z.string().trim().min(1).optional(),
});

const TotpVerifyBodySchema = z.object({
  code: z.string().trim().min(1),
  pendingToken: z.string().min(1).optional(),
});

interface WebAuthnConfig {
  rpName: string;
  rpID: string;
  expectedOrigins: string[];
}

function resolveWebAuthnConfig(
  env: Record<string, string | undefined>,
  originHeader?: string | null,
): WebAuthnConfig {
  const rpName = env['WEBAUTHN_RP_NAME']?.trim() || 'andrew-k.us Admin';
  const rpID = env['WEBAUTHN_RP_ID']?.trim() || 'localhost';
  const rawOrigins = env['WEBAUTHN_ORIGIN']?.trim() || 'http://localhost:4201';
  const origins = new Set(
    rawOrigins
      .split(',')
      .map(item => item.trim().replace(/\/+$/, ''))
      .filter(Boolean),
  );

  const reqOrigin = originHeader?.trim().replace(/\/+$/, '');
  if (reqOrigin) {
    try {
      const parsed = new URL(reqOrigin);
      const isMatchingHost = parsed.hostname === rpID || parsed.hostname.endsWith(`.${rpID}`);
      if (isMatchingHost && (parsed.protocol === 'http:' || parsed.protocol === 'https:')) {
        origins.add(parsed.origin);
      }
    } catch {
      // ignore invalid origin header
    }
  }

  return {
    rpName,
    rpID,
    expectedOrigins: [...origins],
  };
}

function isValidBootstrapToken(
  provided: string | null | undefined,
  env: Record<string, string | undefined>,
): boolean {
  const configured = env['ADMIN_BOOTSTRAP_TOKEN']?.trim();
  const candidate = provided?.trim();
  if (!configured || !candidate) return false;
  return timingSafeStringEqual(candidate, configured);
}

async function resolveAdminSession(db: AppDatabase, cookieHeader?: string | null) {
  const cookies = parseCookieHeader(cookieHeader);
  const adminSessionId = cookies[ADMIN_SESSION_COOKIE_NAME];
  if (!adminSessionId) return null;
  const record = await getValidAuthSession(db, adminSessionId);
  if (!record || record.session.role !== 'admin' || !record.userId) return null;
  return record;
}

async function resolveAnySession(db: AppDatabase, cookieHeader?: string | null) {
  const cookies = parseCookieHeader(cookieHeader);
  const adminSessionId = cookies[ADMIN_SESSION_COOKIE_NAME];
  if (adminSessionId) {
    const adminRecord = await getValidAuthSession(db, adminSessionId);
    if (adminRecord) return adminRecord;
  }
  const guestSessionId = cookies[GUEST_SESSION_COOKIE_NAME];
  if (guestSessionId) {
    const guestRecord = await getValidAuthSession(db, guestSessionId);
    if (guestRecord) return guestRecord;
  }
  return null;
}

function verifyTotpOrBackupCode(
  db: AppDatabase,
  userId: string,
  totpRecord: { encryptedSecret: string; backupCodesHash: string[] },
  code: string,
  totpKey?: string,
): Promise<boolean> {
  const secret = decryptTotpSecret(totpRecord.encryptedSecret, totpKey);
  if (verifyTotpCode(secret, code)) {
    return Promise.resolve(true);
  }
  const backupCheck = verifyBackupCode(code, totpRecord.backupCodesHash);
  if (backupCheck.matched) {
    return consumeTotpBackupCode(db, userId, backupCheck.remainingHashes).then(() => true);
  }
  return Promise.resolve(false);
}

export async function dispatchAuthAction(
  req: AuthDispatchRequest,
  options: AuthServiceOptions = {},
): Promise<AuthDispatchResult> {
  const db = options.db ?? getSharedDb();
  const env = options.env ?? process.env;
  const method = req.method.toUpperCase();
  const action = req.action.replace(/^\/+|\/+$/g, '');
  const secureCookie = Boolean(req.isSecure);
  const totpKey = env['TOTP_ENCRYPTION_KEY'];
  const internalSecret = env['INTERNAL_AUTH_SECRET'];

  // POST /v1/auth/guest
  if (method === 'POST' && action === 'guest') {
    const session = await createAuthSession(db, {
      userId: null,
      role: 'guest',
      handle: 'guest',
      ttlMs: GUEST_SESSION_TTL_MS,
    });
    return {
      status: 201,
      body: session,
      cookies: [
        serializeSessionCookie(GUEST_SESSION_COOKIE_NAME, session.sessionId, {
          maxAgeSeconds: GUEST_SESSION_TTL_MS / 1000,
          secure: secureCookie,
        }),
      ],
    };
  }

  // GET /v1/auth/session
  if (method === 'GET' && action === 'session') {
    const valid = await resolveAnySession(db, req.cookieHeader);
    if (!valid) {
      const payload: AuthSessionStatus = {
        authenticated: false,
        session: null,
        totpEnabled: false,
        passkeyCount: 0,
      };
      return { status: 200, body: payload };
    }
    const payload: AuthSessionStatus = {
      authenticated: true,
      session: valid.session,
      totpEnabled: valid.totpEnabled,
      passkeyCount: valid.passkeyCount,
    };
    return { status: 200, body: payload };
  }

  // POST /v1/auth/logout
  if (method === 'POST' && action === 'logout') {
    const cookies = parseCookieHeader(req.cookieHeader);
    await Promise.all([
      revokeAuthSession(db, cookies[ADMIN_SESSION_COOKIE_NAME]),
      revokeAuthSession(db, cookies[GUEST_SESSION_COOKIE_NAME]),
    ]);
    return {
      status: 200,
      body: { loggedOut: true },
      cookies: [
        clearSessionCookie(ADMIN_SESSION_COOKIE_NAME, { secure: secureCookie }),
        clearSessionCookie(GUEST_SESSION_COOKIE_NAME, { secure: secureCookie }),
      ],
    };
  }

  // POST /v1/auth/passkey/register/options
  if (method === 'POST' && action === 'passkey/register/options') {
    const parsedBody = RegisterOptionsBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return {
        status: 400,
        body: { error: 'INVALID_REQUEST', message: 'Invalid passkey registration request' },
      };
    }

    const adminSession = await resolveAdminSession(db, req.cookieHeader);
    const providedToken = req.bootstrapTokenHeader ?? parsedBody.data?.bootstrapToken;
    const bootstrapAuthorized = isValidBootstrapToken(providedToken, env);

    if (!adminSession && !bootstrapAuthorized) {
      return {
        status: 401,
        body: {
          error: 'UNAUTHORIZED',
          message: 'Valid admin session or bootstrap token required',
        },
      };
    }

    const handle = adminSession?.session.handle ?? parsedBody.data?.handle ?? 'admin';
    const user = await findOrCreateAdminUser(db, handle);
    const existingCreds = await listUserWebauthnCredentials(db, user.id);
    const config = resolveWebAuthnConfig(env, req.originHeader);

    const registrationOptions = await generateRegistrationOptions({
      rpName: config.rpName,
      rpID: config.rpID,
      userID: Buffer.from(user.id, 'utf8'),
      userName: user.handle,
      userDisplayName: user.handle,
      attestationType: 'none',
      excludeCredentials: existingCreds.map(cred => ({
        id: cred.credentialId,
        transports: cred.transports,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    const challengeRow = await createWebauthnChallenge(db, {
      challenge: registrationOptions.challenge,
      userId: user.id,
      kind: 'register',
      ttlMs: CHALLENGE_TTL_MS,
    });

    return {
      status: 200,
      body: {
        challengeId: challengeRow.id,
        options: registrationOptions,
      },
    };
  }

  // POST /v1/auth/passkey/register/verify
  if (method === 'POST' && action === 'passkey/register/verify') {
    const parsedBody = RegisterVerifyBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return {
        status: 400,
        body: { error: 'INVALID_REQUEST', message: 'challengeId and response are required' },
      };
    }

    const challengeRow = await consumeWebauthnChallenge(db, {
      challengeId: parsedBody.data.challengeId,
      kind: 'register',
    });
    if (!challengeRow || !challengeRow.userId) {
      return {
        status: 400,
        body: {
          error: 'INVALID_OR_EXPIRED_CHALLENGE',
          message: 'Registration challenge is invalid, expired, or already used',
        },
      };
    }

    const config = resolveWebAuthnConfig(env, req.originHeader);
    try {
      const verification = await verifyRegistrationResponse({
        response: parsedBody.data.response as unknown as RegistrationResponseJSON,
        expectedChallenge: challengeRow.challenge,
        expectedOrigin: config.expectedOrigins,
        expectedRPID: config.rpID,
        requireUserVerification: false,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return {
          status: 400,
          body: { error: 'PASSKEY_VERIFICATION_FAILED', message: 'Passkey verification failed' },
        };
      }

      const { credential } = verification.registrationInfo;
      await saveWebauthnCredential(db, {
        credentialId: credential.id,
        userId: challengeRow.userId,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        transports: credential.transports ?? [],
      });

      const session = await createAuthSession(db, {
        userId: challengeRow.userId,
        role: 'admin',
        ttlMs: ADMIN_SESSION_TTL_MS,
      });

      return {
        status: 201,
        body: {
          verified: true,
          credentialId: credential.id,
          session,
        },
        cookies: [
          serializeSessionCookie(ADMIN_SESSION_COOKIE_NAME, session.sessionId, {
            maxAgeSeconds: ADMIN_SESSION_TTL_MS / 1000,
            secure: secureCookie,
          }),
        ],
      };
    } catch (error) {
      return {
        status: 400,
        body: {
          error: 'PASSKEY_VERIFICATION_FAILED',
          message: error instanceof Error ? error.message : 'Passkey registration failed',
        },
      };
    }
  }

  // POST /v1/auth/passkey/login/options
  if (method === 'POST' && action === 'passkey/login/options') {
    const parsedBody = LoginOptionsBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return {
        status: 400,
        body: { error: 'INVALID_REQUEST', message: 'Invalid passkey login request' },
      };
    }

    const user = await findAdminUser(db, parsedBody.data?.handle);
    const creds = user ? await listUserWebauthnCredentials(db, user.id) : [];
    const config = resolveWebAuthnConfig(env, req.originHeader);

    const authOptions = await generateAuthenticationOptions({
      rpID: config.rpID,
      allowCredentials: creds.map(cred => ({
        id: cred.credentialId,
        transports: cred.transports,
      })),
      userVerification: 'preferred',
    });

    const challengeRow = await createWebauthnChallenge(db, {
      challenge: authOptions.challenge,
      userId: user?.id ?? null,
      kind: 'login',
      ttlMs: CHALLENGE_TTL_MS,
    });

    return {
      status: 200,
      body: {
        challengeId: challengeRow.id,
        options: authOptions,
      },
    };
  }

  // POST /v1/auth/passkey/login/verify
  if (method === 'POST' && action === 'passkey/login/verify') {
    const parsedBody = LoginVerifyBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return {
        status: 400,
        body: { error: 'INVALID_REQUEST', message: 'challengeId and response are required' },
      };
    }

    const challengeRow = await consumeWebauthnChallenge(db, {
      challengeId: parsedBody.data.challengeId,
      kind: 'login',
    });
    if (!challengeRow) {
      return {
        status: 400,
        body: {
          error: 'INVALID_OR_EXPIRED_CHALLENGE',
          message: 'Login challenge is invalid, expired, or already used',
        },
      };
    }

    const assertionResponse = parsedBody.data.response as unknown as AuthenticationResponseJSON;
    if (typeof assertionResponse.id !== 'string' || !assertionResponse.id) {
      return {
        status: 400,
        body: { error: 'INVALID_REQUEST', message: 'Missing credential id in assertion response' },
      };
    }

    const storedCred = await getWebauthnCredentialById(db, assertionResponse.id);
    if (!storedCred) {
      return {
        status: 401,
        body: { error: 'UNKNOWN_CREDENTIAL', message: 'Passkey credential is not registered' },
      };
    }

    const user = await getUserById(db, storedCred.userId);
    if (!user || user.role !== 'admin') {
      return {
        status: 403,
        body: { error: 'FORBIDDEN', message: 'Admin role required' },
      };
    }

    const config = resolveWebAuthnConfig(env, req.originHeader);
    try {
      const verification = await verifyAuthenticationResponse({
        response: assertionResponse,
        expectedChallenge: challengeRow.challenge,
        expectedOrigin: config.expectedOrigins,
        expectedRPID: config.rpID,
        requireUserVerification: false,
        credential: {
          id: storedCred.credentialId,
          publicKey: Buffer.from(storedCred.publicKey, 'base64url'),
          counter: storedCred.counter,
          transports: storedCred.transports,
        },
      });

      if (!verification.verified) {
        return {
          status: 401,
          body: { error: 'PASSKEY_VERIFICATION_FAILED', message: 'Passkey assertion failed' },
        };
      }

      await updateWebauthnCredentialCounter(
        db,
        storedCred.credentialId,
        verification.authenticationInfo.newCounter,
      );

      const totpRecord = await getUserTotpSecret(db, user.id);
      if (totpRecord?.enabled) {
        if (!parsedBody.data.totpCode) {
          const pendingToken = signInternalAuthToken({
            role: 'service',
            subject: `${PENDING_TOTP_PREFIX}${user.id}`,
            secret: internalSecret,
            ttlSeconds: PENDING_TOTP_TTL_SECONDS,
          });
          return {
            status: 200,
            body: {
              verified: false,
              requiresTotp: true,
              pendingToken,
            },
          };
        }

        const totpValid = await verifyTotpOrBackupCode(
          db,
          user.id,
          totpRecord,
          parsedBody.data.totpCode,
          totpKey,
        );
        if (!totpValid) {
          return {
            status: 401,
            body: { error: 'INVALID_TOTP_CODE', message: 'Invalid TOTP or backup code' },
          };
        }
      }

      const session = await createAuthSession(db, {
        userId: user.id,
        role: 'admin',
        handle: user.handle,
        ttlMs: ADMIN_SESSION_TTL_MS,
      });

      return {
        status: 200,
        body: {
          verified: true,
          requiresTotp: false,
          session,
        },
        cookies: [
          serializeSessionCookie(ADMIN_SESSION_COOKIE_NAME, session.sessionId, {
            maxAgeSeconds: ADMIN_SESSION_TTL_MS / 1000,
            secure: secureCookie,
          }),
        ],
      };
    } catch (error) {
      return {
        status: 401,
        body: {
          error: 'PASSKEY_VERIFICATION_FAILED',
          message: error instanceof Error ? error.message : 'Passkey authentication failed',
        },
      };
    }
  }

  // POST /v1/auth/totp/enroll
  if (method === 'POST' && action === 'totp/enroll') {
    const adminSession = await resolveAdminSession(db, req.cookieHeader);
    if (!adminSession || !adminSession.userId) {
      return {
        status: 401,
        body: { error: 'UNAUTHORIZED', message: 'Admin session required' },
      };
    }

    const secret = generateTotpSecret();
    const encryptedSecret = encryptTotpSecret(secret, totpKey);
    const backupCodes = generateBackupCodes(8);
    const backupCodesHash = backupCodes.map(hashBackupCode);

    await upsertUserTotpSecret(db, {
      userId: adminSession.userId,
      encryptedSecret,
      backupCodesHash,
      enabled: false,
    });

    const otpauthUrl = buildTotpOtpAuthUrl({
      secret,
      accountName: adminSession.session.handle,
      issuer: env['WEBAUTHN_RP_NAME']?.trim() || 'andrew-k.us Admin',
    });

    return {
      status: 200,
      body: {
        secret,
        otpauthUrl,
        backupCodes,
      },
    };
  }

  // POST /v1/auth/totp/verify
  if (method === 'POST' && action === 'totp/verify') {
    const parsedBody = TotpVerifyBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return {
        status: 400,
        body: { error: 'INVALID_REQUEST', message: 'TOTP verification code is required' },
      };
    }

    // Step-up login verification via pendingToken
    if (parsedBody.data.pendingToken) {
      const claims = verifyInternalAuthToken(parsedBody.data.pendingToken, internalSecret);
      if (!claims || claims.role !== 'service' || !claims.sub.startsWith(PENDING_TOTP_PREFIX)) {
        return {
          status: 401,
          body: {
            error: 'INVALID_PENDING_TOKEN',
            message: 'Pending 2FA token is invalid or expired',
          },
        };
      }

      const userId = claims.sub.slice(PENDING_TOTP_PREFIX.length);
      const user = await getUserById(db, userId);
      const totpRecord = await getUserTotpSecret(db, userId);
      if (!user || user.role !== 'admin' || !totpRecord || !totpRecord.enabled) {
        return {
          status: 401,
          body: { error: 'TOTP_NOT_ENABLED', message: 'TOTP is not active for this account' },
        };
      }

      const valid = await verifyTotpOrBackupCode(
        db,
        user.id,
        totpRecord,
        parsedBody.data.code,
        totpKey,
      );
      if (!valid) {
        return {
          status: 401,
          body: { error: 'INVALID_TOTP_CODE', message: 'Invalid TOTP or backup code' },
        };
      }

      const session = await createAuthSession(db, {
        userId: user.id,
        role: 'admin',
        handle: user.handle,
        ttlMs: ADMIN_SESSION_TTL_MS,
      });

      return {
        status: 200,
        body: {
          verified: true,
          session,
        },
        cookies: [
          serializeSessionCookie(ADMIN_SESSION_COOKIE_NAME, session.sessionId, {
            maxAgeSeconds: ADMIN_SESSION_TTL_MS / 1000,
            secure: secureCookie,
          }),
        ],
      };
    }

    // Enrollment confirmation for authenticated admin session
    const adminSession = await resolveAdminSession(db, req.cookieHeader);
    if (!adminSession || !adminSession.userId) {
      return {
        status: 401,
        body: { error: 'UNAUTHORIZED', message: 'Admin session or pendingToken required' },
      };
    }

    const totpRecord = await getUserTotpSecret(db, adminSession.userId);
    if (!totpRecord) {
      return {
        status: 404,
        body: { error: 'TOTP_NOT_ENROLLED', message: 'Enroll TOTP before verifying' },
      };
    }

    const secret = decryptTotpSecret(totpRecord.encryptedSecret, totpKey);
    if (!verifyTotpCode(secret, parsedBody.data.code)) {
      return {
        status: 401,
        body: { error: 'INVALID_TOTP_CODE', message: 'Invalid TOTP verification code' },
      };
    }

    await enableUserTotpSecret(db, adminSession.userId);
    return {
      status: 200,
      body: {
        verified: true,
        enabled: true,
      },
    };
  }

  // POST /v1/auth/totp/disable
  if (method === 'POST' && action === 'totp/disable') {
    const adminSession = await resolveAdminSession(db, req.cookieHeader);
    if (!adminSession || !adminSession.userId) {
      return {
        status: 401,
        body: { error: 'UNAUTHORIZED', message: 'Admin session required' },
      };
    }

    await disableUserTotpSecret(db, adminSession.userId);
    return {
      status: 200,
      body: { disabled: true },
    };
  }

  return {
    status: 404,
    body: { error: 'NOT_FOUND', message: `Unknown auth route: ${method} /${action}` },
  };
}

function buildWebResponseFromDispatch(result: AuthDispatchResult): Response {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' });
  if (result.cookies) {
    for (const cookie of result.cookies) {
      headers.append('set-cookie', cookie);
    }
  }
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers,
  });
}

export interface BffAuthProxyOptions extends AuthServiceOptions {
  authApiUrl?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Dual-mode Admin BFF auth handler:
 *
 * - Forwards to AUTH_API_URL (/v1/auth/*) when configured.
 * - Falls back directly to PostgreSQL 19 via dispatchAuthAction when AUTH_API_URL is unset.
 */
export async function handleAdminAuthBffRequest(
  request: Request,
  splat: string,
  options: BffAuthProxyOptions = {},
): Promise<Response> {
  const env = options.env ?? process.env;
  const upstreamBase = (options.authApiUrl ?? env['AUTH_API_URL'])?.trim();
  const normalizedSplat = splat.replace(/^\/+|\/+$/g, '');

  if (upstreamBase) {
    const fetchImpl = options.fetchImpl ?? fetch;
    const targetUrl = joinUpstreamUrl(upstreamBase, `/v1/auth/${normalizedSplat}`);
    const forwardHeaders = new Headers();
    const contentType = request.headers.get('content-type');
    if (contentType) forwardHeaders.set('content-type', contentType);
    const cookie = request.headers.get('cookie');
    if (cookie) forwardHeaders.set('cookie', cookie);
    const bootstrapToken = request.headers.get('x-bootstrap-token');
    if (bootstrapToken) forwardHeaders.set('x-bootstrap-token', bootstrapToken);
    const origin = request.headers.get('origin') ?? new URL(request.url).origin;
    if (origin) forwardHeaders.set('origin', origin);
    const forwardedProto = request.headers.get('x-forwarded-proto');
    if (forwardedProto) forwardHeaders.set('x-forwarded-proto', forwardedProto);

    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const rawBody = hasBody ? await request.text() : undefined;

    try {
      const upstream = await fetchImpl(targetUrl, {
        method: request.method,
        headers: forwardHeaders,
        body: rawBody && rawBody.length > 0 ? rawBody : undefined,
        signal: AbortSignal.timeout(10_000),
      });

      const responseHeaders = new Headers();
      const upstreamContentType = upstream.headers.get('content-type');
      if (upstreamContentType) {
        responseHeaders.set('content-type', upstreamContentType);
      }
      const setCookies =
        typeof upstream.headers.getSetCookie === 'function' ? upstream.headers.getSetCookie() : [];
      for (const sc of setCookies) {
        responseHeaders.append('set-cookie', sc);
      }

      return new Response(await upstream.arrayBuffer(), {
        status: upstream.status,
        headers: responseHeaders,
      });
    } catch {
      return Response.json(
        { error: 'AUTH_UPSTREAM_UNAVAILABLE', message: 'Auth service unreachable' },
        { status: 502 },
      );
    }
  }

  let body: unknown;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const rawText = await request.text();
    if (rawText.trim().length > 0) {
      try {
        body = JSON.parse(rawText);
      } catch {
        return Response.json(
          { error: 'INVALID_JSON', message: 'Request body must be valid JSON' },
          { status: 400 },
        );
      }
    }
  }

  const reqUrl = new URL(request.url);
  const result = await dispatchAuthAction(
    {
      method: request.method,
      action: normalizedSplat,
      cookieHeader: request.headers.get('cookie'),
      bootstrapTokenHeader: request.headers.get('x-bootstrap-token'),
      originHeader: request.headers.get('origin') ?? reqUrl.origin,
      isSecure: isSecureRequest(reqUrl, request.headers.get('x-forwarded-proto')),
      body,
    },
    options,
  );
  return buildWebResponseFromDispatch(result);
}

/**
 * Resolves current session status for the Admin SSR root loader guard. Uses AUTH_API_URL
 * (/v1/auth/session) if configured, else queries PG19 directly.
 */
export async function resolveAdminSessionFromRequest(
  request: Request,
  options: BffAuthProxyOptions = {},
): Promise<AuthSessionStatus> {
  const cookieHeader = request.headers.get('cookie');
  const emptyStatus: AuthSessionStatus = {
    authenticated: false,
    session: null,
    totpEnabled: false,
    passkeyCount: 0,
  };
  if (!cookieHeader) return emptyStatus;

  const env = options.env ?? process.env;
  const upstreamBase = (options.authApiUrl ?? env['AUTH_API_URL'])?.trim();
  if (upstreamBase) {
    const fetchImpl = options.fetchImpl ?? fetch;
    try {
      const res = await fetchImpl(joinUpstreamUrl(upstreamBase, '/v1/auth/session'), {
        method: 'GET',
        headers: { cookie: cookieHeader, accept: 'application/json' },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return emptyStatus;
      const parsed = AuthSessionStatusSchema.safeParse(await res.json());
      return parsed.success ? parsed.data : emptyStatus;
    } catch {
      return emptyStatus;
    }
  }

  const db = options.db ?? getSharedDb();
  const cookies = parseCookieHeader(cookieHeader);
  const adminSessionId = cookies[ADMIN_SESSION_COOKIE_NAME];
  if (!adminSessionId) return emptyStatus;
  const record = await getValidAuthSession(db, adminSessionId);
  if (!record || record.session.role !== 'admin') return emptyStatus;

  return {
    authenticated: true,
    session: record.session,
    totpEnabled: record.totpEnabled,
    passkeyCount: record.passkeyCount,
  };
}
