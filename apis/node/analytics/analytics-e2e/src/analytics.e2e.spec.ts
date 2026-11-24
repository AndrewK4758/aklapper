import { resolve } from 'node:path';

import type { AnalyticsBatch } from '@aklapper/contracts';
import { fetchJson, startNodeApiProcess, type RunningNodeApi } from '@aklapper/node-e2e-kit';

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

describe('node-api-analytics E2E', () => {
  let api: RunningNodeApi;

  beforeAll(async () => {
    const analyticsDir = resolve(import.meta.dirname, '../../analytics');
    api = await startNodeApiProcess({
      cwd: analyticsDir,
      entryPath: 'src/main.ts',
    });
  });

  afterAll(async () => {
    await api.close();
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

  it('ingests valid telemetry batches and produces stable daily IP hashes', async () => {
    const now = new Date().toISOString();
    const batch: AnalyticsBatch = {
      sessionId: 'e2e-session-01',
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
      body: batch,
    });
    const second = await fetchJson<AnalyticsIngestAccepted>(`${api.baseUrl}/v1/analytics/ingest`, {
      method: 'POST',
      body: { ...batch, sessionId: 'e2e-session-02' },
    });

    expect(first.status).toBe(202);
    expect(first.data.accepted).toBe(2);
    expect(first.data.sessionId).toBe('e2e-session-01');
    expect(first.data.ipHash).toMatch(/^[a-f0-9]{24}$/);

    expect(second.status).toBe(202);
    expect(second.data.ipHash).toBe(first.data.ipHash);
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
