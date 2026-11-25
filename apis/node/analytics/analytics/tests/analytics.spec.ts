import { randomUUID } from 'node:crypto';
import { PassThrough } from 'node:stream';

import { type AppDatabase, createDb, createDbPool, type ingestAnalyticsBatch } from '@aklapper/db';
import { buildDailyAnalyticsSalt, hashVisitorIp } from '@aklapper/node-runtime/auth';
import { signInternalAuthToken } from '@aklapper/node-runtime/http';
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

  it('enforces SINGLE_PROXY_HOP, verifies signed x-internal-client-ip, flags forged hops, and redacts Pino logs', async () => {
    const ingest = vi.fn<typeof ingestAnalyticsBatch>(async (_db, batch, meta) => ({
      accepted: batch.events.length,
      sessionId: batch.sessionId,
      ipHash: meta.ipHash,
    }));
    const logChunks: string[] = [];
    const loggerStream = new PassThrough();
    loggerStream.on('data', chunk => {
      logChunks.push(Buffer.from(chunk).toString('utf8'));
    });

    const app = await buildAnalyticsServer({
      db: {} as unknown as AppDatabase,
      env: {
        NODE_ENV: 'production',
        INTERNAL_AUTH_SECRET: 'analytics-hmac-secret',
        ANALYTICS_DAILY_SALT: 'proxy-test-salt',
      },
      ingest,
      loggerStream,
    });

    try {
      const signedToken = signInternalAuthToken({
        role: 'service',
        subject: 'client-ip:203.0.113.55',
        secret: 'analytics-hmac-secret',
      });

      const signedRes = await app.inject({
        method: 'POST',
        url: '/v1/analytics/ingest',
        headers: {
          authorization: 'Bearer sensitive-oidc-jwt',
          cookie: 'ak_admin_session=sensitive-cookie',
          'x-internal-auth': 'sensitive-hmac-token',
          'x-forwarded-for': '198.51.100.1, 10.0.0.2',
          'x-internal-client-ip': signedToken,
        },
        payload: {
          sessionId: 'sess-signed',
          events: [
            {
              type: 'page_view',
              name: 'home',
              path: '/',
              timestamp: new Date().toISOString(),
            },
          ],
        },
      });

      expect(signedRes.statusCode).toBe(202);
      const expectedSignedHash = hashVisitorIp(
        '203.0.113.55',
        buildDailyAnalyticsSalt('proxy-test-salt'),
      );
      expect(ingest).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ sessionId: 'sess-signed' }),
        expect.objectContaining({
          ipHash: expectedSignedHash,
        }),
      );
      const getCallIpHash = (index: number): string => {
        const call = ingest.mock.calls.at(index);
        if (!call) {
          throw new Error(`Expected ingest call at index ${index}`);
        }
        return call[2].ipHash;
      };
      const firstHash = getCallIpHash(0);

      // Forged x-internal-client-ip and leftmost spoofed X-Forwarded-For fall back to rightmost SINGLE_PROXY_HOP request.ip (10.0.0.2), NOT leftmost 1.2.3.4
      await app.inject({
        method: 'POST',
        url: '/v1/analytics/ingest',
        headers: {
          'x-forwarded-for': '1.2.3.4, 10.0.0.2',
          'x-internal-client-ip': 'v1.forged.signature',
        },
        payload: {
          sessionId: 'sess-spoofed',
          events: [
            {
              type: 'page_view',
              name: 'home',
              path: '/',
              timestamp: new Date().toISOString(),
            },
          ],
        },
      });
      await app.inject({
        method: 'POST',
        url: '/v1/analytics/ingest',
        headers: {
          'x-forwarded-for': '9.9.9.9, 10.0.0.2',
        },
        payload: {
          sessionId: 'sess-rightmost',
          events: [
            {
              type: 'page_view',
              name: 'home',
              path: '/',
              timestamp: new Date().toISOString(),
            },
          ],
        },
      });

      const forgedHash = getCallIpHash(1);
      const rightmostHash = getCallIpHash(2);
      expect(forgedHash).toBe(rightmostHash);
      expect(forgedHash).not.toBe(firstHash);

      app.log.info(
        {
          payload: {
            secret: 'sensitive-internal-secret',
            password: 'sensitive-password-material',
          },
        },
        'redaction check',
      );

      const joinedLogs = logChunks.join('');
      expect(joinedLogs).toContain('analytics.ingest.proxy_hop_untrusted');
      expect(joinedLogs).not.toContain('sensitive-oidc-jwt');
      expect(joinedLogs).not.toContain('sensitive-cookie');
      expect(joinedLogs).not.toContain('sensitive-hmac-token');
      expect(joinedLogs).not.toContain('sensitive-internal-secret');
      expect(joinedLogs).not.toContain('sensitive-password-material');
      expect(joinedLogs).toContain('[REDACTED]');
    } finally {
      await app.close();
    }
  });
});
