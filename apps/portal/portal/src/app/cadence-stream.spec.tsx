import type { CadenceRunResult } from '@aklapper/core';
import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import type { FetcherWithComponents } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PortalCadenceActionResult } from '#pages/cadence';

import {
  type CadencePaneActionAdapter,
  resetCadenceAutoAttachRegistryForTest,
  useCadenceRunController,
} from './cadence-stream';

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

  it('preserves SSR-to-hydration DOM parity when reloading an active running run and attaches SSE post-hydration', async () => {
    const run = makeRunningRun('run-ssr-hydrate-1');
    const created: FakeEventSource[] = [];
    const eventSourceFactory = (url: string): EventSource => {
      const es = new FakeEventSource(url);
      created.push(es);
      return es as unknown as EventSource;
    };

    function HydrationProbe() {
      const controller = useCadenceRunController({
        instanceId: 'primary:/cadence',
        recentRuns: [run],
        eventSourceFactory,
      });
      return (
        <output
          data-testid='cadence-hydration-probe'
          data-state={controller.isStreaming ? 'streaming' : 'idle'}
        >
          {controller.isStreaming ? 'streaming' : 'idle'}
        </output>
      );
    }

    // Step 1: Server render with window undefined
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    let ssrHtml = '';
    try {
      ssrHtml = renderToString(<HydrationProbe />);
    } finally {
      Object.defineProperty(globalThis, 'window', {
        value: originalWindow,
        configurable: true,
        writable: true,
      });
    }
    expect(ssrHtml).toContain('data-state="idle"');
    expect(created).toHaveLength(0);

    // Step 2: Hydrate on client -> getServerSnapshot returns null (zero mismatch), then attaches SSE
    const container = document.createElement('div');
    container.innerHTML = ssrHtml;
    document.body.appendChild(container);
    const recoverableErrors: unknown[] = [];
    const root = hydrateRoot(container, <HydrationProbe />, {
      onRecoverableError: err => {
        recoverableErrors.push(err);
      },
    });

    try {
      await waitFor(() => {
        expect(created).toHaveLength(1);
        expect(
          container
            .querySelector('[data-testid="cadence-hydration-probe"]')
            ?.getAttribute('data-state'),
        ).toBe('streaming');
      });
      expect(recoverableErrors).toEqual([]);
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
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

  it('routes commands through paneAction instead of fetcher and updates submitting, actionResult, and streaming states', () => {
    const created: FakeEventSource[] = [];
    const eventSourceFactory = (url: string): EventSource => {
      const es = new FakeEventSource(url);
      created.push(es);
      return es as unknown as EventSource;
    };

    const submitSpy = vi.fn<(fields: Readonly<Record<string, string>>) => void>();
    const fetcherSubmitSpy = vi.fn<() => Promise<void>>(async () => undefined);
    const fetcherStub = {
      state: 'idle',
      data: undefined,
      submit: fetcherSubmitSpy,
    } as unknown as FetcherWithComponents<PortalCadenceActionResult>;

    const initialAdapter: CadencePaneActionAdapter = {
      data: undefined,
      isSubmitting: false,
      submit: submitSpy,
    };

    const { result, rerender, unmount } = renderHook(
      ({ paneAction }: { readonly paneAction: CadencePaneActionAdapter }) =>
        useCadenceRunController({
          instanceId: 'pane-2:/cadence',
          recentRuns: [],
          fetcher: fetcherStub,
          paneAction,
          eventSourceFactory,
        }),
      { initialProps: { paneAction: initialAdapter } },
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
    expect(fetcherSubmitSpy).not.toHaveBeenCalled();

    // Transition to submitting state via paneAction adapter
    rerender({
      paneAction: {
        data: undefined,
        isSubmitting: true,
        submit: submitSpy,
      },
    });
    expect(result.current.isSubmitting).toBe(true);
    expect(result.current.isStreaming).toBe(false);

    // Transition to run-init response -> attaches EventSource and reflects live actionResult
    const run = makeRunningRun('run-pane-action-1');
    rerender({
      paneAction: {
        data: { ok: true, intent: 'run-init', run },
        isSubmitting: false,
        submit: submitSpy,
      },
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.isStreaming).toBe(true);
    expect(result.current.actionResult).toMatchObject({
      ok: true,
      intent: 'run-init',
      run: { runId: 'run-pane-action-1' },
    });
    expect(created).toHaveLength(1);
    expect(created[0]?.url).toContain('run-pane-action-1');

    unmount();
  });
});
