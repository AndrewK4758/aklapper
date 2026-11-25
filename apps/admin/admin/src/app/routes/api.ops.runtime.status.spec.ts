import { RuntimeServiceHealthSnapshotSchema } from '@aklapper/core';
import { clearRuntimeHealthCacheForTest } from '@aklapper/node-runtime/runtime-health';
import { afterEach, describe, expect, it, vi } from 'vitest';

const requireAdminSessionMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();

vi.mock('../admin-ops.server', async () => {
  const actual = await vi.importActual<typeof import('../admin-ops.server')>('../admin-ops.server');
  return {
    ...actual,
    requireAdminSession: (...args: unknown[]) => requireAdminSessionMock(...args),
  };
});

import { loader } from './api.ops.runtime.status';

describe('admin /api/ops/runtime/status resource route', () => {
  afterEach(() => {
    clearRuntimeHealthCacheForTest();
    requireAdminSessionMock.mockReset();
    vi.restoreAllMocks();
    delete process.env['AI_ASK_URL'];
    delete process.env['CADENCE_DEMO_URL'];
  });

  it('returns HTTP 401 verbatim and emits UNSOUND_CONDITION telemetry when unauthenticated', async () => {
    const unauthorizedResponse = Response.json(
      { error: 'UNAUTHORIZED', message: 'Verified admin session required.' },
      { status: 401, headers: { 'X-Correlation-Id': 'corr-unauth-1' } },
    );
    requireAdminSessionMock.mockRejectedValueOnce(unauthorizedResponse);

    const warnLogs: string[] = [];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((msg: unknown) => {
      warnLogs.push(String(msg));
    });

    try {
      let caught: unknown;
      try {
        await loader({
          request: new Request('https://admin.andrew-k.us/api/ops/runtime/status'),
          params: {},
          context: {} as never,
          url: new URL('https://admin.andrew-k.us/api/ops/runtime/status'),
          pattern: '/api/ops/runtime/status',
        } as never);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBe(unauthorizedResponse);
      expect((caught as Response).status).toBe(401);
      expect(warnLogs.join('\n')).toContain('admin.ops.unauthenticated_runtime_status');
      expect(warnLogs.join('\n')).toContain('UNSOUND_CONDITION');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('returns valid RuntimeServiceHealthSnapshot JSON and bypasses TTL cache on ?refresh=1', async () => {
    requireAdminSessionMock.mockResolvedValue({
      session: { role: 'admin', handle: 'admin' },
      correlationId: 'corr-auth-1',
    });
    process.env['AI_ASK_URL'] = 'http://127.0.0.1:8083';
    process.env['CADENCE_DEMO_URL'] = 'http://127.0.0.1:8082';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('8083')) {
        return Response.json({ status: 'ok', service: 'ai-ask' });
      }
      const timeoutErr = new Error('timeout');
      timeoutErr.name = 'TimeoutError';
      throw timeoutErr;
    });

    const res1 = await loader({
      request: new Request('https://admin.andrew-k.us/api/ops/runtime/status'),
      params: {},
      context: {} as never,
      url: new URL('https://admin.andrew-k.us/api/ops/runtime/status'),
      pattern: '/api/ops/runtime/status',
    } as never);
    expect(res1.status).toBe(200);
    const snap1 = RuntimeServiceHealthSnapshotSchema.parse(await res1.json());
    expect(snap1.cached).toBe(false);
    expect(snap1.services.find(s => s.service === 'ai-ask')?.status).toBe('healthy');
    expect(snap1.services.find(s => s.service === 'cadence-demo')?.status).toBe('offline');
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const res2 = await loader({
      request: new Request('https://admin.andrew-k.us/api/ops/runtime/status?refresh=1'),
      params: {},
      context: {} as never,
      url: new URL('https://admin.andrew-k.us/api/ops/runtime/status?refresh=1'),
      pattern: '/api/ops/runtime/status',
    } as never);
    expect(res2.status).toBe(200);
    const snap2 = RuntimeServiceHealthSnapshotSchema.parse(await res2.json());
    expect(snap2.cached).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });
});
