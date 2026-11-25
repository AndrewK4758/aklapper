import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  refreshOpsRuntimeStatus,
  resetOpsRuntimeStoreForTest,
  useOpsRuntimeStatus,
} from './opsRuntimeStore';

describe('opsRuntimeStore stale-response ordering guard', () => {
  afterEach(() => {
    resetOpsRuntimeStoreForTest();
    vi.restoreAllMocks();
  });

  it('aborts and ignores a slower initial fetch when refreshOpsRuntimeStatus resolves first', async () => {
    let resolveFirst!: (res: Response) => void;
    let firstAborted = false;
    let callIndex = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
      callIndex += 1;
      if (callIndex === 1) {
        init?.signal?.addEventListener('abort', () => {
          firstAborted = true;
        });
        return new Promise<Response>(resolve => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve(
        Response.json({
          runtime: 'cloud-run',
          services: [
            {
              service: 'ai-ask',
              runtime: 'cloud-run',
              status: 'healthy',
              latencyMs: 12,
              checkedAt: '2026-11-25T18:00:01.000Z',
            },
          ],
          summaryLabel: 'Cloud Run · 1/1 healthy',
          checkedAt: '2026-11-25T18:00:01.000Z',
          cached: false,
        }),
      );
    });

    const { result } = renderHook(() => useOpsRuntimeStatus());
    expect(callIndex).toBe(1);

    await act(async () => {
      await refreshOpsRuntimeStatus();
    });

    expect(firstAborted).toBe(true);
    expect(result.current.snapshot?.summaryLabel).toBe('Cloud Run · 1/1 healthy');
    expect(result.current.snapshot?.services[0]?.status).toBe('healthy');

    // Even if the superseded request somehow resolves later with stale offline data, ignore it.
    await act(async () => {
      resolveFirst(
        Response.json({
          runtime: 'cloud-run',
          services: [
            {
              service: 'ai-ask',
              runtime: 'cloud-run',
              status: 'offline',
              latencyMs: 1500,
              checkedAt: '2026-11-25T17:59:00.000Z',
            },
          ],
          summaryLabel: 'Cloud Run · 0/1 healthy (1 offline)',
          checkedAt: '2026-11-25T17:59:00.000Z',
          cached: true,
        }),
      );
      await Promise.resolve();
    });

    expect(result.current.snapshot?.summaryLabel).toBe('Cloud Run · 1/1 healthy');
    expect(result.current.snapshot?.services[0]?.status).toBe('healthy');
  });
});
