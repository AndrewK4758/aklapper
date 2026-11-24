import { computeTotpCode } from '@aklapper/node-runtime/auth';
import { vi } from 'vitest';

type QueryFn = (...args: never[]) => Promise<unknown>;

const queryMocks = vi.hoisted(() => ({
  findOrCreateAdminUser: vi.fn<QueryFn>(),
  getUserById: vi.fn<QueryFn>(),
  findAdminUser: vi.fn<QueryFn>(),
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

vi.mock('../src/queries.ts', () => queryMocks);

import { handleAnalyticsIngestRequest } from '../src/analytics-bff.ts';
import {
  dispatchAuthAction,
  handleAdminAuthBffRequest,
  resolveAdminSessionFromRequest,
} from '../src/auth-service.ts';
import type { AppDatabase } from '../src/client.ts';

const FAKE_DB = {} as unknown as AppDatabase;
const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  ADMIN_BOOTSTRAP_TOKEN: 'bootstrap-secret-123',
  INTERNAL_AUTH_SECRET: 'internal-hmac-secret-123',
  TOTP_ENCRYPTION_KEY: 'totp-aes-key-secret-123',
  WEBAUTHN_RP_ID: 'localhost',
  WEBAUTHN_ORIGIN: 'http://localhost:4301',
};

describe('@aklapper/db auth & analytics BFF services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('guards passkey registration options with bootstrap token or admin session', async () => {
    const denied = await dispatchAuthAction(
      { method: 'POST', action: 'passkey/register/options', body: { handle: 'admin' } },
      { db: FAKE_DB, env: TEST_ENV },
    );
    expect(denied.status).toBe(401);

    const adminUser = {
      id: '22222222-2222-4222-8222-222222222222',
      handle: 'admin',
      role: 'admin' as const,
      createdAt: new Date(),
    };
    queryMocks.findOrCreateAdminUser.mockResolvedValueOnce(adminUser);
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
        bootstrapTokenHeader: TEST_ENV['ADMIN_BOOTSTRAP_TOKEN'],
        body: { handle: 'admin' },
      },
      { db: FAKE_DB, env: TEST_ENV },
    );

    expect(allowed.status).toBe(200);
    expect(allowed.body['challengeId']).toBe('33333333-3333-4333-8333-333333333333');
    expect(allowed.body['options']).toBeDefined();
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
