import type { EntryContext } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createEntryServer, streamTimeout } from '../src/index.js';

describe('@aklapper/ssr-server', () => {
  it('handles HEAD requests without streaming body', async () => {
    const entry = createEntryServer({ streamTimeout: 2_500 });
    expect(entry.streamTimeout).toBe(2_500);
    expect(streamTimeout).toBe(5_000);

    const headers = new Headers({ 'X-Test': 'ok' });
    const res = await entry.handleRequest(
      new Request('http://localhost/health', { method: 'HEAD' }),
      200,
      headers,
      {} as EntryContext,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Test')).toBe('ok');
    expect(res.body).toBeNull();
  });
});
