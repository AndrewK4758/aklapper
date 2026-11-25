import type { CadenceRunResult } from '@aklapper/core';
import { act, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCadenceAutoAttachRegistryForTest, useCadenceRunController } from './cadence-stream';

class FakeEventSource {
  readonly url: string;
  closed = false;
  readonly listeners = new Map<string, Set<(event: MessageEvent<string>) => void>>();
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  close(): void {
    this.closed = true;
  }
}

function makeRunningRun(runId: string): CadenceRunResult {
  return {
    runId,
    presetSlug: 'feature-spec',
    mode: 'fast',
    runStatus: 'running',
    gateVerdict: 'pending',
    prompt: 'Implement workspace transport',
    turns: [],
    artifactHtml: '',
  };
}

describe('useCadenceRunController single-owner SSE claim registry', () => {
  afterEach(() => {
    resetCadenceAutoAttachRegistryForTest();
    vi.restoreAllMocks();
  });

  it('auto-attaches a lone secondary instance idempotently under React StrictMode', () => {
    const created: FakeEventSource[] = [];
    const eventSourceFactory = (url: string): EventSource => {
      const es = new FakeEventSource(url);
      created.push(es);
      return es as unknown as EventSource;
    };

    const run = makeRunningRun('run-strict-1');
    const { result, unmount } = renderHook(
      () =>
        useCadenceRunController({
          instanceId: 'pane-2:/cadence',
          recentRuns: [run],
          eventSourceFactory,
        }),
      { wrapper: StrictMode },
    );

    // StrictMode mounts, cleans up (releasing the claim), and remounts cleanly.
    expect(created.length).toBeGreaterThanOrEqual(1);
    expect(created.at(-1)?.closed).toBe(false);
    expect(result.current.isStreaming).toBe(true);

    unmount();
    expect(created.at(-1)?.closed).toBe(true);
  });

  it('suppresses duplicate SSE attachment when a second coexisting instance mounts for the same runId and releases on owner unmount', () => {
    const created: FakeEventSource[] = [];
    const eventSourceFactory = (url: string): EventSource => {
      const es = new FakeEventSource(url);
      created.push(es);
      return es as unknown as EventSource;
    };

    const run = makeRunningRun('run-shared-1');
    const primary = renderHook(() =>
      useCadenceRunController({
        instanceId: 'route:/cadence',
        recentRuns: [run],
        eventSourceFactory,
      }),
    );

    expect(created).toHaveLength(1);
    expect(primary.result.current.isStreaming).toBe(true);

    const secondary = renderHook(() =>
      useCadenceRunController({
        instanceId: 'pane-2:/cadence',
        recentRuns: [run],
        eventSourceFactory,
      }),
    );

    // Secondary must NOT open a duplicate EventSource while primary owns the runId.
    expect(created).toHaveLength(1);
    expect(secondary.result.current.isStreaming).toBe(false);

    // Unmounting primary releases the claim so a newly mounted pane can auto-attach.
    primary.unmount();
    expect(created[0]?.closed).toBe(true);

    const tertiary = renderHook(() =>
      useCadenceRunController({
        instanceId: 'pane-3:/cadence',
        recentRuns: [run],
        eventSourceFactory,
      }),
    );
    expect(created).toHaveLength(2);
    expect(tertiary.result.current.isStreaming).toBe(true);

    secondary.unmount();
    tertiary.unmount();
  });

  it('submits commands through paneAction adapter when provided instead of fetcher', () => {
    const submitSpy = vi.fn<(fields: Readonly<Record<string, string>>) => void>();
    const { result } = renderHook(() =>
      useCadenceRunController({
        instanceId: 'pane-2:/cadence',
        recentRuns: [],
        paneAction: {
          data: undefined,
          isSubmitting: false,
          submit: submitSpy,
        },
      }),
    );

    act(() => {
      result.current.onRunBuild({
        prompt: 'Add streaming view',
        presetSlug: 'feature-spec',
        mode: 'fast',
      });
    });

    expect(submitSpy).toHaveBeenCalledWith({
      intent: 'run',
      prompt: 'Add streaming view',
      presetSlug: 'feature-spec',
      mode: 'fast',
      requireSpecApproval: 'true',
    });
  });
});
