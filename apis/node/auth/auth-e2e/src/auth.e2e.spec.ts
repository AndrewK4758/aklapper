import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { AuthSessionSchema, AuthSessionStatusSchema } from '@aklapper/core';
import {
  createAuthSession,
  createDb,
  createDbPool,
  findOrCreateAdminUser,
  seedAdminUserFromEnv,
} from '@aklapper/db';
import { computeTotpCode } from '@aklapper/node-runtime/auth';
import { loadWorkspaceEnv } from '@aklapper/node-runtime/env';
import { fetchJson, startNodeApiProcess, type RunningNodeApi } from '@aklapper/tooling/e2e';

interface AuthHealthPayload {
  status: string;
  service: string;
  methods: string[];
}

interface AuthErrorPayload {
  error: string;
  message: string;
}

interface PasswordLoginPayload {
  verified: boolean;
  requiresTotp: boolean;
  pendingToken?: string;
  passkeyCount?: number;
  session?: unknown;
}

interface PasskeyOptionsPayload {
  challengeId: string;
  options: {
    challenge: string;
    rp?: { id: string; name: string };
    rpId?: string;
    allowCredentials?: unknown[];
    authenticatorSelection?: { residentKey?: string };
  };
}

interface TotpEnrollPayload {
  secret: string;
  otpauthUrl: string;
  backupCodes: string[];
}

const INTERNAL_SECRET = `e2e-internal-${randomUUID()}`;
const TOTP_KEY = `e2e-totp-key-${randomUUID()}`;

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function extractCookiePair(headers: Headers, cookieName: string): string {
  const cookies =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : [headers.get('set-cookie') ?? ''];
  const match = cookies.find(item => item.startsWith(`${cookieName}=`));
  if (!match) {
    throw new Error(`Expected set-cookie for ${cookieName}, got: ${cookies.join('; ')}`);
  }
  return match.split(';')[0] ?? '';
}

