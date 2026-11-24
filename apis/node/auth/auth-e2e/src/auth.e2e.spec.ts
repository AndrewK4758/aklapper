import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { AuthSessionSchema, AuthSessionStatusSchema } from '@aklapper/core';
import { createAuthSession, createDb, createDbPool, findOrCreateAdminUser } from '@aklapper/db';
import { computeTotpCode } from '@aklapper/node-runtime/auth';
import { loadWorkspaceEnv } from '@aklapper/node-runtime/env';
import { signInternalAuthToken } from '@aklapper/node-runtime/http';
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

interface PasskeyOptionsPayload {
  challengeId: string;
  options: {
    challenge: string;
    rp?: { id: string; name: string };
    rpId?: string;
  };
}

interface TotpEnrollPayload {
  secret: string;
  otpauthUrl: string;
  backupCodes: string[];
}

const BOOTSTRAP_TOKEN = `e2e-boot-${randomUUID()}`;
const INTERNAL_SECRET = `e2e-internal-${randomUUID()}`;
const TOTP_KEY = `e2e-totp-key-${randomUUID()}`;

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

  beforeAll(async () => {
    loadWorkspaceEnv({ startDir: import.meta.dirname, mode: 'e2e' });
    const authDir = resolve(import.meta.dirname, '../../auth');
    api = await startNodeApiProcess({
      cwd: authDir,
      entryPath: 'src/main.ts',
      env: {
        ADMIN_BOOTSTRAP_TOKEN: BOOTSTRAP_TOKEN,
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
      methods: ['passkey', 'totp-2fa', 'guest'],
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

  it('enforces bootstrap auth for passkey registration options and persists challenges in PG19', async () => {
    const handle = `e2e-admin-${randomUUID().slice(0, 8)}`;
    createdUserHandles.push(handle);

    const denied = await fetchJson<AuthErrorPayload>(
      `${api.baseUrl}/v1/auth/passkey/register/options`,
      {
        method: 'POST',
        body: { handle },
      },
    );
    expect(denied.status).toBe(401);
    expect(denied.data.error).toBe('UNAUTHORIZED');

    const regOpts = await fetchJson<PasskeyOptionsPayload>(
      `${api.baseUrl}/v1/auth/passkey/register/options`,
      {
        method: 'POST',
        headers: { 'x-bootstrap-token': BOOTSTRAP_TOKEN },
        body: { handle },
      },
    );
    expect(regOpts.status).toBe(200);
    expect(regOpts.data.challengeId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(regOpts.data.options.challenge.length).toBeGreaterThan(10);
    createdChallengeIds.push(regOpts.data.challengeId);

    const loginOpts = await fetchJson<PasskeyOptionsPayload>(
      `${api.baseUrl}/v1/auth/passkey/login/options`,
      {
        method: 'POST',
        body: { handle },
      },
    );
    expect(loginOpts.status).toBe(200);
    expect(loginOpts.data.challengeId).toMatch(/^[0-9a-f-]{36}$/i);
    createdChallengeIds.push(loginOpts.data.challengeId);

    const pool = createDbPool();
    try {
      const result = await pool.query<{ kind: string }>(
        'SELECT kind FROM webauthn_challenges WHERE id = ANY($1::uuid[]) ORDER BY kind ASC',
        [[regOpts.data.challengeId, loginOpts.data.challengeId]],
      );
      expect(result.rows.map(r => r.kind)).toEqual(['login', 'register']);
    } finally {
      await pool.end();
    }
  });

  it('supports TOTP 2FA enroll, verify, step-up backup code login, and disable in PG19', async () => {
    const handle = `e2e-totp-${randomUUID().slice(0, 8)}`;
    createdUserHandles.push(handle);

    const pool = createDbPool();
    const db = createDb(pool);
    let adminCookie = '';
    let userId = '';
    try {
      const user = await findOrCreateAdminUser(db, handle);
      userId = user.id;
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
        headers: { cookie: adminCookie },
        body: { code: liveCode },
      },
    );
    expect(verify.status).toBe(200);
    expect(verify.data).toEqual({ verified: true, enabled: true });

    const status = await fetchJson<unknown>(`${api.baseUrl}/v1/auth/session`, {
      headers: { cookie: adminCookie },
    });
    expect(AuthSessionStatusSchema.parse(status.data).totpEnabled).toBe(true);

    // Step-up login verification using signed pendingToken + single-use backup code
    const pendingToken = signInternalAuthToken({
      role: 'service',
      subject: `totp-pending:${userId}`,
      secret: INTERNAL_SECRET,
      ttlSeconds: 120,
    });
    const backupCode = enroll.data.backupCodes[0] as string;
    const stepUp = await fetchJson<{ verified: boolean; session: unknown }>(
      `${api.baseUrl}/v1/auth/totp/verify`,
      {
        method: 'POST',
        body: { code: backupCode, pendingToken },
      },
    );
    expect(stepUp.status).toBe(200);
    expect(stepUp.data.verified).toBe(true);
    const stepUpSession = AuthSessionSchema.parse(stepUp.data.session);
    createdSessionIds.push(stepUpSession.sessionId);

    // Reusing the same single-use backup code must fail with 401
    const replay = await fetchJson<AuthErrorPayload>(`${api.baseUrl}/v1/auth/totp/verify`, {
      method: 'POST',
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
