import { PassThrough } from 'node:stream';

import { createDb, createDbPool } from '@aklapper/db';
import type { AuthDispatchRequest, AuthDispatchResult } from '@aklapper/db/auth';
import { vi } from 'vitest';

import { buildAuthServer } from '../src/server.ts';

describe('node-api-auth', () => {
  it('serves healthz and dispatches password, passkey, TOTP, and guest routes without bootstrap token forwarding', async () => {
    const calls: AuthDispatchRequest[] = [];
    const dispatch = vi.fn<(req: AuthDispatchRequest) => Promise<AuthDispatchResult>>(
      async (req: AuthDispatchRequest): Promise<AuthDispatchResult> => {
        calls.push(req);
        if (req.method === 'POST' && req.action === 'guest') {
          return {
            status: 201,
            body: {
              sessionId: '11111111-1111-4111-8111-111111111111',
              role: 'guest',
              handle: 'guest',
              expiresAt: '2026-12-01T00:00:00.000Z',
            },
            cookies: ['ak_guest_session=11111111-1111-4111-8111-111111111111; Path=/; HttpOnly'],
          };
        }
        if (req.method === 'POST' && req.action === 'password/login') {
          if (req.clientIp === '198.51.100.99') {
            return {
              status: 429,
              headers: { 'retry-after': '33' },
              body: { statusCode: 429, error: 'RATE_LIMITED', message: 'Throttled' },
            };
          }
          return {
            status: 200,
            body: {
              verified: true,
              requiresTotp: false,
              passkeyCount: 0,
              session: {
                sessionId: '22222222-2222-4222-8222-222222222222',
                role: 'admin',
                handle: 'admin',
                expiresAt: '2026-12-01T00:00:00.000Z',
              },
            },
            cookies: [
              'ak_admin_session=22222222-2222-4222-8222-222222222222; Path=/; HttpOnly; Secure',
            ],
          };
        }
        if (req.method === 'POST' && req.action === 'passkey/register/options') {
          if (!req.cookieHeader?.includes('ak_admin_session=')) {
            return { status: 401, body: { error: 'UNAUTHORIZED' } };
          }
          return { status: 200, body: { challengeId: 'chal-1', options: { challenge: 'abc' } } };
        }
        if (req.method === 'GET' && req.action === 'session') {
          return {
            status: 200,
            body: { authenticated: false, session: null, totpEnabled: false, passkeyCount: 0 },
          };
        }
        return { status: 200, body: { ok: true, action: req.action } };
      },
    );

    const logChunks: string[] = [];
    const loggerStream = new PassThrough();
    loggerStream.on('data', chunk => {
      logChunks.push(Buffer.from(chunk).toString('utf8'));
    });

    const app = await buildAuthServer({ dispatch, loggerStream });
    try {
      const health = await app.inject({ method: 'GET', url: '/healthz' });
      expect(health.statusCode).toBe(200);
      expect(health.json()).toEqual({
        status: 'ok',
        service: 'node-api-auth',
        methods: ['password', 'passkey', 'totp-2fa', 'guest'],
      });

      const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest' });
      expect(guest.statusCode).toBe(201);
      expect(guest.json().role).toBe('guest');
      expect(String(guest.headers['set-cookie'])).toContain('ak_guest_session=');

      const passwordLogin = await app.inject({
        method: 'POST',
        url: '/v1/auth/password/login',
        headers: {
          'x-forwarded-for': '198.51.100.10',
          'x-forwarded-proto': 'https',
        },
        payload: { handle: 'admin', password: 'secret' },
      });
      expect(passwordLogin.statusCode).toBe(200);
      expect(passwordLogin.json().passkeyCount).toBe(0);
      expect(String(passwordLogin.headers['set-cookie'])).toContain('ak_admin_session=');

      const retryAfterForward = await app.inject({
        method: 'POST',
        url: '/v1/auth/password/login',
        headers: { 'x-forwarded-for': '198.51.100.99' },
        payload: { handle: 'admin', password: 'wrong' },
      });
      expect(retryAfterForward.statusCode).toBe(429);
      expect(retryAfterForward.headers['retry-after']).toBe('33');

      const deniedBootstrap = await app.inject({
        method: 'POST',
        url: '/v1/auth/passkey/register/options',
        headers: { 'x-bootstrap-token': 'secret-boot', origin: 'http://localhost:4301' },
        payload: { handle: 'admin' },
      });
      expect(deniedBootstrap.statusCode).toBe(401);

      const okReg = await app.inject({
        method: 'POST',
        url: '/v1/auth/passkey/register/options',
        headers: {
          cookie: 'ak_admin_session=22222222-2222-4222-8222-222222222222',
          authorization: 'Bearer sensitive-token',
          'x-internal-auth': 'v1.internal.secret',
          origin: 'http://localhost:4301',
        },
        payload: {},
      });
      expect(okReg.statusCode).toBe(200);
      expect(okReg.json().challengeId).toBe('chal-1');

      const session = await app.inject({ method: 'GET', url: '/v1/auth/session' });
      expect(session.statusCode).toBe(200);
      expect(session.json().authenticated).toBe(false);

      const totpEnroll = await app.inject({ method: 'POST', url: '/v1/auth/totp/enroll' });
      expect(totpEnroll.statusCode).toBe(200);
      expect(totpEnroll.json().action).toBe('totp/enroll');

      const logout = await app.inject({ method: 'POST', url: '/v1/auth/logout' });
      expect(logout.statusCode).toBe(200);
      expect(logout.json().action).toBe('logout');

      expect(calls.some(c => c.originHeader === 'http://localhost:4301')).toBe(true);
      expect(calls.some(c => c.clientIp === '198.51.100.10' && c.isSecure === true)).toBe(true);
    } finally {
      await app.close();
    }

    const rawLogs = logChunks.join('');
    expect(rawLogs).not.toContain('22222222-2222-4222-8222-222222222222');
    expect(rawLogs).not.toContain('sensitive-token');
    expect(rawLogs).not.toContain('v1.internal.secret');
    expect(rawLogs).not.toContain('secret-boot');
  });

  it('enforces route-level 20/min rate limits on password/login and totp/verify with RATE_LIMITED payload', async () => {
    const dispatch = vi.fn<(req: AuthDispatchRequest) => Promise<AuthDispatchResult>>(
      async (): Promise<AuthDispatchResult> => ({ status: 401, body: { error: 'INVALID' } }),
    );
    const app = await buildAuthServer({ dispatch });
    try {
      for (let i = 0; i < 20; i += 1) {
        const ok = await app.inject({
          method: 'POST',
          url: '/v1/auth/password/login',
          headers: { 'x-forwarded-for': '203.0.113.77' },
          payload: { handle: 'admin', password: 'bad' },
        });
        expect(ok.statusCode).toBe(401);
      }

      const limited = await app.inject({
        method: 'POST',
        url: '/v1/auth/password/login',
        headers: { 'x-forwarded-for': '203.0.113.77' },
        payload: { handle: 'admin', password: 'bad' },
      });
      expect(limited.statusCode).toBe(429);
      expect(limited.headers['retry-after']).toBeDefined();
      expect(limited.json()).toMatchObject({ statusCode: 429, error: 'RATE_LIMITED' });
    } finally {
      await app.close();
    }
  });

  it('persists and revokes guest sessions against the ephemeral PostgreSQL 19 test database', async () => {
    const pool = createDbPool();
    const db = createDb(pool);
    const app = await buildAuthServer({ db });

    try {
      const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest' });
      expect(guest.statusCode).toBe(201);
      const guestBody = guest.json() as { sessionId: string; role: string };
      expect(guestBody.role).toBe('guest');
      expect(guestBody.sessionId).toMatch(/^[0-9a-f-]{36}$/i);

      const cookieHeader = `ak_guest_session=${guestBody.sessionId}`;
      const activeSession = await app.inject({
        method: 'GET',
        url: '/v1/auth/session',
        headers: { cookie: cookieHeader },
      });
      expect(activeSession.statusCode).toBe(200);
      expect(activeSession.json()).toMatchObject({
        authenticated: true,
        session: { sessionId: guestBody.sessionId, role: 'guest' },
      });

      const logout = await app.inject({
        method: 'POST',
        url: '/v1/auth/logout',
        headers: { cookie: cookieHeader },
      });
      expect(logout.statusCode).toBe(200);

      const revokedSession = await app.inject({
        method: 'GET',
        url: '/v1/auth/session',
        headers: { cookie: cookieHeader },
      });
      expect(revokedSession.statusCode).toBe(200);
      expect(revokedSession.json()).toMatchObject({
        authenticated: false,
        session: null,
      });
    } finally {
      await app.close();
      await pool.end();
    }
  });
});
