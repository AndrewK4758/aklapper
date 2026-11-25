import { RuntimeServiceHealthSnapshotSchema } from '@aklapper/core';
import { clearRuntimeHealthCacheForTest } from '@aklapper/node-runtime/runtime-health';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loader } from './api.runtime.status';

describe('portal /api/runtime/status resource route', () => {
  afterEach(() => {
    clearRuntimeHealthCacheForTest();
    vi.restoreAllMocks();
    delete process.env['AI_ASK_URL'];
    delete process.env['CADENCE_DEMO_URL'];
  });

  it('returns RuntimeServiceHealthSnapshot JSON and serves cached snapshot within TTL window', async () => {
    process.env['AI_ASK_URL'] = 'http://127.0.0.1:8083';
    process.env['CADENCE_DEMO_URL'] = 'http://127.0.0.1:8082';
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => Response.json({ status: 'ok' }));

    const req1 = new Request('https://andrew-k.us/api/runtime/status');
    const res1 = await loader({
      request: req1,
      params: {},
      context: {} as never,
      url: new URL('https://andrew-k.us/api/runtime/status'),
      pattern: '/api/runtime/status',
    } as never);

    expect(res1.status).toBe(200);
    expect(res1.headers.get('X-Correlation-Id')).toBeTruthy();
    const body1 = RuntimeServiceHealthSnapshotSchema.parse(await res1.json());
    expect(body1.cached).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const req2 = new Request('https://andrew-k.us/api/runtime/status');
    const res2 = await loader({
      request: req2,
      params: {},
      context: {} as never,
      url: new URL('https://andrew-k.us/api/runtime/status'),
      pattern: '/api/runtime/status',
    } as never);

    expect(res2.status).toBe(200);
    const body2 = RuntimeServiceHealthSnapshotSchema.parse(await res2.json());
    expect(body2.cached).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
