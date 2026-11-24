import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import type { AnalyticsBatch } from '@aklapper/core';
import { createDbPool } from '@aklapper/db';
import { loadWorkspaceEnv } from '@aklapper/node-runtime/env';
import { fetchJson, startNodeApiProcess, type RunningNodeApi } from '@aklapper/tooling/e2e';

interface AnalyticsHealthPayload {
  status: string;
  service: string;
}

interface AnalyticsIngestAccepted {
  accepted: number;
  sessionId: string;
  ipHash: string;
}

interface AnalyticsErrorPayload {
  error: string;
}

describe('node-api-analytics E2E (PostgreSQL 19)', () => {
  let api: RunningNodeApi;
  const createdSessionIds: string[] = [];

  beforeAll(async () => {
    loadWorkspaceEnv({ startDir: import.meta.dirname, mode: 'e2e' });
    const analyticsDir = resolve(import.meta.dirname, '../../analytics');
    api = await startNodeApiProcess({
      cwd: analyticsDir,
      entryPath: 'src/main.ts',
    });
  });

  afterAll(async () => {
    await api.close();
    if (createdSessionIds.length > 0) {
      const pool = createDbPool();
      try {
        await pool.query('DELETE FROM analytics_sessions WHERE session_id = ANY($1::text[])', [
          createdSessionIds,
        ]);
      } finally {
        await pool.end();
      }
    }
  });

  it('serves /healthz with helmet security headers over real HTTP', async () => {
    const res = await fetchJson<AnalyticsHealthPayload>(`${api.baseUrl}/healthz`);

    expect(res.status).toBe(200);
    expect(res.data).toEqual({
      status: 'ok',
      service: 'node-api-analytics',
    });
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('ingests telemetry batches, persists sessions & events in PG19, and keeps daily IP hashes stable', async () => {
    const now = new Date().toISOString();
    const sessionOne = `e2e-session-${randomUUID().slice(0, 8)}`;
    const sessionTwo = `e2e-session-${randomUUID().slice(0, 8)}`;
    createdSessionIds.push(sessionOne, sessionTwo);

    const batch: AnalyticsBatch = {
      sessionId: sessionOne,
      referrer: 'https://andrew-k.us/',
      events: [
        {
          type: 'page_view',
          name: 'portal_home',
          path: '/',
          timestamp: now,
        },
        {
          type: 'web_vital',
          name: 'LCP',
          path: '/',
          value: 480,
          metadata: { rating: 'good', hydrated: true },
          timestamp: now,
        },
      ],
    };

    const first = await fetchJson<AnalyticsIngestAccepted>(`${api.baseUrl}/v1/analytics/ingest`, {
      method: 'POST',
      headers: {
        'x-cloud-country': 'US',
        'x-cloud-region': 'GA',
      },
      body: batch,
    });
    const second = await fetchJson<AnalyticsIngestAccepted>(`${api.baseUrl}/v1/analytics/ingest`, {
      method: 'POST',
      body: { ...batch, sessionId: sessionTwo },
    });

    expect(first.status).toBe(202);
    expect(first.data.accepted).toBe(2);
    expect(first.data.sessionId).toBe(sessionOne);
    expect(first.data.ipHash).toMatch(/^[a-f0-9]{24}$/);

    expect(second.status).toBe(202);
    expect(second.data.ipHash).toBe(first.data.ipHash);

    const pool = createDbPool();
    try {
      const sessionRows = await pool.query<{
        session_id: string;
        ip_hash: string;
        country: string | null;
        region: string | null;
      }>(
        'SELECT session_id, ip_hash, country, region FROM analytics_sessions WHERE session_id = $1',
        [sessionOne],
      );
      expect(sessionRows.rows).toHaveLength(1);
      expect(sessionRows.rows[0]).toEqual({
        session_id: sessionOne,
        ip_hash: first.data.ipHash,
        country: 'US',
        region: 'GA',
      });

      const eventRows = await pool.query<{ type: string; name: string; value: number | null }>(
        'SELECT type, name, value FROM analytics_events WHERE session_id = $1 ORDER BY type ASC',
        [sessionOne],
      );
      expect(eventRows.rows).toEqual([
        { type: 'page_view', name: 'portal_home', value: null },
        { type: 'web_vital', name: 'LCP', value: 480 },
      ]);
    } finally {
      await pool.end();
    }
  });

  it('rejects invalid telemetry payloads with 400 INVALID_ANALYTICS_BATCH', async () => {
    const emptyEvents = await fetchJson<AnalyticsErrorPayload>(
      `${api.baseUrl}/v1/analytics/ingest`,
      {
        method: 'POST',
        body: { sessionId: 'e2e-empty', events: [] },
      },
    );
    expect(emptyEvents.status).toBe(400);
    expect(emptyEvents.data).toEqual({ error: 'INVALID_ANALYTICS_BATCH' });

    const invalidEventType = await fetchJson<AnalyticsErrorPayload>(
      `${api.baseUrl}/v1/analytics/ingest`,
      {
        method: 'POST',
        body: {
          sessionId: 'e2e-bad-type',
          events: [
            {
              type: 'unknown_event',
              name: 'bad',
              path: '/',
              timestamp: new Date().toISOString(),
            },
          ],
        },
      },
    );
    expect(invalidEventType.status).toBe(400);
    expect(invalidEventType.data).toEqual({ error: 'INVALID_ANALYTICS_BATCH' });
  });

  it('returns 404 for unknown routes', async () => {
    const response = await fetch(`${api.baseUrl}/v1/analytics/does-not-exist`);
    expect(response.status).toBe(404);
  });
});
