import { resolve } from 'node:path';

import { AuthSessionSchema } from '@aklapper/contracts';
import { fetchJson, startNodeApiProcess, type RunningNodeApi } from '@aklapper/node-e2e-kit';

interface AuthHealthPayload {
  status: string;
  service: string;
  methods: string[];
}

interface AuthErrorPayload {
  error: string;
  message: string;
}

describe('node-api-auth E2E', () => {
  let api: RunningNodeApi;

  beforeAll(async () => {
    const authDir = resolve(import.meta.dirname, '../../auth');
    api = await startNodeApiProcess({
      cwd: authDir,
      entryPath: 'src/main.ts',
    });
  });

  afterAll(async () => {
    await api.close();
  });

  it('serves /healthz with security headers over real HTTP', async () => {
    const res = await fetchJson<AuthHealthPayload>(`${api.baseUrl}/healthz`);

    expect(res.status).toBe(200);
    expect(res.data).toEqual({
      status: 'ok',
      service: 'node-api-auth',
      methods: ['passkey', 'guest', 'totp-2fa-ready'],
    });
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
  });

  it('issues distinct schema-valid ephemeral guest sessions on POST /v1/auth/guest', async () => {
    const first = await fetchJson<unknown>(`${api.baseUrl}/v1/auth/guest`, { method: 'POST' });
    const second = await fetchJson<unknown>(`${api.baseUrl}/v1/auth/guest`, { method: 'POST' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const parsedFirst = AuthSessionSchema.parse(first.data);
    const parsedSecond = AuthSessionSchema.parse(second.data);

    expect(parsedFirst.role).toBe('guest');
    expect(parsedFirst.handle).toBe('guest');
    expect(parsedFirst.sessionId).not.toBe(parsedSecond.sessionId);
    expect(Date.parse(parsedFirst.expiresAt)).toBeGreaterThan(Date.now());
  });

  it('returns 501 PASSKEY_DB_NOT_BOUND on POST /v1/auth/passkey/options', async () => {
    const res = await fetchJson<AuthErrorPayload>(`${api.baseUrl}/v1/auth/passkey/options`, {
      method: 'POST',
    });

    expect(res.status).toBe(501);
    expect(res.data.error).toBe('PASSKEY_DB_NOT_BOUND');
    expect(res.data.message.length).toBeGreaterThan(0);
  });

  it('returns 404 for unknown routes', async () => {
    const response = await fetch(`${api.baseUrl}/v1/auth/does-not-exist`);
    expect(response.status).toBe(404);
  });
});
