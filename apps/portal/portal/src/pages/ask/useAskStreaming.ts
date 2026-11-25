import type { AskResponse, QuotaStatus } from '@aklapper/core';
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
    onDispatched(attemptId);
    writePersistedAskTurn({ attemptId, mode: 'qa', question: trimmed });
    setActiveStream({
      attemptId,
      conversationId: activeConversationId,
      question: trimmed,
      statusLabel: submittingLabel,
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
        setActiveStream(prev =>
          prev?.attemptId === attemptId ? { ...prev, statusLabel: label } : prev,
        );
      },
      onMeta: meta => {
        if (meta.conversationId) {
          setConversationId(meta.conversationId);
        }
      },
      onSources: sources => {
        setActiveStream(prev => (prev?.attemptId === attemptId ? { ...prev, sources } : prev));
      },
      onDelta: deltaText => {
        setActiveStream(prev =>
          prev?.attemptId === attemptId ? { ...prev, text: prev.text + deltaText } : prev,
        );
      },
      onDone: response => {
        clearPersistedAskTurn();
        setActiveStream(null);
        if (response.conversationId) {
          setConversationId(response.conversationId);
        }
        onCompleted(attemptId, trimmed, response);
      },
      onError: (errState, errQuota) => {
        clearPersistedAskTurn();
        setActiveStream(null);
        onFailed(errState, errQuota);
      },
    });
  };

  return {
    conversationId,
    activeStream,
    isStreaming: activeStream !== null,
    startStreamingQa,
    cancelStream,
    resetConversation,
    restoreConversationId,
  };
}
