import type { AuthDispatchRequest, AuthDispatchResult } from '@aklapper/db/auth';
import { vi } from 'vitest';

import { buildAuthServer } from '../src/server.ts';

describe('node-api-auth', () => {
  it('serves healthz and dispatches auth routes with headers and set-cookie forwarding', async () => {
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
        if (req.method === 'POST' && req.action === 'passkey/register/options') {
          if (req.bootstrapTokenHeader !== 'secret-boot') {
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

    const app = await buildAuthServer({ dispatch });
    try {
      const health = await app.inject({ method: 'GET', url: '/healthz' });
      expect(health.statusCode).toBe(200);
      expect(health.json()).toEqual({
        status: 'ok',
        service: 'node-api-auth',
        methods: ['passkey', 'totp-2fa', 'guest'],
      });

      const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest' });
      expect(guest.statusCode).toBe(201);
      expect(guest.json().role).toBe('guest');
      expect(String(guest.headers['set-cookie'])).toContain('ak_guest_session=');

      const deniedReg = await app.inject({
        method: 'POST',
        url: '/v1/auth/passkey/register/options',
        payload: { handle: 'admin' },
      });
      expect(deniedReg.statusCode).toBe(401);

      const okReg = await app.inject({
        method: 'POST',
        url: '/v1/auth/passkey/register/options',
        headers: { 'x-bootstrap-token': 'secret-boot', origin: 'http://localhost:4301' },
        payload: { handle: 'admin' },
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
    } finally {
      await app.close();
    }
  });
});
