import type {
  AskMode,
  AskResponse,
  AskServiceStatus,
  AskTurnState,
  PortalAskContent,
  QuotaStatus,
} from '@aklapper/core';
import {
  ActionFeedbackBanner,
  Button,
  Input,
  OscStatusBadge,
  Separator,
  Tabs,
  TuiWindow,
} from '@aklapper/ui';
import { type FormEvent, useEffect, useState, useSyncExternalStore } from 'react';

import {
  AskJdResultCard,
  AskPendingCard,
  AskQaTranscriptCard,
  AskQuotaMeter,
  AskStarterRow,
  resolveAskBadgeStatus,
} from './AskResultCard';
import {
  buildRecoveringTurnState,
  clearPersistedAskTurn,
  generateAskAttemptId,
  isPendingAskResult,
  type PortalAskActionResult,
  prependQaTranscriptEntry,
  type QaTranscriptEntry,
  readPersistedAskTurn,
  type RecoveredErrorState,
  startAskTurnPolling,
  subscribePersistedAskTurn,
  writePersistedAskTurn,
} from './askTurnRecovery';

import styles from './PortalAskPage.module.css';

export type { PortalAskActionResult };

const subscribeAskHydrated = () => () => undefined;
const getClientAskHydrated = () => true;
const getServerAskHydrated = () => false;

export interface PortalAskPageProps {
  content: PortalAskContent;
  quota: QuotaStatus;
  askStatus?: AskServiceStatus;
  actionResult?: PortalAskActionResult;
  isSubmitting: boolean;
  onSubmitAsk: (payload: { mode: AskMode; text: string; attemptId: string }) => void;
  onClose: () => void;
}

