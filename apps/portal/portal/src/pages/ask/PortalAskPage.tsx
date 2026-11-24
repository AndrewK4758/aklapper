import type {
  ActionErrorMetadata,
  AskMode,
  AskResponse,
  AskServiceStatus,
  AskTurnState,
  Osc7501State,
  PortalAskContent,
  QuotaStatus,
} from '@aklapper/core';
import {
  ActionFeedbackBanner,
  Button,
  Input,
  Meter,
  OscStatusBadge,
  Separator,
  Tabs,
  TuiWindow,
} from '@aklapper/ui';
import { type FormEvent, useEffect, useState, useSyncExternalStore } from 'react';

import { AskJdResultCard, AskPendingCard, AskQaTranscriptCard } from './AskResultCard';
import {
  buildRecoveringTurnState,
  clearPersistedAskTurn,
  generateAskAttemptId,
  readPersistedAskTurn,
  startAskTurnPolling,
  subscribePersistedAskTurn,
  writePersistedAskTurn,
} from './askTurnRecovery';

import styles from './PortalAskPage.module.css';

export type PortalAskActionResult =
  | {
      readonly ok: true;
      readonly pending?: false;
      readonly mode: AskMode;
      readonly submittedText: string;
      readonly attemptId?: string;
      readonly response: AskResponse;
    }
  | {
      readonly ok: true;
      readonly pending: true;
      readonly mode: AskMode;
      readonly submittedText: string;
      readonly attemptId: string;
      readonly turnState: AskTurnState;
    }
  | ({
      readonly ok: false;
      readonly mode: AskMode;
      readonly error: string;
      readonly quota?: QuotaStatus;
    } & ActionErrorMetadata);

export interface PortalAskPageProps {
  content: PortalAskContent;
  quota: QuotaStatus;
  askStatus?: AskServiceStatus;
  actionResult?: PortalAskActionResult;
  isSubmitting: boolean;
  onSubmitAsk: (payload: { mode: AskMode; text: string; attemptId: string }) => void;
  onClose: () => void;
}

interface QaTranscriptEntry {
  readonly id: string;
  readonly question: string;
  readonly response: AskResponse;
}

type RecoveredErrorState = {
  readonly ok: false;
  readonly mode: AskMode;
  readonly error: string;
} & ActionErrorMetadata;

function isPendingResult(
  result: PortalAskActionResult | undefined,
): result is Extract<PortalAskActionResult, { readonly pending: true }> {
  return Boolean(result && result.ok && 'pending' in result && result.pending === true);
}

