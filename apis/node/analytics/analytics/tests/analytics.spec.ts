import type { AppDatabase, ingestAnalyticsBatch } from '@aklapper/db';
import { vi } from 'vitest';

import { buildAnalyticsServer } from '../src/server.ts';

describe('node-api-analytics', () => {
  it('validates, hashes IP with daily salt, and persists telemetry batches', async () => {
    const ingest = vi.fn<typeof ingestAnalyticsBatch>(async (_db, batch, meta) => ({
      accepted: batch.events.length,
      sessionId: batch.sessionId,
      ipHash: meta.ipHash,
    }));

    const app = await buildAnalyticsServer({
      db: {} as unknown as AppDatabase,
      env: { ANALYTICS_DAILY_SALT: 'test-salt' },
      ingest,
    });
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/analytics/ingest',
        headers: {
          'x-cloud-country': 'US',
          'x-cloud-region': 'GA',
        },
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
      expect(ingest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ sessionId: 'sess-abc' }),
        expect.objectContaining({
          ipHash: response.json().ipHash,
          country: 'US',
          region: 'GA',
        }),
      );
    } finally {
      await app.close();
    }
  });
});