export function PortalAskPage({
  content,
  quota,
  askStatus,
  actionResult,
  isSubmitting,
  onSubmitAsk,
  onClose,
}: PortalAskPageProps) {
  const persistedTurn = useSyncExternalStore(
    subscribePersistedAskTurn,
    readPersistedAskTurn,
    () => null,
  );
  const isHydrated = useSyncExternalStore(
    subscribeAskHydrated,
    getClientAskHydrated,
    getServerAskHydrated,
  );
  const [activeTab, setActiveTab] = useState<AskMode>('qa');
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
    if (actionSettled) clearPersistedAskTurn();
  }, [actionSettled, actionResult]);

  // Only recover sessionStorage turns from prior mounts; same-mount dispatches wait for POST 202.
  const isRecoveredTurn =
    persistedTurn !== null &&
    persistedTurn.attemptId !== dispatchedAttemptId &&
    !settledPendingAttemptIds.has(persistedTurn.attemptId) &&
    !isSubmitting &&
    !actionSettled;
  const hasPendingTurn = Boolean(pendingActionResult) || isRecoveredTurn;
  const pendingAttemptId = pendingActionResult
    ? pendingActionResult.attemptId
    : isRecoveredTurn
      ? persistedTurn.attemptId
      : undefined;
  const pendingMode = pendingActionResult
    ? pendingActionResult.mode
    : isRecoveredTurn
      ? persistedTurn.mode
      : undefined;
  const pendingSubmittedText = pendingActionResult
    ? pendingActionResult.submittedText
    : isRecoveredTurn
      ? persistedTurn.question
      : undefined;
  const pollImmediately = hasPendingTurn && !pendingActionResult;

  const markPendingAttemptSettled = (attemptId: string) => {
    setSettledPendingAttemptIds(prev => {
      if (prev.has(attemptId)) return prev;
      const next = new Set(prev);
      next.add(attemptId);
      return next;
    });
  };

  // Poll /api/ask/turns/:attemptId while an async 202 or sessionStorage-recovered turn is active.
  useEffect(() => {
    if (!pendingAttemptId || !pendingMode || pendingSubmittedText === undefined) return;
    return startAskTurnPolling({
      attemptId: pendingAttemptId,
      pollImmediately,
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
  }, [pendingAttemptId, pendingMode, pendingSubmittedText, pollImmediately]);

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
    actionResult?.ok && !isPendingAskResult(actionResult)
      ? actionResult.response
      : visibleTab === 'jd_match'
        ? latestJdResult
        : (qaTranscript[0]?.response ?? null);

  const isBusy = isSubmitting || hasPendingTurn;
  const badge = resolveAskBadgeStatus(content, isBusy, latestResponse, askStatus);
  const activeError = recoveredError ?? (actionResult && !actionResult.ok ? actionResult : null);

  const dispatchTurn = (mode: AskMode, text: string) => {
    const attemptId = generateAskAttemptId();
    setDispatchedAttemptId(attemptId);
    writePersistedAskTurn({ attemptId, mode, question: text });
    setRecoveredError(null);
    onSubmitAsk({ mode, text, attemptId });
  };

  const handleQaSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = questionText.trim();
    if (trimmed.length < 4 || trimmed.length > 800 || isBusy) return;
    dispatchTurn('qa', trimmed);
  };

  const handleJdSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = jdText.trim();
    if (trimmed.length < 20 || trimmed.length > 8000 || isBusy) return;
    dispatchTurn('jd_match', trimmed);
  };

  return (
    <div
      className={styles.workspace}
      data-testid='ask-workspace'
      data-hydrated={isHydrated ? 'true' : 'false'}
    >
      <TuiWindow
        title={content.windowTitle}
        onClose={onClose}
        badge={
          <OscStatusBadge
            source={content.statusBadge.source}
            state={badge.state}
            label={badge.label}
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
              Ask Portfolio
            </Tabs.Tab>
            <Tabs.Tab value='jd_match' data-testid='ask-tab-jd'>
              JD Match
            </Tabs.Tab>
            <Tabs.Indicator />
          </Tabs.List>

          <Tabs.Panel value='qa' className={styles.panel}>
            <AskStarterRow questions={content.starterQuestions} onSelect={setQuestionText} />

            <form className={styles.form} onSubmit={handleQaSubmit}>
              <Input.Group className={styles.inputGroup}>
                <Input.Prefix aria-hidden='true'>?</Input.Prefix>
                <Input.Root
                  type='text'
                  name='question'
                  maxLength={800}
                  value={questionText}
                  onChange={event => setQuestionText(event.currentTarget.value)}
                  placeholder='Ask a grounded question about architecture, Go services, or published skills...'
                  aria-label='Portfolio question'
                  data-testid='ask-question-input'
                />
              </Input.Group>
              <div className={styles.actions}>
                <Button
                  type='submit'
                  variant='primary'
                  disabled={isBusy || questionText.trim().length < 4}
                  data-testid='ask-qa-submit'
                >
                  <Button.Label>{isBusy ? 'Querying Corpus...' : 'Ask Portfolio'}</Button.Label>
                </Button>
              </div>
            </form>

            {visiblePendingTurnState && pendingMode === 'qa' && pendingSubmittedText && (
              <AskPendingCard
                turnState={visiblePendingTurnState}
                submittedText={pendingSubmittedText}
              />
            )}

            {qaTranscript.length > 0 && (
              <ol className={styles.transcript} data-testid='ask-qa-transcript'>
                {qaTranscript.map(entry => (
                  <AskQaTranscriptCard
                    key={entry.id}
                    question={entry.question}
                    response={entry.response}
                  />
                ))}
              </ol>
            )}
          </Tabs.Panel>

          <Tabs.Panel value='jd_match' className={styles.panel}>
            <form className={styles.form} onSubmit={handleJdSubmit}>
              <label className={styles.textareaLabel} htmlFor='jd-match-textarea'>
                Job Description (min 20 characters, max 8000 characters)
              </label>
              <textarea
                id='jd-match-textarea'
                name='jobDescription'
                className={styles.textarea}
                rows={6}
                maxLength={8000}
                value={jdText}
                onChange={event => setJdText(event.currentTarget.value)}
                placeholder={content.jdPlaceholder}
                data-testid='ask-jd-textarea'
              />
              <div className={styles.actions}>
                <Button
                  type='submit'
                  variant='primary'
                  disabled={isBusy || jdText.trim().length < 20}
                  data-testid='ask-jd-submit'
                >
                  <Button.Label>{isBusy ? 'Evaluating Fit...' : 'Analyze JD Fit'}</Button.Label>
                </Button>
              </div>
            </form>

            {visiblePendingTurnState && pendingMode === 'jd_match' && pendingSubmittedText && (
              <AskPendingCard
                turnState={visiblePendingTurnState}
                submittedText={pendingSubmittedText}
              />
            )}

            {latestJdResult && <AskJdResultCard response={latestJdResult} />}
          </Tabs.Panel>
        </Tabs.Root>
      </TuiWindow>
    </div>
  );
}
