import { buildAnalyticsServer } from '../src/server.js';

describe('node-api-analytics', () => {
  it('validates and accepts privacy-hashed telemetry batches', async () => {
    const app = await buildAnalyticsServer();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/analytics/ingest',
        payload: {
          sessionId: 'sess-abc',
          events: [
            {
              type: 'web_vital',
              name: 'LCP',
              path: '/',
              value: 620,
              timestamp: new Date().toISOString(),
            },
          ],
        },
      });
      expect(response.statusCode).toBe(202);
      expect(response.json().accepted).toBe(1);
      expect(response.json().ipHash).toHaveLength(24);
    } finally {
      await app.close();
    }
  });
});