function resolveBadgeStatus(
  content: PortalAskContent,
  isBusy: boolean,
  latestResponse: AskResponse | null,
  askStatus?: AskServiceStatus,
): { state: Osc7501State; label: string } {
  if (isBusy) return { state: 'scaling', label: 'waking · querying corpus' };
  if (latestResponse) {
    return latestResponse.grounded
      ? { state: 'ready', label: `grounded · ${latestResponse.sources.length} source(s)` }
      : { state: 'gate', label: 'abstained · strict grounding' };
  }
  if (askStatus) {
    if (askStatus.status === 'ready') {
      return { state: 'ready', label: `ready · ${askStatus.pointsCount} pts` };
    }
    if (askStatus.status === 'degraded') {
      return { state: 'gate', label: 'degraded · empty corpus' };
    }
    return { state: 'error', label: 'offline · upstream unreachable' };
  }
  return { state: content.statusBadge.state, label: content.statusBadge.label };
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
  const [activeTab, setActiveTab] = useState<AskMode>('qa');
  const [questionText, setQuestionText] = useState('');
  const [jdText, setJdText] = useState('');
  const [qaTranscript, setQaTranscript] = useState<readonly QaTranscriptEntry[]>([]);
  const [latestJdResult, setLatestJdResult] = useState<AskResponse | null>(null);
  const [polledTurnState, setPolledTurnState] = useState<AskTurnState | null>(null);
  const [polledQuota, setPolledQuota] = useState<QuotaStatus | null>(null);
  const [recoveredError, setRecoveredError] = useState<RecoveredErrorState | null>(null);
  const [lastRecordedResult, setLastRecordedResult] = useState<PortalAskActionResult | undefined>(
    undefined,
  );

  // Sync settled or 202 pending fetcher results during render without an extra effect pass.
  if (actionResult && actionResult !== lastRecordedResult) {
    setLastRecordedResult(actionResult);
    setRecoveredError(null);
    if (actionResult.ok && isPendingResult(actionResult)) {
      setPolledTurnState(actionResult.turnState);
    } else if (actionResult.ok && !isPendingResult(actionResult)) {
      setPolledTurnState(null);
      setPolledQuota(null);
      if (actionResult.mode === 'qa') {
        const entryId = actionResult.attemptId ?? `qa-${qaTranscript.length + 1}`;
        setQaTranscript(prev =>
          prev.some(item => item.id === entryId)
            ? prev
            : [
                {
                  id: entryId,
                  question: actionResult.submittedText,
                  response: actionResult.response,
                },
                ...prev,
              ],
        );
      } else {
        setLatestJdResult(actionResult.response);
      }
    } else if (!actionResult.ok) {
      setPolledTurnState(null);
    }
  }

  const actionSettled = Boolean(actionResult && !isPendingResult(actionResult));
  useEffect(() => {
    if (actionSettled) clearPersistedAskTurn();
  }, [actionSettled]);

  const hasPendingTurn =
    isPendingResult(actionResult) || (persistedTurn !== null && !isSubmitting && !actionSettled);
  const pendingAttemptId = isPendingResult(actionResult)
    ? actionResult.attemptId
    : hasPendingTurn && persistedTurn
      ? persistedTurn.attemptId
      : undefined;
  const pendingMode = isPendingResult(actionResult)
    ? actionResult.mode
    : hasPendingTurn && persistedTurn
      ? persistedTurn.mode
      : undefined;
  const pendingSubmittedText = isPendingResult(actionResult)
    ? actionResult.submittedText
    : hasPendingTurn && persistedTurn
      ? persistedTurn.question
      : undefined;
  const pollImmediately = hasPendingTurn && !isPendingResult(actionResult);

  // Poll /api/ask/turns/:attemptId while an async 202 or sessionStorage-recovered turn is active.
  useEffect(() => {
    if (!pendingAttemptId || !pendingMode || pendingSubmittedText === undefined) return;
    return startAskTurnPolling({
      attemptId: pendingAttemptId,
      pollImmediately,
      onPending: state => setPolledTurnState(state),
      onSettled: state => {
        setPolledTurnState(null);
        setActiveTab(pendingMode);
        if (!state.response) return;
        const settled = state.response;
        setPolledQuota(settled.quota ?? null);
        setRecoveredError(null);
        if (state.mode === 'qa') {
          setQaTranscript(prev =>
            prev.some(item => item.id === pendingAttemptId)
              ? prev
              : [
                  { id: pendingAttemptId, question: pendingSubmittedText, response: settled },
                  ...prev,
                ],
          );
        } else {
          setLatestJdResult(settled);
        }
      },
      onError: outcome => {
        setPolledTurnState(null);
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

  const activeQuota =
    polledQuota ??
    (actionResult?.ok && !isPendingResult(actionResult) && actionResult.response.quota
      ? actionResult.response.quota
      : actionResult?.ok && isPendingResult(actionResult) && actionResult.turnState.quota
        ? actionResult.turnState.quota
        : !actionResult?.ok && actionResult?.quota
          ? actionResult.quota
          : quota);

  const visibleTab = hasPendingTurn && pendingMode ? pendingMode : activeTab;
  const visiblePendingTurnState =
    hasPendingTurn && pendingAttemptId && pendingMode
      ? polledTurnState?.attemptId === pendingAttemptId
        ? polledTurnState
        : isPendingResult(actionResult)
          ? actionResult.turnState
          : buildRecoveringTurnState(pendingAttemptId, pendingMode)
      : null;

  const latestResponse =
    actionResult?.ok && !isPendingResult(actionResult)
      ? actionResult.response
      : visibleTab === 'jd_match'
        ? latestJdResult
        : (qaTranscript[0]?.response ?? null);

  const isBusy = isSubmitting || hasPendingTurn;
  const badge = resolveBadgeStatus(content, isBusy, latestResponse, askStatus);
  const activeError = recoveredError ?? (actionResult && !actionResult.ok ? actionResult : null);

  const dispatchTurn = (mode: AskMode, text: string) => {
    const attemptId = generateAskAttemptId();
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
    <div className={styles.workspace}>
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

        <div className={styles.quotaBar} data-testid='ask-quota-meter'>
          <Meter.Root value={activeQuota.turnsUsed} min={0} max={Math.max(1, activeQuota.maxTurns)}>
            <div className={styles.meterHeader}>
              <Meter.Label>Session Quota ({activeQuota.role})</Meter.Label>
              <Meter.Value>
                {() => `${activeQuota.turnsUsed}/${activeQuota.maxTurns} turns`}
              </Meter.Value>
            </div>
            <Meter.Track>
              <Meter.Indicator />
            </Meter.Track>
          </Meter.Root>
        </div>

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
            <div className={styles.starterRow} aria-label='Starter questions'>
              {content.starterQuestions.map((starter, idx) => (
                <Button
                  key={starter}
                  type='button'
                  variant='ghost'
                  size='xs'
                  onClick={() => setQuestionText(starter)}
                  data-testid={`ask-starter-${idx}`}
                >
                  <Button.Label>{starter}</Button.Label>
                </Button>
              ))}
            </div>

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
