import type { AskResponse, AskSource, QuotaStatus } from '@aklapper/core';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type ActiveAskStreamState,
  generateConversationId,
  streamAskQuestion,
} from './askStreamClient';
import {
  clearPersistedAskTurn,
  generateAskAttemptId,
  type RecoveredErrorState,
  writePersistedAskTurn,
} from './askTurnRecovery';

export interface UseAskStreamingOptions {
  readonly streamEndpoint?: string;
  readonly submittingLabel: string;
  readonly onDispatched: (attemptId: string) => void;
  readonly onCompleted: (attemptId: string, question: string, response: AskResponse) => void;
  readonly onFailed: (error: RecoveredErrorState, quota?: QuotaStatus) => void;
}

export function useAskStreaming({
  streamEndpoint,
  submittingLabel,
  onDispatched,
  onCompleted,
  onFailed,
}: UseAskStreamingOptions) {
  const [conversationId, setConversationId] = useState<string>('');
  const [activeStream, setActiveStream] = useState<ActiveAskStreamState | null>(null);
  const [failedStreamSources, setFailedStreamSources] = useState<readonly AskSource[]>([]);
  const streamAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  const cancelStream = () => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    clearPersistedAskTurn();
    setActiveStream(null);
    setFailedStreamSources([]);
  };

  const resetConversation = () => {
    cancelStream();
    setConversationId(generateConversationId());
  };

  const restoreConversationId = useCallback((nextId?: string) => {
    if (nextId && nextId.trim()) {
      setConversationId(nextId.trim());
    }
  }, []);

  const startStreamingQa = (trimmed: string, visitorLens?: string) => {
    if (!streamEndpoint) return;
    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;

    const activeConversationId = conversationId || generateConversationId();
    if (!conversationId) {
      setConversationId(activeConversationId);
    }
    const attemptId = generateAskAttemptId();
    let capturedSources: readonly AskSource[] = [];
    onDispatched(attemptId);
    writePersistedAskTurn({ attemptId, mode: 'qa', question: trimmed });
    setFailedStreamSources([]);
    setActiveStream({
      attemptId,
      conversationId: activeConversationId,
      question: trimmed,
      statusLabel: submittingLabel,
      preambleText: '',
      preambleError: null,
      isPreambleLoading: true,
      sourcesReceived: false,
      text: '',
      sources: [],
    });

    void streamAskQuestion({
      url: streamEndpoint,
      question: trimmed,
      attemptId,
      conversationId: activeConversationId,
      visitorLens,
      signal: controller.signal,
      onStatus: label => {
        if (controller.signal.aborted || streamAbortRef.current !== controller) return;
        setActiveStream(prev =>
          prev?.attemptId === attemptId ? { ...prev, statusLabel: label } : prev,
        );
      },
      onMeta: meta => {
        if (controller.signal.aborted || streamAbortRef.current !== controller) return;
        if (meta.conversationId) {
          setConversationId(meta.conversationId);
        }
      },
      onPreamble: preambleDelta => {
        if (controller.signal.aborted || streamAbortRef.current !== controller) return;
        setActiveStream(prev =>
          prev?.attemptId === attemptId
            ? {
                ...prev,
                preambleText: prev.preambleText + preambleDelta,
                isPreambleLoading: false,
              }
            : prev,
        );
      },
      onPreambleError: preambleErr => {
        if (controller.signal.aborted || streamAbortRef.current !== controller) return;
        setActiveStream(prev =>
          prev?.attemptId === attemptId
            ? { ...prev, preambleError: preambleErr, isPreambleLoading: false }
            : prev,
        );
      },
      onSources: sources => {
        if (controller.signal.aborted || streamAbortRef.current !== controller) return;
        capturedSources = sources;
        setActiveStream(prev =>
          prev?.attemptId === attemptId
            ? { ...prev, sources, sourcesReceived: true, isPreambleLoading: false }
            : prev,
        );
      },
      onDelta: deltaText => {
        if (controller.signal.aborted || streamAbortRef.current !== controller) return;
        setActiveStream(prev =>
          prev?.attemptId === attemptId
            ? { ...prev, text: prev.text + deltaText, isPreambleLoading: false }
            : prev,
        );
      },
      onDone: response => {
        if (controller.signal.aborted || streamAbortRef.current !== controller) return;
        clearPersistedAskTurn();
        setActiveStream(null);
        setFailedStreamSources([]);
        if (response.conversationId) {
          setConversationId(response.conversationId);
        }
        onCompleted(attemptId, trimmed, response);
      },
      onError: (errState, errQuota) => {
        if (controller.signal.aborted || streamAbortRef.current !== controller) return;
        clearPersistedAskTurn();
        setActiveStream(null);
        setFailedStreamSources(capturedSources.length > 0 ? capturedSources : []);
        onFailed(errState, errQuota);
      },
    });
  };

  return {
    conversationId,
    activeStream,
    failedStreamSources,
    isStreaming: activeStream !== null,
    startStreamingQa,
    cancelStream,
    resetConversation,
    restoreConversationId,
  };
}
