import { randomUUID } from 'node:crypto';

import { type AppDatabase, createDb, createDbPool, type ingestAnalyticsBatch } from '@aklapper/db';
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

  it('persists telemetry sessions and events into the ephemeral PostgreSQL 19 test database', async () => {
    const pool = createDbPool();
    const db = createDb(pool);
    const app = await buildAnalyticsServer({
      db,
      env: { ANALYTICS_DAILY_SALT: 'ephemeral-test-salt' },
    });
    const sessionId = `unit-pg-${randomUUID().slice(0, 8)}`;

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/analytics/ingest',
        headers: {
          'x-cloud-country': 'US',
          'x-cloud-region': 'GA',
        },
        payload: {
          sessionId,
          referrer: 'https://andrew-k.us/',
          events: [
            {
              type: 'page_view',
              name: 'portal_home',
              path: '/',
              timestamp: new Date().toISOString(),
            },
          ],
        },
      });
      expect(response.statusCode).toBe(202);
      expect(response.json().accepted).toBe(1);

      const persisted = await pool.query<{ name: string; path: string }>(
        'SELECT name, path FROM analytics_events WHERE session_id = $1',
        [sessionId],
      );
      expect(persisted.rows).toEqual([{ name: 'portal_home', path: '/' }]);
    } finally {
      await app.close();
      await pool.end();
    }
  });
});
