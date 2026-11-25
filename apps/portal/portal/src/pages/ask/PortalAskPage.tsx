import type {
  AskMode,
  AskResponse,
  AskServiceStatus,
  AskTurnState,
  PortalAskContent,
  QuotaStatus,
} from '@aklapper/core';
import { ActionFeedbackBanner, Separator, Tabs, TuiWindow, useHydrated } from '@aklapper/ui';
import { type FormEvent, type ReactNode, useEffect, useState, useSyncExternalStore } from 'react';

import { AskJdPanel, AskQaPanel } from './AskPanels';
import { AskHeaderBadge, AskQuotaMeter } from './AskResultCard';
import {
  buildRecoveringTurnState,
  clearPersistedAskTurn,
  generateAskAttemptId,
  getPersistedAskTurnStore,
  isPendingAskResult,
  type PortalAskActionResult,
  prependQaTranscriptEntry,
  type QaTranscriptEntry,
  type RecoveredErrorState,
  resolvePendingAskTurn,
  startAskTurnPolling,
  writePersistedAskTurn,
} from './askTurnRecovery';
import { useAskStreaming } from './useAskStreaming';

import styles from './PortalAskPage.module.css';

export type { PortalAskActionResult };

export interface PortalAskPageProps {
  instanceId?: string;
  content: PortalAskContent;
  quota: QuotaStatus;
  askStatus?: AskServiceStatus;
  askStatusSlot?: ReactNode;
  streamEndpoint?: string;
  actionResult?: PortalAskActionResult;
  isSubmitting: boolean;
  onSubmitAsk: (payload: {
    mode: AskMode;
    text: string;
    attemptId: string;
    conversationId?: string;
  }) => void;
  onClose: () => void;
}

