import { computeTotpCode, hashPasswordArgon2id } from '@aklapper/node-runtime/auth';
import { vi } from 'vitest';

type QueryFn = (...args: never[]) => Promise<unknown>;

const queryMocks = vi.hoisted(() => ({
  findOrCreateAdminUser: vi.fn<QueryFn>(),
  getUserById: vi.fn<QueryFn>(),
  findAdminUser: vi.fn<QueryFn>(),
  findAdminUserForPasswordLogin: vi.fn<QueryFn>(),
  upsertAdminUserPassword: vi.fn<QueryFn>(),
  countUserWebauthnCredentials: vi.fn<QueryFn>(),
  consumeAuthRateLimit: vi.fn<QueryFn>(),
  createAuthSession: vi.fn<QueryFn>(),
  getValidAuthSession: vi.fn<QueryFn>(),
  revokeAuthSession: vi.fn<QueryFn>(),
  createWebauthnChallenge: vi.fn<QueryFn>(),
  consumeWebauthnChallenge: vi.fn<QueryFn>(),
  listUserWebauthnCredentials: vi.fn<QueryFn>(),
  getWebauthnCredentialById: vi.fn<QueryFn>(),
  saveWebauthnCredential: vi.fn<QueryFn>(),
  updateWebauthnCredentialCounter: vi.fn<QueryFn>(),
  getUserTotpSecret: vi.fn<QueryFn>(),
  upsertUserTotpSecret:
    vi.fn<
      (
        db: unknown,
        input: { encryptedSecret: string; backupCodesHash: string[] },
      ) => Promise<unknown>
    >(),
  enableUserTotpSecret: vi.fn<QueryFn>(),
  consumeTotpBackupCode: vi.fn<QueryFn>(),
  disableUserTotpSecret: vi.fn<QueryFn>(),
  ingestAnalyticsBatch: vi.fn<QueryFn>(),
}));

vi.mock('../src/queries.ts', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/queries.ts')>();
  return {
    ...actual,
    ...queryMocks,
  };
});
vi.mock('../src/auth-queries.ts', () => ({
  findAdminUserForPasswordLogin: queryMocks.findAdminUserForPasswordLogin,
  upsertAdminUserPassword: queryMocks.upsertAdminUserPassword,
  countUserWebauthnCredentials: queryMocks.countUserWebauthnCredentials,
}));

import { handleAnalyticsIngestRequest } from '../src/analytics-bff.ts';
import {
  dispatchAuthAction,
  handleAdminAuthBffRequest,
  resolveAdminSessionFromRequest,
} from '../src/auth-service.ts';
import type { AppDatabase } from '../src/client.ts';
import { seedAdminUserFromEnv } from '../src/seed.ts';

const FAKE_DB = {} as unknown as AppDatabase;
const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  INTERNAL_AUTH_SECRET: 'internal-hmac-secret-123',
  TOTP_ENCRYPTION_KEY: 'totp-aes-key-secret-123',
  WEBAUTHN_RP_ID: 'localhost',
  WEBAUTHN_ORIGIN: 'http://localhost:4301',
};

