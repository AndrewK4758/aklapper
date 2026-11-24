import type { AnalyticsBatch } from '@aklapper/contracts';

import { createAnalyticsClient } from '../src/index.js';

describe('@aklapper/analytics', () => {
  it('batches and flushes first-party events cleanly', () => {
    const sent: AnalyticsBatch[] = [];
    const client = createAnalyticsClient({
      endpoint: '/api/analytics/ingest',
      respectPrivacySignals: false,
      maxBatchSize: 2,
      transport: (_url, payload) => sent.push(payload),
    });

    client.track({ type: 'page_view', name: 'greeter', path: '/' });
    expect(sent).toHaveLength(0);

    client.track({ type: 'interaction', name: 'guest_login', path: '/' });
    expect(sent).toHaveLength(1);
    expect(sent[0].events).toHaveLength(2);
    expect(sent[0].sessionId).toBe(client.sessionId);
  });
});
