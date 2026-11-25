import type { AskResponse, AskSource, QuotaStatus } from '@aklapper/core';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readPersistedAskTurn, type RecoveredErrorState } from './askTurnRecovery';
import { useAskStreaming } from './useAskStreaming';

interface ControlledSseStream {
  readonly response: Response;
  readonly enqueue: (rawSse: string) => void;
  readonly close: () => void;
}

function createControlledSseStream(): ControlledSseStream {
  const encoder = new TextEncoder();
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      streamController = c;
    },
  });

  return {
    response: new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream; charset=utf-8' },
    }),
    enqueue(rawSse: string) {
      streamController?.enqueue(encoder.encode(rawSse));
    },
    close() {
      streamController?.close();
    },
  };
}

const SAMPLE_SOURCES: readonly AskSource[] = [
  {
    id: 'src-1',
    title: 'Portfolio Architecture',
    snippet: 'Cloud Run + GKE Autopilot.',
    score: 0.92,
  },
];

describe('useAskStreaming post-abort race guards', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('ignores a queued post-abort terminal error frame from Stream 1 after Stream 2 supersedes it', async () => {
    const stream1 = createControlledSseStream();
    const stream2 = createControlledSseStream();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(stream1.response)
      .mockResolvedValueOnce(stream2.response);

    const onDispatched = vi.fn<(attemptId: string) => void>();
    const onCompleted =
      vi.fn<(attemptId: string, question: string, response: AskResponse) => void>();
    const onFailed = vi.fn<(error: RecoveredErrorState, quota?: QuotaStatus) => void>();

    const { result } = renderHook(() =>
      useAskStreaming({
        streamEndpoint: '/api/ask/stream',
        submittingLabel: 'Searching...',
        onDispatched,
        onCompleted,
        onFailed,
      }),
    );

    act(() => {
      result.current.startStreamingQa('First question');
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    act(() => {
      stream1.enqueue(`event: sources\ndata: ${JSON.stringify({ sources: SAMPLE_SOURCES })}\n\n`);
    });

    await waitFor(() => {
      expect(result.current.activeStream?.sourcesReceived).toBe(true);
    });

    // Allow Stream 1's loop to re-enter reader.read(), then queue a terminal error chunk
    // in the same turn that Stream 1 is canceled and superseded by Stream 2.
    await Promise.resolve();
    act(() => {
      stream1.enqueue(
        `event: error\ndata: ${JSON.stringify({
          code: 'ERR_UPSTREAM_UNAVAILABLE',
          status: 503,
          message: 'Stream 1 failed after abort.',
          action: 'Retry.',
          correlationId: 'corr-stream-1',
        })}\n\n`,
      );
      result.current.cancelStream();
      result.current.startStreamingQa('Second question');
    });

    await act(async () => {
      await Promise.resolve();
      await new Promise(resolveTimer => {
        window.setTimeout(resolveTimer, 10);
      });
    });

    expect(result.current.activeStream).not.toBeNull();
    expect(result.current.activeStream?.question).toBe('Second question');
    expect(result.current.failedStreamSources).toEqual([]);
    expect(readPersistedAskTurn()?.question).toBe('Second question');
    expect(onFailed).not.toHaveBeenCalled();
    expect(onCompleted).not.toHaveBeenCalled();

    act(() => {
      result.current.cancelStream();
    });
  });

  it('ignores a queued post-abort terminal done frame from Stream 1 after Stream 2 supersedes it', async () => {
    const stream1 = createControlledSseStream();
    const stream2 = createControlledSseStream();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(stream1.response)
      .mockResolvedValueOnce(stream2.response);

    const onDispatched = vi.fn<(attemptId: string) => void>();
    const onCompleted =
      vi.fn<(attemptId: string, question: string, response: AskResponse) => void>();
    const onFailed = vi.fn<(error: RecoveredErrorState, quota?: QuotaStatus) => void>();

    const { result } = renderHook(() =>
      useAskStreaming({
        streamEndpoint: '/api/ask/stream',
        submittingLabel: 'Searching...',
        onDispatched,
        onCompleted,
        onFailed,
      }),
    );

    act(() => {
      result.current.startStreamingQa('First question');
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    act(() => {
      stream1.enqueue(`event: sources\ndata: ${JSON.stringify({ sources: SAMPLE_SOURCES })}\n\n`);
    });

    await waitFor(() => {
      expect(result.current.activeStream?.sourcesReceived).toBe(true);
    });

    const stream1AttemptId = result.current.activeStream?.attemptId ?? 'attempt-1';
    await Promise.resolve();
    act(() => {
      stream1.enqueue(
        `event: done\ndata: ${JSON.stringify({
          attemptId: stream1AttemptId,
          conversationId: '33333333-3333-4333-8333-333333333333',
          turnIndex: 1,
          grounded: true,
          abstained: false,
          groundingTier: 'evidence',
          answer: 'Stale Stream 1 answer.',
          suggestedLinks: [],
          followUpQuestions: [],
          provider: 'ai-ask',
          tokensUsed: 42,
          correlationId: 'corr-done-1',
        })}\n\n`,
      );
      result.current.startStreamingQa('Second question');
    });

    await act(async () => {
      await Promise.resolve();
      await new Promise(resolveTimer => {
        window.setTimeout(resolveTimer, 10);
      });
    });

    expect(result.current.activeStream).not.toBeNull();
    expect(result.current.activeStream?.question).toBe('Second question');
    expect(readPersistedAskTurn()?.question).toBe('Second question');
    expect(result.current.conversationId).not.toBe('33333333-3333-4333-8333-333333333333');
    expect(onCompleted).not.toHaveBeenCalled();
    expect(onFailed).not.toHaveBeenCalled();

    act(() => {
      result.current.cancelStream();
    });
  });

  it('scopes persisted turn ownership to instanceId and refuses to clear another instance turn', async () => {
    const stream = createControlledSseStream();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(stream.response);
    const onDispatched = vi.fn<(attemptId: string) => void>();
    const onCompleted =
      vi.fn<(attemptId: string, question: string, response: AskResponse) => void>();
    const onFailed = vi.fn<(error: RecoveredErrorState, quota?: QuotaStatus) => void>();

    const primary = renderHook(() =>
      useAskStreaming({
        instanceId: 'route:/chat',
        streamEndpoint: '/api/ask/stream',
        submittingLabel: 'Searching...',
        onDispatched,
        onCompleted,
        onFailed,
      }),
    );

    const secondary = renderHook(() =>
      useAskStreaming({
        instanceId: 'pane-2:/chat',
        streamEndpoint: '/api/ask/stream',
        submittingLabel: 'Searching...',
        onDispatched,
        onCompleted,
        onFailed,
      }),
    );

    act(() => {
      primary.result.current.startStreamingQa('Primary owned question');
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    expect(readPersistedAskTurn()).toMatchObject({
      question: 'Primary owned question',
      ownerInstanceId: 'route:/chat',
    });

    // Secondary instance canceling must NOT clear primary's persisted turn
    act(() => {
      secondary.result.current.cancelStream();
    });
    expect(readPersistedAskTurn()?.ownerInstanceId).toBe('route:/chat');

    // Primary canceling clears its own persisted turn
    act(() => {
      primary.result.current.cancelStream();
    });
    expect(readPersistedAskTurn()).toBeNull();
  });
});