describe('node-api-auth E2E (PostgreSQL 19)', () => {
  let api: RunningNodeApi;
  const createdSessionIds: string[] = [];
  const createdChallengeIds: string[] = [];
  const createdUserHandles: string[] = [];
  const createdRateLimitKeys: string[] = [];

  beforeAll(async () => {
    loadWorkspaceEnv({ startDir: import.meta.dirname, mode: 'e2e' });
    const authDir = resolve(import.meta.dirname, '../../auth');
    api = await startNodeApiProcess({
      cwd: authDir,
      entryPath: 'src/main.ts',
      env: {
        INTERNAL_AUTH_SECRET: INTERNAL_SECRET,
        TOTP_ENCRYPTION_KEY: TOTP_KEY,
        WEBAUTHN_RP_ID: 'localhost',
        WEBAUTHN_ORIGIN: 'http://localhost:4301',
      },
    });
  });

  afterAll(async () => {
    await api.close();
    const pool = createDbPool();
    try {
      if (createdChallengeIds.length > 0) {
        await pool.query('DELETE FROM webauthn_challenges WHERE id = ANY($1::uuid[])', [
          createdChallengeIds,
        ]);
      }
      if (createdSessionIds.length > 0) {
        await pool.query('DELETE FROM auth_sessions WHERE id = ANY($1::uuid[])', [
          createdSessionIds,
        ]);
      }
      if (createdUserHandles.length > 0) {
        await pool.query('DELETE FROM users WHERE handle = ANY($1::text[])', [createdUserHandles]);
      }
      if (createdRateLimitKeys.length > 0) {
        await pool.query('DELETE FROM rate_limit_buckets WHERE scope_key = ANY($1::text[])', [
          createdRateLimitKeys,
        ]);
      }
    } finally {
      await pool.end();
    }
  });

  it('serves /healthz with security headers over real HTTP', async () => {
    const res = await fetchJson<AuthHealthPayload>(`${api.baseUrl}/healthz`);

    expect(res.status).toBe(200);
    expect(res.data).toEqual({
      status: 'ok',
      service: 'node-api-auth',
      methods: ['password', 'passkey', 'totp-2fa', 'guest'],
    });
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
  });

  it('persists guest sessions in PG19, validates cookies on /session, and revokes on /logout', async () => {
    const first = await fetchJson<unknown>(`${api.baseUrl}/v1/auth/guest`, { method: 'POST' });
    const second = await fetchJson<unknown>(`${api.baseUrl}/v1/auth/guest`, { method: 'POST' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const parsedFirst = AuthSessionSchema.parse(first.data);
    const parsedSecond = AuthSessionSchema.parse(second.data);
    createdSessionIds.push(parsedFirst.sessionId, parsedSecond.sessionId);

    expect(parsedFirst.role).toBe('guest');
    expect(parsedFirst.sessionId).not.toBe(parsedSecond.sessionId);

    const guestCookie = extractCookiePair(first.headers, 'ak_guest_session');
    const sessionCheck = await fetchJson<unknown>(`${api.baseUrl}/v1/auth/session`, {
      headers: { cookie: guestCookie },
    });
    expect(sessionCheck.status).toBe(200);
    const parsedStatus = AuthSessionStatusSchema.parse(sessionCheck.data);
    expect(parsedStatus.authenticated).toBe(true);
    expect(parsedStatus.session?.sessionId).toBe(parsedFirst.sessionId);

    const logoutRes = await fetchJson<{ loggedOut: boolean }>(`${api.baseUrl}/v1/auth/logout`, {
      method: 'POST',
      headers: { cookie: guestCookie },
    });
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.data.loggedOut).toBe(true);

    const afterLogout = await fetchJson<unknown>(`${api.baseUrl}/v1/auth/session`, {
      headers: { cookie: guestCookie },
    });
    const parsedAfter = AuthSessionStatusSchema.parse(afterLogout.data);
    expect(parsedAfter.authenticated).toBe(false);
    expect(parsedAfter.session).toBeNull();
  });

  it('provisions Argon2id password, enforces authenticated passkey registration, and returns discoverable login options in PG19', async () => {
    const handle = `e2e-admin-${randomUUID().slice(0, 8)}`;
    const password = `e2e-pass-${randomUUID()}`;
    const testIp = '198.51.100.41';
    createdUserHandles.push(handle);
    createdRateLimitKeys.push(
      `auth:login:ip:${sha256Hex(testIp)}`,
      `auth:login:handle:${sha256Hex(handle)}`,
    );

    const pool = createDbPool();
    const db = createDb(pool);
    try {
      const seeded = await seedAdminUserFromEnv(db, {
        ADMIN_HANDLE: `  ${handle.toUpperCase()}  `,
        ADMIN_PASSWORD: password,
      });
      expect(seeded).toEqual({ seeded: true, handle, action: 'inserted' });
    } finally {
      await pool.end();
    }

    const deniedUnauth = await fetchJson<AuthErrorPayload>(
      `${api.baseUrl}/v1/auth/passkey/register/options`,
      { method: 'POST', body: {} },
    );
    expect(deniedUnauth.status).toBe(401);

    const deniedBootstrap = await fetchJson<AuthErrorPayload>(
      `${api.baseUrl}/v1/auth/passkey/register/options`,
      {
        method: 'POST',
        headers: { 'x-bootstrap-token': 'forged-bootstrap-token' },
        body: { handle },
      },
    );
    expect(deniedBootstrap.status).toBe(401);

    const badPass = await fetchJson<AuthErrorPayload>(`${api.baseUrl}/v1/auth/password/login`, {
      method: 'POST',
      headers: { 'x-forwarded-for': testIp },
      body: { handle, password: 'wrong-password' },
    });
    expect(badPass.status).toBe(401);
    expect(badPass.data.error).toBe('INVALID_CREDENTIALS');

    const loginRes = await fetchJson<PasswordLoginPayload>(
      `${api.baseUrl}/v1/auth/password/login`,
      {
        method: 'POST',
        headers: { 'x-forwarded-for': testIp },
        body: { handle: handle.toUpperCase(), password },
      },
    );
    expect(loginRes.status).toBe(200);
    expect(loginRes.data.verified).toBe(true);
    expect(loginRes.data.requiresTotp).toBe(false);
    expect(loginRes.data.passkeyCount).toBe(0);
    const parsedSession = AuthSessionSchema.parse(loginRes.data.session);
    createdSessionIds.push(parsedSession.sessionId);
    const adminCookie = extractCookiePair(loginRes.headers, 'ak_admin_session');

    const regOpts = await fetchJson<PasskeyOptionsPayload>(
      `${api.baseUrl}/v1/auth/passkey/register/options`,
      {
        method: 'POST',
        headers: { cookie: adminCookie },
        body: {},
      },
    );
    expect(regOpts.status).toBe(200);
    expect(regOpts.data.challengeId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(regOpts.data.options.authenticatorSelection?.residentKey).toBe('required');
    createdChallengeIds.push(regOpts.data.challengeId);

    const discoverableOpts = await fetchJson<PasskeyOptionsPayload>(
      `${api.baseUrl}/v1/auth/passkey/login/options`,
      {
        method: 'POST',
        body: {},
      },
    );
    expect(discoverableOpts.status).toBe(200);
    expect(discoverableOpts.data.options.allowCredentials).toEqual([]);
    createdChallengeIds.push(discoverableOpts.data.challengeId);

    const verifyPool = createDbPool();
    try {
      const result = await verifyPool.query<{ kind: string; user_id: string | null }>(
        'SELECT kind, user_id FROM webauthn_challenges WHERE id = ANY($1::uuid[]) ORDER BY kind ASC',
        [[regOpts.data.challengeId, discoverableOpts.data.challengeId]],
      );
      expect(result.rows.map(r => r.kind)).toEqual(['login', 'register']);
      expect(result.rows[0]?.user_id).toBeNull();
      expect(result.rows[1]?.user_id).not.toBeNull();
    } finally {
      await verifyPool.end();
    }
  });

  it('enforces PG19 rate limiting with 429 and Retry-After on repeated failed password logins', async () => {
    const handle = `e2e-rl-${randomUUID().slice(0, 8)}`;
    const testIp = '198.51.100.42';
    createdRateLimitKeys.push(
      `auth:login:ip:${sha256Hex(testIp)}`,
      `auth:login:handle:${sha256Hex(handle)}`,
    );

    for (let i = 0; i < 10; i += 1) {
      const attempt = await fetchJson<AuthErrorPayload>(`${api.baseUrl}/v1/auth/password/login`, {
        method: 'POST',
        headers: { 'x-forwarded-for': testIp },
        body: { handle, password: 'bad-password' },
      });
      expect(attempt.status).toBe(401);
    }

    const blocked = await fetchJson<AuthErrorPayload>(`${api.baseUrl}/v1/auth/password/login`, {
      method: 'POST',
      headers: { 'x-forwarded-for': testIp },
      body: { handle, password: 'bad-password' },
    });
    expect(blocked.status).toBe(429);
    expect(blocked.data.error).toBe('RATE_LIMITED');
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('supports TOTP 2FA enroll, password login step-up with pendingToken, single-use backup code, and disable in PG19', async () => {
    const handle = `e2e-totp-${randomUUID().slice(0, 8)}`;
    const password = `e2e-totp-pass-${randomUUID()}`;
    const testIp = '198.51.100.43';
    createdUserHandles.push(handle);
    createdRateLimitKeys.push(
      `auth:login:ip:${sha256Hex(testIp)}`,
      `auth:login:handle:${sha256Hex(handle)}`,
      `auth:totp:ip:${sha256Hex(testIp)}`,
    );

    const pool = createDbPool();
    const db = createDb(pool);
    let adminCookie = '';
    let userId = '';
    try {
      await seedAdminUserFromEnv(db, { ADMIN_HANDLE: handle, ADMIN_PASSWORD: password });
      const user = await findOrCreateAdminUser(db, handle);
      userId = user.id;
      createdRateLimitKeys.push(`auth:totp:user:${userId}`);
      const session = await createAuthSession(db, {
        userId: user.id,
        role: 'admin',
        handle: user.handle,
        ttlMs: 60 * 60 * 1000,
      });
      createdSessionIds.push(session.sessionId);
      adminCookie = `ak_admin_session=${session.sessionId}`;
    } finally {
      await pool.end();
    }

    const enroll = await fetchJson<TotpEnrollPayload>(`${api.baseUrl}/v1/auth/totp/enroll`, {
      method: 'POST',
      headers: { cookie: adminCookie },
    });
    expect(enroll.status).toBe(200);
    expect(enroll.data.otpauthUrl).toContain('otpauth://totp/');
    expect(enroll.data.backupCodes).toHaveLength(8);

    const liveCode = computeTotpCode(enroll.data.secret);
    const verify = await fetchJson<{ verified: boolean; enabled: boolean }>(
      `${api.baseUrl}/v1/auth/totp/verify`,
      {
        method: 'POST',
        headers: { cookie: adminCookie, 'x-forwarded-for': testIp },
        body: { code: liveCode },
      },
    );
    expect(verify.status).toBe(200);
    expect(verify.data).toEqual({ verified: true, enabled: true });

    const status = await fetchJson<unknown>(`${api.baseUrl}/v1/auth/session`, {
      headers: { cookie: adminCookie },
    });
    expect(AuthSessionStatusSchema.parse(status.data).totpEnabled).toBe(true);

    // Password login triggers TOTP step-up with pendingToken and zero Set-Cookie
    const pwStepUp = await fetchJson<PasswordLoginPayload>(
      `${api.baseUrl}/v1/auth/password/login`,
      {
        method: 'POST',
        headers: { 'x-forwarded-for': testIp },
        body: { handle, password },
      },
    );
    expect(pwStepUp.status).toBe(200);
    expect(pwStepUp.data.verified).toBe(false);
    expect(pwStepUp.data.requiresTotp).toBe(true);
    expect(pwStepUp.data.pendingToken).toBeTruthy();
    expect(pwStepUp.headers.get('set-cookie')).toBeNull();

    const pendingToken = pwStepUp.data.pendingToken as string;
    const backupCode = enroll.data.backupCodes[0] as string;
    const stepUp = await fetchJson<{ verified: boolean; passkeyCount: number; session: unknown }>(
      `${api.baseUrl}/v1/auth/totp/verify`,
      {
        method: 'POST',
        headers: { 'x-forwarded-for': testIp },
        body: { code: backupCode, pendingToken },
      },
    );
    expect(stepUp.status).toBe(200);
    expect(stepUp.data.verified).toBe(true);
    expect(stepUp.data.passkeyCount).toBe(0);
    const stepUpSession = AuthSessionSchema.parse(stepUp.data.session);
    createdSessionIds.push(stepUpSession.sessionId);

    // Reusing the same single-use backup code must fail with 401
    const replay = await fetchJson<AuthErrorPayload>(`${api.baseUrl}/v1/auth/totp/verify`, {
      method: 'POST',
      headers: { 'x-forwarded-for': testIp },
      body: { code: backupCode, pendingToken },
    });
    expect(replay.status).toBe(401);

    const disable = await fetchJson<{ disabled: boolean }>(`${api.baseUrl}/v1/auth/totp/disable`, {
      method: 'POST',
      headers: { cookie: adminCookie },
    });
    expect(disable.status).toBe(200);
    expect(disable.data.disabled).toBe(true);
  });

  it('returns 404 for unknown routes', async () => {
    const response = await fetch(`${api.baseUrl}/v1/auth/does-not-exist`);
    expect(response.status).toBe(404);
  });
});
