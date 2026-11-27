import { createHash } from 'node:crypto';

import { computeTotpCode, hashBackupCode, hashPasswordArgon2id } from '@aklapper/node-runtime/auth';
import { vi } from 'vitest';

type QueryFn = (...args: never[]) => Promise<unknown>;
type VerifyAuthFn = typeof import('@simplewebauthn/server').verifyAuthenticationResponse;

const verifyAuthenticationResponseMock = vi.hoisted(() =>
  vi.fn<(...args: Parameters<VerifyAuthFn>) => ReturnType<VerifyAuthFn>>(),
);

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
vi.mock('@simplewebauthn/server', async importOriginal => {
  const actual = await importOriginal<typeof import('@simplewebauthn/server')>();
  verifyAuthenticationResponseMock.mockImplementation((...args) =>
    actual.verifyAuthenticationResponse(...args),
  );
  return {
    ...actual,
    verifyAuthenticationResponse: verifyAuthenticationResponseMock,
  };
});

import { handleAnalyticsIngestRequest } from '../src/analytics-bff.ts';
import {
  dispatchAuthAction,
  handleAdminAuthBffRequest,
  resolveAdminSessionFromRequest,
} from '../src/auth-service.ts';
import { type AppDatabase, closeSharedDb } from '../src/client.ts';
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

  it('enforces PG19 rate limiting with Retry-After directly in the Admin auth BFF', async () => {
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

  it('requires atomic consumeTotpBackupCode confirmation for both pendingToken TOTP step-up and passkey login verification', async () => {
    const adminSessionId = '44444444-4444-4444-8444-444444444444';
    const userId = '55555555-5555-4555-8555-555555555555';
    const adminSession = {
      sessionId: adminSessionId,
      role: 'admin' as const,
      handle: 'admin',
      expiresAt: '2026-12-01T00:00:00.000Z',
    };

    queryMocks.getValidAuthSession.mockResolvedValueOnce({
      session: adminSession,
      userId,
      totpEnabled: false,
      passkeyCount: 1,
    });
    let storedEncryptedSecret = '';
    let storedBackupHashes: string[] = [];
    queryMocks.upsertUserTotpSecret.mockImplementationOnce(
      async (_db: unknown, input: { encryptedSecret: string; backupCodesHash: string[] }) => {
        storedEncryptedSecret = input.encryptedSecret;
        storedBackupHashes = input.backupCodesHash;
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
    const backupCodes = enroll.body['backupCodes'] as string[];
    expect(backupCodes).toHaveLength(8);
    const firstCode = backupCodes[0]!;
    const secondCode = backupCodes[1]!;
    const firstHash = hashBackupCode(firstCode);
    const secondHash = hashBackupCode(secondCode);

    queryMocks.findAdminUserForPasswordLogin.mockResolvedValueOnce({
      id: userId,
      handle: 'admin',
      role: 'admin' as const,
      passwordHashArgon2: await hashPasswordArgon2id('backup-step-up-pass'),
      createdAt: new Date(),
    });
    queryMocks.getUserTotpSecret.mockResolvedValue({
      userId,
      encryptedSecret: storedEncryptedSecret,
      backupCodesHash: storedBackupHashes,
      enabled: true,
    });
    const loginPending = await dispatchAuthAction(
      {
        method: 'POST',
        action: 'password/login',
        clientIp: '198.51.100.18',
        body: { handle: 'admin', password: 'backup-step-up-pass' },
      },
      { db: FAKE_DB, env: TEST_ENV },
    );
    const pendingToken = String(loginPending.body['pendingToken']);

    queryMocks.getUserById.mockResolvedValue({
      id: userId,
      handle: 'admin',
      role: 'admin' as const,
      createdAt: new Date(),
    });

    // Step-up accepts normalized backup code only when atomic consumption returns true
    queryMocks.consumeTotpBackupCode.mockResolvedValueOnce(true);
    queryMocks.createAuthSession.mockResolvedValueOnce(adminSession);
    queryMocks.countUserWebauthnCredentials.mockResolvedValueOnce(1);

    const stepUpWinner = await dispatchAuthAction(
      {
        method: 'POST',
        action: 'totp/verify',
        clientIp: '198.51.100.18',
        isSecure: true,
        body: { code: firstCode.toLowerCase().replace('-', ''), pendingToken },
      },
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(stepUpWinner.status).toBe(200);
    expect(stepUpWinner.body).toEqual({
      verified: true,
      passkeyCount: 1,
      session: adminSession,
    });
    expect(stepUpWinner.cookies?.[0]).toContain(`ak_admin_session=${adminSessionId}`);
    expect(queryMocks.consumeTotpBackupCode).toHaveBeenCalledWith(FAKE_DB, userId, firstHash);

    // Concurrent loser reading pre-consumption snapshot gets false from consumeTotpBackupCode -> 401
    queryMocks.consumeTotpBackupCode.mockResolvedValueOnce(false);
    const stepUpLoser = await dispatchAuthAction(
      {
        method: 'POST',
        action: 'totp/verify',
        clientIp: '198.51.100.19',
        body: { code: firstCode, pendingToken },
      },
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(stepUpLoser.status).toBe(401);
    expect(stepUpLoser.body).toEqual({
      error: 'INVALID_TOTP_CODE',
      message: 'Invalid TOTP or backup code',
    });
    expect(stepUpLoser.cookies).toBeUndefined();
    expect(queryMocks.createAuthSession).toHaveBeenCalledTimes(1);

    // Unmatched backup code fails closed without hitting consumeTotpBackupCode
    queryMocks.consumeTotpBackupCode.mockClear();
    const unknownCode = await dispatchAuthAction(
      {
        method: 'POST',
        action: 'totp/verify',
        clientIp: '198.51.100.20',
        body: { code: '0000-0000', pendingToken },
      },
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(unknownCode.status).toBe(401);
    expect(unknownCode.cookies).toBeUndefined();
    expect(queryMocks.consumeTotpBackupCode).not.toHaveBeenCalled();

    // Passkey login verification also enforces atomic consumeTotpBackupCode result
    const challengePayload = {
      id: '99999999-9999-4999-8999-999999999999',
      challenge: 'passkey-chal',
      userId,
      kind: 'login' as const,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: new Date(),
      createdAt: new Date(),
    };
    const storedCredential = {
      credentialId: 'cred-backup-1',
      userId,
      publicKey: 'AAAA',
      counter: 0,
      transports: [],
      createdAt: new Date(),
    };
    queryMocks.consumeWebauthnChallenge.mockResolvedValue(challengePayload);
    queryMocks.getWebauthnCredentialById.mockResolvedValue(storedCredential);
    const verifiedAssertion = {
      verified: true,
      authenticationInfo: {
        credentialID: 'cred-backup-1',
        newCounter: 1,
        userVerified: true,
        credentialDeviceType: 'singleDevice' as const,
        credentialBackedUp: false,
        origin: 'http://localhost:4301',
        rpID: 'localhost',
      },
    };
    verifyAuthenticationResponseMock
      .mockResolvedValueOnce(verifiedAssertion)
      .mockResolvedValueOnce(verifiedAssertion);
    queryMocks.consumeTotpBackupCode.mockResolvedValueOnce(true);
    queryMocks.createAuthSession.mockResolvedValueOnce(adminSession);

    const passkeyWinner = await dispatchAuthAction(
      {
        method: 'POST',
        action: 'passkey/login/verify',
        clientIp: '198.51.100.21',
        body: {
          challengeId: challengePayload.id,
          response: { id: 'cred-backup-1' },
          totpCode: secondCode,
        },
      },
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(passkeyWinner.status).toBe(200);
    expect(passkeyWinner.body['verified']).toBe(true);
    expect(passkeyWinner.cookies?.[0]).toContain(`ak_admin_session=${adminSessionId}`);
    expect(queryMocks.consumeTotpBackupCode).toHaveBeenCalledWith(FAKE_DB, userId, secondHash);

    queryMocks.consumeTotpBackupCode.mockResolvedValueOnce(false);
    const passkeyLoser = await dispatchAuthAction(
      {
        method: 'POST',
        action: 'passkey/login/verify',
        clientIp: '198.51.100.22',
        body: {
          challengeId: challengePayload.id,
          response: { id: 'cred-backup-1' },
          totpCode: secondCode,
        },
      },
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(passkeyLoser.status).toBe(401);
    expect(passkeyLoser.body).toEqual({
      error: 'INVALID_TOTP_CODE',
      message: 'Invalid TOTP or backup code',
    });
    expect(passkeyLoser.cookies).toBeUndefined();
    expect(queryMocks.createAuthSession).toHaveBeenCalledTimes(2);
  });

  it('executes Admin auth BFF and session resolution directly against PG19 even if legacy AUTH_API_URL is set', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      const hash = await hashPasswordArgon2id('direct-pg-secret');
      const adminSession = {
        sessionId: '66666666-6666-4666-8666-666666666666',
        role: 'admin' as const,
        handle: 'admin',
        expiresAt: '2026-12-01T00:00:00.000Z',
      };
      queryMocks.findAdminUserForPasswordLogin.mockResolvedValueOnce({
        id: '22222222-2222-4222-8222-222222222222',
        handle: 'admin',
        role: 'admin' as const,
        passwordHashArgon2: hash,
        createdAt: new Date(),
      });
      queryMocks.getUserTotpSecret.mockResolvedValueOnce(null);
      queryMocks.createAuthSession.mockResolvedValueOnce(adminSession);
      queryMocks.countUserWebauthnCredentials.mockResolvedValueOnce(1);

      const legacyEnv = { ...TEST_ENV, AUTH_API_URL: 'http://127.0.0.1:1' };
      const loginRes = await handleAdminAuthBffRequest(
        new Request('https://admin.andrew-k.us/api/auth/password/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ handle: 'admin', password: 'direct-pg-secret' }),
        }),
        'password/login',
        { db: FAKE_DB, env: legacyEnv },
      );

      expect(loginRes.status).toBe(200);
      expect(loginRes.headers.get('set-cookie')).toContain(
        `ak_admin_session=${adminSession.sessionId}`,
      );
      expect(loginRes.headers.get('set-cookie')).toContain('HttpOnly');

      queryMocks.getValidAuthSession.mockResolvedValueOnce({
        session: adminSession,
        userId: '22222222-2222-4222-8222-222222222222',
        totpEnabled: false,
        passkeyCount: 1,
      });

      const resolved = await resolveAdminSessionFromRequest(
        new Request('https://admin.andrew-k.us/ops', {
          headers: { cookie: `ak_admin_session=${adminSession.sessionId}` },
        }),
        { db: FAKE_DB, env: legacyEnv },
      );
      expect(resolved.authenticated).toBe(true);
      expect(resolved.session?.role).toBe('admin');
      expect(fetchSpy).not.toHaveBeenCalled();

      const unauthStatus = await resolveAdminSessionFromRequest(
        new Request('http://localhost:4301/analytics'),
        { db: FAKE_DB, env: legacyEnv },
      );
      expect(unauthStatus.authenticated).toBe(false);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('uses rightmost client IP for rate-limit keys and rejects traversal splats without touching PostgreSQL', async () => {
    queryMocks.consumeAuthRateLimit.mockClear();
    queryMocks.findAdminUserForPasswordLogin.mockResolvedValue(null);

    await dispatchAuthAction(
      {
        method: 'POST',
        action: 'password/login',
        clientIp: '10.0.0.1, 203.0.113.45',
        body: { handle: 'admin', password: 'wrong' },
      },
      { db: FAKE_DB, env: TEST_ENV },
    );
    await dispatchAuthAction(
      {
        method: 'POST',
        action: 'password/login',
        clientIp: '10.0.0.2, 203.0.113.45',
        body: { handle: 'admin', password: 'wrong' },
      },
      { db: FAKE_DB, env: TEST_ENV },
    );

    const expectedIpKey = `auth:login:ip:${createHash('sha256').update('203.0.113.45', 'utf8').digest('hex')}`;
    const ipCalls = queryMocks.consumeAuthRateLimit.mock.calls.filter(call =>
      String(call[1]).startsWith('auth:login:ip:'),
    );
    expect(ipCalls.map(call => call[1])).toEqual([expectedIpKey, expectedIpKey]);

    const callsBeforeTraversal = queryMocks.consumeAuthRateLimit.mock.calls.length;
    const traversal = await handleAdminAuthBffRequest(
      new Request('http://localhost:4301/api/auth/../session'),
      '../session',
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(traversal.status).toBe(400);
    expect(await traversal.json()).toMatchObject({ error: 'INVALID_REQUEST' });

    const encodedTraversal = await handleAdminAuthBffRequest(
      new Request('http://localhost:4301/api/auth/password/%2e%2e/session'),
      'password/%2e%2e/session',
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(encodedTraversal.status).toBe(400);

    const encodedSlashTraversal = await handleAdminAuthBffRequest(
      new Request('http://localhost:4301/api/auth/..%2Fsession'),
      '..%2Fsession',
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(encodedSlashTraversal.status).toBe(400);
    expect(await encodedSlashTraversal.json()).toMatchObject({ error: 'INVALID_REQUEST' });

    const doubleEncodedAuth = await handleAdminAuthBffRequest(
      new Request('http://localhost:4301/api/auth/password%252Flogin'),
      'password%252Flogin',
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(doubleEncodedAuth.status).toBe(400);
    expect(queryMocks.consumeAuthRateLimit.mock.calls.length).toBe(callsBeforeTraversal);
  });

  it('handles same-origin analytics ingest BFF directly against PG19 even if legacy ANALYTICS_API_URL is set', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      const legacyEnv = { ...TEST_ENV, ANALYTICS_API_URL: 'http://127.0.0.1:1' };
      const invalidMethod = await handleAnalyticsIngestRequest(
        new Request('http://localhost:4300/api/analytics/ingest', { method: 'GET' }),
        { db: FAKE_DB, env: legacyEnv },
      );
      expect(invalidMethod.status).toBe(405);
      expect(await invalidMethod.json()).toEqual({ error: 'METHOD_NOT_ALLOWED' });

      const invalidJson = await handleAnalyticsIngestRequest(
        new Request('http://localhost:4300/api/analytics/ingest', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{not-json',
        }),
        { db: FAKE_DB, env: legacyEnv },
      );
      expect(invalidJson.status).toBe(400);
      expect(await invalidJson.json()).toEqual({ error: 'INVALID_ANALYTICS_BATCH' });

      const invalidPayload = await handleAnalyticsIngestRequest(
        new Request('http://localhost:4300/api/analytics/ingest', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId: 's1', events: [] }),
        }),
        { db: FAKE_DB, env: legacyEnv },
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
        { db: FAKE_DB, env: legacyEnv },
      );
      expect(direct.status).toBe(202);
      expect(queryMocks.ingestAnalyticsBatch).toHaveBeenCalledWith(
        FAKE_DB,
        expect.objectContaining({ sessionId: 'sess-1' }),
        expect.objectContaining({
          app: 'portal',
          country: 'US',
          region: 'GA',
          ipHash: expect.any(String),
          visitorHash: expect.stringMatching(/^[a-f0-9]{32}$/),
        }),
      );
      expect(fetchSpy).not.toHaveBeenCalled();

      // Server-authoritative app ignores client spoofed metadata.app and normalizes attribution/bots
      queryMocks.ingestAnalyticsBatch.mockResolvedValueOnce({
        accepted: 1,
        sessionId: 'sess-admin-1',
        ipHash: 'b'.repeat(24),
      });
      const adminRes = await handleAnalyticsIngestRequest(
        new Request('https://admin.andrew-k.us/api/analytics/ingest', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-forwarded-for': '198.51.100.42',
            'user-agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130.0.0.0 Safari/537.36',
          },
          body: JSON.stringify({
            sessionId: 'sess-client-spoof',
            referrer: 'https://www.linkedin.com/feed/update/123?secret=tok',
            landingPath: '/about',
            refParam: 'recruiter',
            utmCampaign: 'c'.repeat(200),
            events: [
              {
                type: 'page_view',
                name: 'portal_page_view',
                path: '/about',
                metadata: { app: 'portal', navigation: 'initial' },
                timestamp: '2026-11-27T12:00:00.000Z',
              },
            ],
          }),
        }),
        { db: FAKE_DB, env: legacyEnv, app: 'admin', guestSessionId: 'guest_sess_123' },
      );
      expect(adminRes.status).toBe(202);
      expect(await adminRes.json()).toEqual({
        accepted: 1,
        sessionId: 'sess-admin-1',
        ipHash: 'b'.repeat(24),
      });
      expect(queryMocks.ingestAnalyticsBatch).toHaveBeenLastCalledWith(
        FAKE_DB,
        expect.objectContaining({ sessionId: 'sess-client-spoof' }),
        expect.objectContaining({
          app: 'admin',
          isBot: false,
          guestSessionId: 'guest_sess_123',
          referrer: 'https://www.linkedin.com/feed/update/123',
          referrerHost: 'linkedin.com',
          referrerCategory: 'social',
          landingPath: '/about',
          refParam: 'recruiter',
          utmCampaign: 'c'.repeat(120),
          deviceType: 'desktop',
          osName: 'macOS',
          browserName: 'Chrome',
        }),
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('returns unauthenticated status for cookie-less and unrelated-cookie requests without requiring DATABASE_URL', async () => {
    await closeSharedDb();
    const prevDatabaseUrl = process.env['DATABASE_URL'];
    delete process.env['DATABASE_URL'];
    try {
      const noCookieStatus = await resolveAdminSessionFromRequest(
        new Request('http://localhost:4301/analytics'),
        { env: { NODE_ENV: 'test' } },
      );
      expect(noCookieStatus).toEqual({
        authenticated: false,
        session: null,
        totpEnabled: false,
        passkeyCount: 0,
      });

      const unrelatedCookieStatus = await resolveAdminSessionFromRequest(
        new Request('http://localhost:4301/analytics', {
          headers: { cookie: 'ak_guest_sid=guest-123; theme=solar-forge' },
        }),
        { env: { NODE_ENV: 'test' } },
      );
      expect(unrelatedCookieStatus).toEqual({
        authenticated: false,
        session: null,
        totpEnabled: false,
        passkeyCount: 0,
      });
    } finally {
      if (prevDatabaseUrl !== undefined) {
        process.env['DATABASE_URL'] = prevDatabaseUrl;
      }
    }
  });
});