export function PortalAskPage({
  instanceId,
  content,
  quota,
  askStatus,
  askStatusSlot,
  streamEndpoint,
  actionResult,
  isSubmitting,
  onSubmitAsk,
  onClose,
}: PortalAskPageProps) {
  const turnStore = getPersistedAskTurnStore(instanceId);
  const persistedTurn = useSyncExternalStore(
    turnStore.subscribe,
    turnStore.getSnapshot,
    turnStore.getServerSnapshot,
  );
  const isHydrated = useHydrated();
  const [activeTab, setActiveTab] = useState<AskMode>('qa');
  const [selectedLensId, setSelectedLensId] = useState<string>('');
  const [questionText, setQuestionText] = useState('');
  const [jdText, setJdText] = useState('');
  const [qaTranscript, setQaTranscript] = useState<readonly QaTranscriptEntry[]>([]);
  const [latestJdResult, setLatestJdResult] = useState<AskResponse | null>(null);
  const [polledTurnState, setPolledTurnState] = useState<AskTurnState | null>(null);
  const [polledQuota, setPolledQuota] = useState<QuotaStatus | null>(null);
  const [recoveredError, setRecoveredError] = useState<RecoveredErrorState | null>(null);
  const [dispatchedAttemptId, setDispatchedAttemptId] = useState<string | null>(null);
  const [settledPendingAttemptIds, setSettledPendingAttemptIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [lastRecordedResult, setLastRecordedResult] = useState<PortalAskActionResult | undefined>(
    undefined,
  );

  const {
    conversationId,
    activeStream,
    failedStreamSources,
    isStreaming,
    startStreamingQa,
    cancelStream,
    resetConversation,
    restoreConversationId,
  } = useAskStreaming({
    instanceId,
    streamEndpoint,
    submittingLabel: content.streamingQaLabel,
    onDispatched: attemptId => {
      setDispatchedAttemptId(attemptId);
      setRecoveredError(null);
    },
    onCompleted: (attemptId, question, response) => {
      setQuestionText('');
      if (response.quota) setPolledQuota(response.quota);
      setQaTranscript(prev => prependQaTranscriptEntry(prev, attemptId, question, response));
    },
    onFailed: (errState, errQuota) => {
      if (errQuota) setPolledQuota(errQuota);
      setRecoveredError(errState);
    },
  });

  // Sync settled or 202 pending fetcher results during render without an extra effect pass.
  if (actionResult && actionResult !== lastRecordedResult) {
    setLastRecordedResult(actionResult);
    setRecoveredError(null);
    if (actionResult.ok && isPendingAskResult(actionResult)) {
      setPolledTurnState(actionResult.turnState);
      setPolledQuota(null);
    } else if (actionResult.ok && !isPendingAskResult(actionResult)) {
      setPolledTurnState(null);
      setPolledQuota(null);
      if (actionResult.mode === 'qa') {
        const entryId = actionResult.attemptId ?? `qa-${qaTranscript.length + 1}`;
        setQaTranscript(prev =>
          prependQaTranscriptEntry(
            prev,
            entryId,
            actionResult.submittedText,
            actionResult.response,
          ),
        );
      } else {
        setLatestJdResult(actionResult.response);
      }
    } else if (!actionResult.ok) {
      setPolledTurnState(null);
      setPolledQuota(null);
    }
  }

  const pendingActionResult =
    isPendingAskResult(actionResult) && !settledPendingAttemptIds.has(actionResult.attemptId)
      ? actionResult
      : undefined;
  const actionSettled = Boolean(actionResult && !isPendingAskResult(actionResult));
  useEffect(() => {
    if (actionSettled) clearPersistedAskTurn(instanceId);
  }, [actionSettled, actionResult, instanceId]);

  // Recover sessionStorage turns strictly from prior mounts; same-mount dispatches manage their own lifecycle.
  const {
    hasPendingTurn,
    attemptId: pendingAttemptId,
    mode: pendingMode,
    submittedText: pendingSubmittedText,
    pollImmediately,
  } = resolvePendingAskTurn({
    pendingActionResult,
    persistedTurn,
    instanceId,
    dispatchedAttemptId,
    settledPendingAttemptIds,
    isSubmitting,
    hasActiveStream: Boolean(activeStream),
    actionSettled,
  });

  const markPendingAttemptSettled = (attemptId: string) => {
    setSettledPendingAttemptIds(prev =>
      prev.has(attemptId) ? prev : new Set(prev).add(attemptId),
    );
  };

  // Poll /api/ask/turns/:attemptId while an async 202 or sessionStorage-recovered turn is active.
  useEffect(() => {
    if (!pendingAttemptId || !pendingMode || pendingSubmittedText === undefined) return;
    return startAskTurnPolling({
      attemptId: pendingAttemptId,
      pollImmediately,
      ownerInstanceId: instanceId,
      onPending: state => setPolledTurnState(state),
      onSettled: state => {
        markPendingAttemptSettled(pendingAttemptId);
        setPolledTurnState(null);
        setActiveTab(pendingMode);
        if (!state.response) return;
        const settled = state.response;
        setPolledQuota(settled.quota ?? null);
        setRecoveredError(null);
        if (state.mode === 'qa') {
          restoreConversationId(state.conversationId ?? settled.conversationId);
          setQaTranscript(prev =>
            prependQaTranscriptEntry(prev, pendingAttemptId, pendingSubmittedText, settled),
          );
        } else {
          setLatestJdResult(settled);
        }
      },
      onError: outcome => {
        markPendingAttemptSettled(pendingAttemptId);
        setPolledTurnState(null);
        if (outcome.quota) setPolledQuota(outcome.quota);
        setActiveTab(pendingMode);
        setRecoveredError({
          ok: false,
          mode: pendingMode,
          error: outcome.message,
          code: outcome.code,
          action: outcome.action,
          correlationId: outcome.correlationId,
        });
      },
    });
  }, [
    instanceId,
    pendingAttemptId,
    pendingMode,
    pendingSubmittedText,
    pollImmediately,
    restoreConversationId,
  ]);

  const actionQuota = actionResult?.ok
    ? pendingActionResult
      ? pendingActionResult.turnState.quota
      : isPendingAskResult(actionResult)
        ? undefined
        : actionResult.response.quota
    : actionResult?.quota;
  const activeQuota = polledQuota ?? actionQuota ?? quota;

  const visibleTab = hasPendingTurn && pendingMode ? pendingMode : activeTab;
  const visiblePendingTurnState =
    hasPendingTurn && pendingAttemptId && pendingMode
      ? polledTurnState?.attemptId === pendingAttemptId
        ? polledTurnState
        : pendingActionResult
          ? pendingActionResult.turnState
          : buildRecoveringTurnState(pendingAttemptId, pendingMode)
      : null;

  const latestResponse =
    visibleTab === 'jd_match'
      ? latestJdResult
      : (qaTranscript[0]?.response ??
        (actionResult?.ok && !isPendingAskResult(actionResult) ? actionResult.response : null));

  const isBusy = isSubmitting || hasPendingTurn || isStreaming;
  const activeError = recoveredError ?? (actionResult && !actionResult.ok ? actionResult : null);

  const activeLens = selectedLensId
    ? content.visitorLenses.find(lens => lens.id === selectedLensId)
    : undefined;
  const visibleStarters =
    activeLens && activeLens.starterQuestions.length > 0
      ? activeLens.starterQuestions
      : content.starterQuestions;

  const handleNewConversation = () => {
    resetConversation();
    setQaTranscript([]);
    setRecoveredError(null);
    setQuestionText('');
  };

  const dispatchUnaryTurn = (mode: AskMode, text: string) => {
    const attemptId = generateAskAttemptId();
    setDispatchedAttemptId(attemptId);
    writePersistedAskTurn({
      attemptId,
      mode,
      question: text,
      ...(instanceId ? { ownerInstanceId: instanceId } : {}),
    });
    setRecoveredError(null);
    onSubmitAsk({ mode, text, attemptId });
  };

  const handleQaSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = questionText.trim();
    if (trimmed.length < 4 || trimmed.length > 800 || isBusy) return;
    if (streamEndpoint) {
      startStreamingQa(trimmed, activeLens?.id);
    } else {
      dispatchUnaryTurn('qa', trimmed);
    }
  };

  const handleJdSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = jdText.trim();
    if (trimmed.length < 20 || trimmed.length > 8000 || isBusy) return;
    dispatchUnaryTurn('jd_match', trimmed);
  };

  return (
    <div
      className={styles.workspace}
      data-testid='ask-workspace'
      data-hydrated={isHydrated ? 'true' : 'false'}
      data-conversation-id={conversationId}
    >
      <TuiWindow
        title={content.windowTitle}
        onClose={onClose}
        badge={
          <AskHeaderBadge
            content={content}
            isBusy={isBusy}
            latestResponse={latestResponse}
            askStatus={askStatus}
            askStatusSlot={askStatusSlot}
          />
        }
      >
        <p className={styles.intro}>{content.description}</p>
        <p className={styles.notice}>{content.abstentionNotice}</p>

        <AskQuotaMeter quota={activeQuota} />

        <Separator.Root />

        {activeError && (
          <ActionFeedbackBanner
            ok={false}
            message={activeError.error}
            action={activeError.action}
            code={activeError.code}
            correlationId={activeError.correlationId}
            testId='ask-error-banner'
          />
        )}

        <Tabs.Root
          value={visibleTab}
          onValueChange={val => setActiveTab(val === 'jd_match' ? 'jd_match' : 'qa')}
        >
          <Tabs.List>
            <Tabs.Tab value='qa' data-testid='ask-tab-qa'>
              {content.qaTabLabel}
            </Tabs.Tab>
            <Tabs.Tab value='jd_match' data-testid='ask-tab-jd'>
              {content.jdTabLabel}
            </Tabs.Tab>
            <Tabs.Indicator />
          </Tabs.List>

          <Tabs.Panel value='qa' className={styles.panel}>
            <AskQaPanel
              content={content}
              activeLensId={activeLens?.id}
              visibleStarters={visibleStarters}
              questionText={questionText}
              isBusy={isBusy}
              isStreaming={isStreaming}
              activeStream={activeStream}
              failedStreamSources={failedStreamSources}
              visiblePendingTurnState={pendingMode === 'qa' ? visiblePendingTurnState : null}
              pendingSubmittedText={pendingSubmittedText}
              qaTranscript={qaTranscript}
              onSelectLens={setSelectedLensId}
              onSelectStarter={setQuestionText}
              onChangeQuestion={setQuestionText}
              onSubmitQa={handleQaSubmit}
              onCancelStream={cancelStream}
              onNewConversation={handleNewConversation}
              onSelectFollowUp={followUp => {
                if (streamEndpoint && !isBusy) {
                  startStreamingQa(followUp, activeLens?.id);
                } else {
                  setQuestionText(followUp);
                }
              }}
            />
          </Tabs.Panel>

          <Tabs.Panel value='jd_match' className={styles.panel}>
            <AskJdPanel
              content={content}
              jdText={jdText}
              isBusy={isBusy}
              visiblePendingTurnState={pendingMode === 'jd_match' ? visiblePendingTurnState : null}
              pendingSubmittedText={pendingSubmittedText}
              latestJdResult={latestJdResult}
              onChangeJd={setJdText}
              onSubmitJd={handleJdSubmit}
            />
          </Tabs.Panel>
        </Tabs.Root>
      </TuiWindow>
    </div>
  );
}
