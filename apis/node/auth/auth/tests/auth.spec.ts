import { buildAuthServer } from '../src/server.ts';

describe('node-api-auth', () => {
  it('serves healthz and issues ephemeral guest sessions', async () => {
    const app = await buildAuthServer();
    try {
      const health = await app.inject({ method: 'GET', url: '/healthz' });
      expect(health.statusCode).toBe(200);
      expect(health.json().service).toBe('node-api-auth');

      const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest' });
      expect(guest.statusCode).toBe(201);
      expect(guest.json().role).toBe('guest');
    } finally {
      await app.close();
    }
  });
});