describe('@aklapper/db auth & analytics BFF services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMocks.consumeAuthRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 19,
      retryAfterSeconds: 60,
    });
  });

  it('issues guest sessions with HttpOnly cookie and checks session status', async () => {
    const guestSession = {
      sessionId: '11111111-1111-4111-8111-111111111111',
      role: 'guest' as const,
      handle: 'guest',
      expiresAt: '2026-12-01T00:00:00.000Z',
    };
    queryMocks.createAuthSession.mockResolvedValueOnce(guestSession);

    const created = await dispatchAuthAction(
      { method: 'POST', action: 'guest', isSecure: false },
      { db: FAKE_DB, env: TEST_ENV },
    );

    expect(created.status).toBe(201);
    expect(created.body).toEqual(guestSession);
    expect(created.cookies?.[0]).toContain(`ak_guest_session=${guestSession.sessionId}`);
    expect(created.cookies?.[0]).toContain('HttpOnly');

    const unauth = await dispatchAuthAction(
      { method: 'GET', action: 'session', cookieHeader: null },
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(unauth.status).toBe(200);
    expect(unauth.body).toEqual({
      authenticated: false,
      session: null,
      totpEnabled: false,
      passkeyCount: 0,
    });
  });

  it('requires valid admin session for passkey registration options and sets residentKey required', async () => {
    const events: Array<{ event: string }> = [];
    const denied = await dispatchAuthAction(
      { method: 'POST', action: 'passkey/register/options', body: { handle: 'admin' } },
      { db: FAKE_DB, env: TEST_ENV, onAuthEvent: evt => events.push(evt) },
    );
    expect(denied.status).toBe(401);
    expect(events.some(e => e.event === 'auth.passkey_register.unauthenticated')).toBe(true);

    const adminUser = {
      id: '22222222-2222-4222-8222-222222222222',
      handle: 'admin',
      role: 'admin' as const,
      createdAt: new Date(),
    };
    queryMocks.getValidAuthSession.mockResolvedValueOnce({
      session: {
        sessionId: '44444444-4444-4444-8444-444444444444',
        role: 'admin' as const,
        handle: 'admin',
        expiresAt: '2026-12-01T00:00:00.000Z',
      },
      userId: adminUser.id,
      totpEnabled: false,
      passkeyCount: 0,
    });
    queryMocks.getUserById.mockResolvedValueOnce(adminUser);
    queryMocks.listUserWebauthnCredentials.mockResolvedValueOnce([]);
    queryMocks.createWebauthnChallenge.mockResolvedValueOnce({
      id: '33333333-3333-4333-8333-333333333333',
      challenge: 'mock-challenge',
      userId: adminUser.id,
      kind: 'register',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      createdAt: new Date(),
    });

    const allowed = await dispatchAuthAction(
      {
        method: 'POST',
        action: 'passkey/register/options',
        cookieHeader: 'ak_admin_session=44444444-4444-4444-8444-444444444444',
        body: {},
      },
      { db: FAKE_DB, env: TEST_ENV },
    );

    expect(allowed.status).toBe(200);
    expect(allowed.body['challengeId']).toBe('33333333-3333-4333-8333-333333333333');
    expect(
      (allowed.body['options'] as { authenticatorSelection?: { residentKey?: string } })
        .authenticatorSelection?.residentKey,
    ).toBe('required');
    expect(queryMocks.findOrCreateAdminUser).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated and cross-user passkey registration verify without consuming unauth challenges', async () => {
    const unauth = await dispatchAuthAction(
      {
        method: 'POST',
        action: 'passkey/register/verify',
        body: { challengeId: '33333333-3333-4333-8333-333333333333', response: {} },
      },
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(unauth.status).toBe(401);
    expect(queryMocks.consumeWebauthnChallenge).not.toHaveBeenCalled();

    queryMocks.getValidAuthSession.mockResolvedValueOnce({
      session: {
        sessionId: '44444444-4444-4444-8444-444444444444',
        role: 'admin' as const,
        handle: 'admin-b',
        expiresAt: '2026-12-01T00:00:00.000Z',
      },
      userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      totpEnabled: false,
      passkeyCount: 0,
    });
    queryMocks.consumeWebauthnChallenge.mockResolvedValueOnce({
      id: '33333333-3333-4333-8333-333333333333',
      challenge: 'mock-challenge',
      userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      kind: 'register',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: new Date(),
      createdAt: new Date(),
    });

    const mismatch = await dispatchAuthAction(
      {
        method: 'POST',
        action: 'passkey/register/verify',
        cookieHeader: 'ak_admin_session=44444444-4444-4444-8444-444444444444',
        body: { challengeId: '33333333-3333-4333-8333-333333333333', response: {} },
      },
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(mismatch.status).toBe(403);
    expect(queryMocks.saveWebauthnCredential).not.toHaveBeenCalled();
  });

  it('authenticates admin password login, enforces TOTP step-up with passkeyCount, and fails closed on bad credentials or missing prod secret', async () => {
    const hash = await hashPasswordArgon2id('correct-horse-battery-staple');
    const adminUser = {
      id: '22222222-2222-4222-8222-222222222222',
      handle: 'admin',
      role: 'admin' as const,
      passwordHashArgon2: hash,
      createdAt: new Date(),
    };
    const adminSession = {
      sessionId: '77777777-7777-4777-8777-777777777777',
      role: 'admin' as const,
      handle: 'admin',
      expiresAt: '2026-12-01T00:00:00.000Z',
    };

    queryMocks.findAdminUserForPasswordLogin.mockResolvedValueOnce(adminUser);
    queryMocks.getUserTotpSecret.mockResolvedValueOnce(null);
    queryMocks.createAuthSession.mockResolvedValueOnce(adminSession);
    queryMocks.countUserWebauthnCredentials.mockResolvedValueOnce(0);

    const okLogin = await dispatchAuthAction(
      {
        method: 'POST',
        action: 'password/login',
        clientIp: '198.51.100.1',
        isSecure: true,
        body: { handle: 'ADMIN', password: 'correct-horse-battery-staple' },
      },
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(okLogin.status).toBe(200);
    expect(okLogin.body).toEqual({
      verified: true,
      requiresTotp: false,
      passkeyCount: 0,
      session: adminSession,
    });
    expect(okLogin.cookies?.[0]).toContain('Secure');
    expect(okLogin.cookies?.[0]).toContain('HttpOnly');

    queryMocks.findAdminUserForPasswordLogin.mockResolvedValueOnce(null);
    const missingUser = await dispatchAuthAction(
      {
        method: 'POST',
        action: 'password/login',
        clientIp: '198.51.100.2',
        body: { handle: 'unknown-admin', password: 'correct-horse-battery-staple' },
      },
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(missingUser.status).toBe(401);
    expect(missingUser.body).toEqual({
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid credentials',
    });

    const events: Array<{ event: string }> = [];
    queryMocks.findAdminUserForPasswordLogin.mockResolvedValueOnce({
      ...adminUser,
      passwordHashArgon2: '$argon2id$v=18$m=1024,t=1,p=1$bad$bad',
    });
    const malformedPhc = await dispatchAuthAction(
      {
        method: 'POST',
        action: 'password/login',
        clientIp: '198.51.100.2',
        body: { handle: 'admin', password: 'correct-horse-battery-staple' },
      },
      { db: FAKE_DB, env: TEST_ENV, onAuthEvent: evt => events.push(evt) },
    );
    expect(malformedPhc.status).toBe(401);
    expect(events.some(e => e.event === 'auth.password_login.phc_invalid')).toBe(true);

    queryMocks.findAdminUserForPasswordLogin.mockResolvedValueOnce(adminUser);
    queryMocks.getUserTotpSecret.mockResolvedValueOnce({
      userId: adminUser.id,
      encryptedSecret: 'unused',
      backupCodesHash: [],
      enabled: true,
    });
    const prodMisconfigured = await dispatchAuthAction(
      {
        method: 'POST',
        action: 'password/login',
        clientIp: '198.51.100.3',
        body: { handle: 'admin', password: 'correct-horse-battery-staple' },
      },
      { db: FAKE_DB, env: { NODE_ENV: 'production' } },
    );
    expect(prodMisconfigured.status).toBe(500);
    expect(prodMisconfigured.body['error']).toBe('AUTH_MISCONFIGURED');
    expect(prodMisconfigured.cookies).toBeUndefined();

    queryMocks.findAdminUserForPasswordLogin.mockResolvedValueOnce(adminUser);
    queryMocks.getUserTotpSecret.mockResolvedValueOnce({
      userId: adminUser.id,
      encryptedSecret: 'unused',
      backupCodesHash: [],
      enabled: true,
    });
    const totpStepUp = await dispatchAuthAction(
      {
        method: 'POST',
        action: 'password/login',
        clientIp: '198.51.100.4',
        body: { handle: 'admin', password: 'correct-horse-battery-staple' },
      },
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(totpStepUp.status).toBe(200);
    expect(totpStepUp.body['verified']).toBe(false);
    expect(totpStepUp.body['requiresTotp']).toBe(true);
    expect(typeof totpStepUp.body['pendingToken']).toBe('string');
    expect(totpStepUp.cookies).toBeUndefined();

    // Per-user TOTP throttle triggers 429 on pendingToken verification
    queryMocks.consumeAuthRateLimit
      .mockResolvedValueOnce({ allowed: true, remaining: 19, retryAfterSeconds: 60 })
      .mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 120 });
    const userThrottledTotp = await dispatchAuthAction(
      {
        method: 'POST',
        action: 'totp/verify',
        clientIp: '198.51.100.4',
        body: { code: '123456', pendingToken: String(totpStepUp.body['pendingToken']) },
      },
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(userThrottledTotp.status).toBe(429);
    expect(userThrottledTotp.headers?.['retry-after']).toBe('120');

    // Concurrent password logins exceeding Argon2 concurrency cap return 503 with Retry-After
    queryMocks.findAdminUserForPasswordLogin.mockResolvedValue(adminUser);
    queryMocks.getUserTotpSecret.mockResolvedValue(null);
    queryMocks.createAuthSession.mockResolvedValue(adminSession);
    queryMocks.countUserWebauthnCredentials.mockResolvedValue(0);
    const concurrentResults = await Promise.all([
      dispatchAuthAction(
        {
          method: 'POST',
          action: 'password/login',
          clientIp: '198.51.100.5',
          body: { handle: 'admin', password: 'correct-horse-battery-staple' },
        },
        { db: FAKE_DB, env: TEST_ENV },
      ),
      dispatchAuthAction(
        {
          method: 'POST',
          action: 'password/login',
          clientIp: '198.51.100.6',
          body: { handle: 'admin', password: 'correct-horse-battery-staple' },
        },
        { db: FAKE_DB, env: TEST_ENV },
      ),
      dispatchAuthAction(
        {
          method: 'POST',
          action: 'password/login',
          clientIp: '198.51.100.7',
          body: { handle: 'admin', password: 'correct-horse-battery-staple' },
        },
        { db: FAKE_DB, env: TEST_ENV },
      ),
    ]);
    const busyResponse = concurrentResults.find(item => item.status === 503);
    expect(busyResponse).toBeDefined();
    expect(busyResponse?.headers?.['retry-after']).toBe('2');
    expect(busyResponse?.body['error']).toBe('SERVICE_BUSY');
  });

  it('enforces PG19 rate limiting with Retry-After and forwards client IP and forwarded proto across BFF modes', async () => {
    queryMocks.consumeAuthRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 42,
    });

    const directRes = await handleAdminAuthBffRequest(
      new Request('https://admin.andrew-k.us/api/auth/password/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.9',
        },
        body: JSON.stringify({ handle: 'admin', password: 'wrong' }),
      }),
      'password/login',
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(directRes.status).toBe(429);
    expect(directRes.headers.get('retry-after')).toBe('42');
    expect(await directRes.json()).toMatchObject({ statusCode: 429, error: 'RATE_LIMITED' });

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ statusCode: 429, error: 'RATE_LIMITED', message: 'slow down' }),
        {
          status: 429,
          headers: {
            'content-type': 'application/json',
            'retry-after': '17',
          },
        },
      ),
    );

    const proxiedRes = await handleAdminAuthBffRequest(
      new Request('https://admin.andrew-k.us/api/auth/password/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.9',
          'x-bootstrap-token': 'should-be-stripped',
        },
        body: JSON.stringify({ handle: 'admin', password: 'wrong' }),
      }),
      'password/login',
      { authApiUrl: 'http://auth.internal:4101', fetchImpl: fetchMock },
    );
    expect(proxiedRes.status).toBe(429);
    expect(proxiedRes.headers.get('retry-after')).toBe('17');
    const forwardedHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(forwardedHeaders.get('x-forwarded-for')).toBe('198.51.100.9');
    expect(forwardedHeaders.get('x-forwarded-proto')).toBe('https');
    expect(forwardedHeaders.get('x-bootstrap-token')).toBeNull();
  });

  it('omits allowCredentials for discoverable passkey login and restricts production WebAuthn origins', async () => {
    queryMocks.createWebauthnChallenge.mockResolvedValueOnce({
      id: '88888888-8888-4888-8888-888888888888',
      challenge: 'login-chal',
      userId: null,
      kind: 'login',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      createdAt: new Date(),
    });

    const discoverableOpts = await dispatchAuthAction(
      { method: 'POST', action: 'passkey/login/options', body: {} },
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(discoverableOpts.status).toBe(200);
    expect(queryMocks.findAdminUser).not.toHaveBeenCalled();
    expect(
      (discoverableOpts.body['options'] as { allowCredentials?: unknown[] }).allowCredentials,
    ).toEqual([]);

    queryMocks.consumeWebauthnChallenge.mockResolvedValueOnce({
      id: '88888888-8888-4888-8888-888888888888',
      challenge: 'login-chal',
      userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      kind: 'login',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: new Date(),
      createdAt: new Date(),
    });
    queryMocks.getWebauthnCredentialById.mockResolvedValueOnce({
      credentialId: 'cred-b',
      userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      publicKey: 'AAAA',
      counter: 0,
      transports: [],
      createdAt: new Date(),
    });

    const crossUserLogin = await dispatchAuthAction(
      {
        method: 'POST',
        action: 'passkey/login/verify',
        body: { challengeId: '88888888-8888-4888-8888-888888888888', response: { id: 'cred-b' } },
      },
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(crossUserLogin.status).toBe(401);
    expect(crossUserLogin.cookies).toBeUndefined();

    const prodEvents: Array<{ event: string }> = [];
    queryMocks.getValidAuthSession.mockResolvedValueOnce({
      session: {
        sessionId: '44444444-4444-4444-8444-444444444444',
        role: 'admin' as const,
        handle: 'admin',
        expiresAt: '2026-12-01T00:00:00.000Z',
      },
      userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      totpEnabled: false,
      passkeyCount: 0,
    });
    queryMocks.consumeWebauthnChallenge.mockResolvedValueOnce({
      id: '33333333-3333-4333-8333-333333333333',
      challenge: 'mock-challenge',
      userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      kind: 'register',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: new Date(),
      createdAt: new Date(),
    });
    const untrustedOrigin = await dispatchAuthAction(
      {
        method: 'POST',
        action: 'passkey/register/verify',
        cookieHeader: 'ak_admin_session=44444444-4444-4444-8444-444444444444',
        originHeader: 'https://evil.admin.andrew-k.us',
        body: { challengeId: '33333333-3333-4333-8333-333333333333', response: {} },
      },
      {
        db: FAKE_DB,
        env: {
          NODE_ENV: 'production',
          WEBAUTHN_RP_ID: 'admin.andrew-k.us',
          WEBAUTHN_ORIGIN: 'https://admin.andrew-k.us',
          INTERNAL_AUTH_SECRET: 'prod-secret',
          TOTP_ENCRYPTION_KEY: 'prod-totp-key',
        },
        onAuthEvent: evt => prodEvents.push(evt),
      },
    );
    expect(untrustedOrigin.status).toBe(400);
    expect(prodEvents.some(e => e.event === 'auth.webauthn.origin_rejected')).toBe(true);
  });

  it('seeds admin password from env with normalized handle and skips cleanly when password is unset', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const skipped = await seedAdminUserFromEnv(FAKE_DB, { ADMIN_HANDLE: '  Admin  ' });
      expect(skipped).toEqual({ seeded: false, handle: 'admin', action: 'skipped' });
      expect(queryMocks.upsertAdminUserPassword).not.toHaveBeenCalled();

      queryMocks.upsertAdminUserPassword.mockResolvedValueOnce({
        action: 'inserted',
        user: { id: 'u1', handle: 'admin', role: 'admin', createdAt: new Date() },
      });
      const seeded = await seedAdminUserFromEnv(FAKE_DB, {
        ADMIN_HANDLE: '  Admin  ',
        ADMIN_PASSWORD: 'super-secret-admin-passphrase',
      });
      expect(seeded).toEqual({ seeded: true, handle: 'admin', action: 'inserted' });
      expect(queryMocks.upsertAdminUserPassword).toHaveBeenCalledWith(
        FAKE_DB,
        expect.objectContaining({
          handle: 'admin',
          passwordHashArgon2: expect.stringMatching(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/),
        }),
      );
      const loggedText = infoSpy.mock.calls.flat().join(' ');
      expect(loggedText).not.toContain('super-secret-admin-passphrase');
      expect(loggedText).not.toContain('$argon2id$');
    } finally {
      infoSpy.mockRestore();
    }
  });

  it('handles TOTP enroll, verify, disable, and logout lifecycle for admin sessions', async () => {
    const adminSessionId = '44444444-4444-4444-8444-444444444444';
    const userId = '55555555-5555-4555-8555-555555555555';
    const validAdminRecord = {
      session: {
        sessionId: adminSessionId,
        role: 'admin' as const,
        handle: 'admin',
        expiresAt: '2026-12-01T00:00:00.000Z',
      },
      userId,
      totpEnabled: false,
      passkeyCount: 1,
    };

    queryMocks.getValidAuthSession.mockResolvedValue(validAdminRecord);
    let storedEncryptedSecret = '';
    queryMocks.upsertUserTotpSecret.mockImplementation(
      async (_db: unknown, input: { encryptedSecret: string; backupCodesHash: string[] }) => {
        storedEncryptedSecret = input.encryptedSecret;
        return {
          userId,
          encryptedSecret: input.encryptedSecret,
          backupCodesHash: input.backupCodesHash,
          enabled: false,
        };
      },
    );

    const enroll = await dispatchAuthAction(
      {
        method: 'POST',
        action: 'totp/enroll',
        cookieHeader: `ak_admin_session=${adminSessionId}`,
      },
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(enroll.status).toBe(200);
    const secret = enroll.body['secret'] as string;
    expect(secret.length).toBeGreaterThanOrEqual(16);
    expect(enroll.body['otpauthUrl']).toContain('otpauth://totp/');
    expect(enroll.body['backupCodes']).toHaveLength(8);

    queryMocks.getUserTotpSecret.mockResolvedValueOnce({
      userId,
      encryptedSecret: storedEncryptedSecret,
      backupCodesHash: [],
      enabled: false,
    });
    queryMocks.enableUserTotpSecret.mockResolvedValueOnce(true);

    const code = computeTotpCode(secret);
    const verify = await dispatchAuthAction(
      {
        method: 'POST',
        action: 'totp/verify',
        cookieHeader: `ak_admin_session=${adminSessionId}`,
        body: { code },
      },
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(verify.status).toBe(200);
    expect(verify.body).toEqual({ verified: true, enabled: true });

    // Verify step-up with pendingToken also returns passkeyCount and sets session cookie
    queryMocks.findAdminUserForPasswordLogin.mockResolvedValueOnce({
      id: userId,
      handle: 'admin',
      role: 'admin' as const,
      passwordHashArgon2: await hashPasswordArgon2id('step-up-pass'),
      createdAt: new Date(),
    });
    queryMocks.getUserTotpSecret.mockResolvedValue({
      userId,
      encryptedSecret: storedEncryptedSecret,
      backupCodesHash: [],
      enabled: true,
    });
    const loginPending = await dispatchAuthAction(
      {
        method: 'POST',
        action: 'password/login',
        clientIp: '198.51.100.8',
        body: { handle: 'admin', password: 'step-up-pass' },
      },
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(loginPending.body['requiresTotp']).toBe(true);

    queryMocks.getUserById.mockResolvedValueOnce({
      id: userId,
      handle: 'admin',
      role: 'admin' as const,
      createdAt: new Date(),
    });
    queryMocks.createAuthSession.mockResolvedValueOnce(validAdminRecord.session);
    queryMocks.countUserWebauthnCredentials.mockResolvedValueOnce(2);

    const stepUpRes = await dispatchAuthAction(
      {
        method: 'POST',
        action: 'totp/verify',
        clientIp: '198.51.100.8',
        isSecure: true,
        body: { code, pendingToken: String(loginPending.body['pendingToken']) },
      },
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(stepUpRes.status).toBe(200);
    expect(stepUpRes.body).toEqual({
      verified: true,
      passkeyCount: 2,
      session: validAdminRecord.session,
    });
    expect(stepUpRes.cookies?.[0]).toContain('Secure');

    queryMocks.disableUserTotpSecret.mockResolvedValueOnce(true);
    const disable = await dispatchAuthAction(
      {
        method: 'POST',
        action: 'totp/disable',
        cookieHeader: `ak_admin_session=${adminSessionId}`,
      },
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(disable.status).toBe(200);
    expect(disable.body).toEqual({ disabled: true });

    queryMocks.revokeAuthSession.mockResolvedValue(true);
    const logout = await dispatchAuthAction(
      {
        method: 'POST',
        action: 'logout',
        cookieHeader: `ak_admin_session=${adminSessionId}`,
      },
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(logout.status).toBe(200);
    expect(logout.cookies).toHaveLength(2);
    expect(logout.cookies?.[0]).toContain('Max-Age=0');
  });

  it('forwards admin auth BFF requests to AUTH_API_URL when configured and resolves sessions', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          authenticated: true,
          session: {
            sessionId: '66666666-6666-4666-8666-666666666666',
            role: 'admin',
            handle: 'admin',
            expiresAt: '2026-12-01T00:00:00.000Z',
          },
          totpEnabled: false,
          passkeyCount: 1,
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'set-cookie': 'ak_admin_session=abc; Path=/; HttpOnly',
          },
        },
      ),
    );

    const res = await handleAdminAuthBffRequest(
      new Request('http://localhost:4301/api/auth/session', {
        headers: { cookie: 'ak_admin_session=abc' },
      }),
      'session',
      {
        authApiUrl: 'http://auth.internal:4101',
        fetchImpl: fetchMock,
      },
    );

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://auth.internal:4101/v1/auth/session',
      expect.objectContaining({ method: 'GET' }),
    );

    const status = await resolveAdminSessionFromRequest(
      new Request('http://localhost:4301/analytics'),
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(status.authenticated).toBe(false);
  });

  it('handles same-origin analytics ingest BFF for both direct PG persistence and upstream proxy', async () => {
    const invalidMethod = await handleAnalyticsIngestRequest(
      new Request('http://localhost:4300/api/analytics/ingest', { method: 'GET' }),
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(invalidMethod.status).toBe(405);

    const invalidPayload = await handleAnalyticsIngestRequest(
      new Request('http://localhost:4300/api/analytics/ingest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: 's1', events: [] }),
      }),
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(invalidPayload.status).toBe(400);

    queryMocks.ingestAnalyticsBatch.mockResolvedValueOnce({
      accepted: 1,
      sessionId: 'sess-1',
      ipHash: 'a'.repeat(24),
    });

    const batch = {
      sessionId: 'sess-1',
      events: [
        {
          type: 'page_view',
          name: 'portal',
          path: '/',
          timestamp: '2026-11-24T12:00:00.000Z',
        },
      ],
    };

    const direct = await handleAnalyticsIngestRequest(
      new Request('http://localhost:4300/api/analytics/ingest', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.7',
          'x-cloud-country': 'US',
          'x-cloud-region': 'GA',
        },
        body: JSON.stringify(batch),
      }),
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(direct.status).toBe(202);
    expect(queryMocks.ingestAnalyticsBatch).toHaveBeenCalledWith(
      FAKE_DB,
      expect.objectContaining({ sessionId: 'sess-1' }),
      expect.objectContaining({ country: 'US', region: 'GA' }),
    );

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(JSON.stringify({ accepted: 1, sessionId: 'sess-1', ipHash: 'b'.repeat(24) }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const proxied = await handleAnalyticsIngestRequest(
      new Request('http://localhost:4300/api/analytics/ingest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(batch),
      }),
      {
        upstreamUrl: 'http://analytics.internal:4102',
        fetchImpl: fetchMock,
      },
    );
    expect(proxied.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://analytics.internal:4102/v1/analytics/ingest',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
