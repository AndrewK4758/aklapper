import type {
  ActionErrorMetadata,
  AskMode,
  AskResponse,
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
import { type FormEvent, useState } from 'react';

import styles from './PortalAskPage.module.css';

export type PortalAskActionResult =
  | {
      readonly ok: true;
      readonly mode: AskMode;
      readonly submittedText: string;
      readonly response: AskResponse;
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
  actionResult?: PortalAskActionResult;
  isSubmitting: boolean;
  onSubmitAsk: (payload: { mode: AskMode; text: string }) => void;
  onClose: () => void;
}

interface QaTranscriptEntry {
  readonly id: string;
  readonly question: string;
  readonly response: AskResponse;
}

function resolveBadgeStatus(
  content: PortalAskContent,
  isSubmitting: boolean,
  latestResponse: AskResponse | null,
): { state: Osc7501State; label: string } {
  if (isSubmitting) {
    return { state: 'scaling', label: 'waking · querying corpus' };
  }
  if (!latestResponse) {
    return { state: content.statusBadge.state, label: content.statusBadge.label };
  }
  if (latestResponse.grounded) {
    return { state: 'ready', label: `grounded · ${latestResponse.sources.length} source(s)` };
  }
  return { state: 'gate', label: 'abstained · strict grounding' };
}

export function PortalAskPage({
  content,
  quota,
  actionResult,
  isSubmitting,
  onSubmitAsk,
  onClose,
}: PortalAskPageProps) {
  const [activeTab, setActiveTab] = useState<AskMode>('qa');
  const [questionText, setQuestionText] = useState('');
  const [jdText, setJdText] = useState('');
  const [qaTranscript, setQaTranscript] = useState<readonly QaTranscriptEntry[]>([]);
  const [latestJdResult, setLatestJdResult] = useState<AskResponse | null>(null);
  const [lastRecordedResult, setLastRecordedResult] = useState<PortalAskActionResult | undefined>(
    undefined,
  );

  // Sync completed fetcher results during render (no useEffect).
  if (actionResult && actionResult !== lastRecordedResult) {
    setLastRecordedResult(actionResult);
    if (actionResult.ok) {
      if (actionResult.mode === 'qa') {
        setQaTranscript(prev => [
          {
            id: `qa-${prev.length + 1}`,
            question: actionResult.submittedText,
            response: actionResult.response,
          },
          ...prev,
        ]);
      } else {
        setLatestJdResult(actionResult.response);
      }
    }
  }

  const activeQuota =
    actionResult?.ok && actionResult.response.quota
      ? actionResult.response.quota
      : !actionResult?.ok && actionResult?.quota
        ? actionResult.quota
        : quota;

  const latestResponse = actionResult?.ok
    ? actionResult.response
    : activeTab === 'jd_match'
      ? latestJdResult
      : (qaTranscript[0]?.response ?? null);

  const badge = resolveBadgeStatus(content, isSubmitting, latestResponse);

  const handleQaSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = questionText.trim();
    if (trimmed.length < 4 || isSubmitting) return;
    onSubmitAsk({ mode: 'qa', text: trimmed });
  };

  const handleJdSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = jdText.trim();
    if (trimmed.length < 20 || isSubmitting) return;
    onSubmitAsk({ mode: 'jd_match', text: trimmed });
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

        {actionResult && !actionResult.ok && (
          <ActionFeedbackBanner
            ok={false}
            message={actionResult.error}
            action={actionResult.action}
            code={actionResult.code}
            correlationId={actionResult.correlationId}
            testId='ask-error-banner'
          />
        )}

        <Tabs.Root
          value={activeTab}
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
                  disabled={isSubmitting || questionText.trim().length < 4}
                  data-testid='ask-qa-submit'
                >
                  <Button.Label>
                    {isSubmitting ? 'Querying Corpus...' : 'Ask Portfolio'}
                  </Button.Label>
                </Button>
              </div>
            </form>

            {qaTranscript.length > 0 && (
              <ol className={styles.transcript} data-testid='ask-qa-transcript'>
                {qaTranscript.map(entry => (
                  <li key={entry.id} className={styles.entryCard} data-testid='ask-qa-entry'>
                    <div className={styles.entryHeader}>
                      <strong className={styles.entryQuestion}>Q: {entry.question}</strong>
                      <span
                        className={styles.groundingPill}
                        data-grounded={entry.response.grounded ? 'true' : 'false'}
                      >
                        {entry.response.grounded ? 'GROUNDED' : 'ABSTAINED'}
                      </span>
                    </div>
                    <p className={styles.answerText}>{entry.response.answer}</p>
                    <p className={styles.metaLine}>
                      provider: {entry.response.provider} · tokens: {entry.response.tokensUsed}
                    </p>
                    {entry.response.sources.length > 0 && (
                      <ul className={styles.citations} aria-label='Grounded citations'>
                        {entry.response.sources.map(source => (
                          <li key={source.id} className={styles.citationCard}>
                            <div className={styles.citationHeader}>
                              <strong>{source.title}</strong>
                              <span className={styles.citationScore}>
                                {source.category} · {Math.round(source.score * 100)}%
                              </span>
                            </div>
                            <p className={styles.citationSnippet}>{source.snippet}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Tabs.Panel>

          <Tabs.Panel value='jd_match' className={styles.panel}>
            <form className={styles.form} onSubmit={handleJdSubmit}>
              <label className={styles.textareaLabel} htmlFor='jd-match-textarea'>
                Job Description (min 20 characters)
              </label>
              <textarea
                id='jd-match-textarea'
                name='jobDescription'
                className={styles.textarea}
                rows={6}
                value={jdText}
                onChange={event => setJdText(event.currentTarget.value)}
                placeholder={content.jdPlaceholder}
                data-testid='ask-jd-textarea'
              />
              <div className={styles.actions}>
                <Button
                  type='submit'
                  variant='primary'
                  disabled={isSubmitting || jdText.trim().length < 20}
                  data-testid='ask-jd-submit'
                >
                  <Button.Label>
                    {isSubmitting ? 'Evaluating Fit...' : 'Analyze JD Fit'}
                  </Button.Label>
                </Button>
              </div>
            </form>

            {latestJdResult && (
              <section className={styles.entryCard} data-testid='ask-jd-result'>
                <div className={styles.entryHeader}>
                  <strong className={styles.entryQuestion}>JD Fit Assessment</strong>
                  <span
                    className={styles.groundingPill}
                    data-grounded={latestJdResult.grounded ? 'true' : 'false'}
                  >
                    {latestJdResult.grounded ? 'GROUNDED' : 'ABSTAINED'}
                  </span>
                </div>

                {typeof latestJdResult.matchScore === 'number' && (
                  <Meter.Root value={latestJdResult.matchScore} min={0} max={100}>
                    <div className={styles.meterHeader}>
                      <Meter.Label>Grounded Match Score</Meter.Label>
                      <Meter.Value>{() => `${latestJdResult.matchScore ?? 0}%`}</Meter.Value>
                    </div>
                    <Meter.Track>
                      <Meter.Indicator />
                    </Meter.Track>
                  </Meter.Root>
                )}

                <p className={styles.answerText}>{latestJdResult.answer}</p>

                <div className={styles.jdGrid}>
                  <div className={styles.jdColumn}>
                    <h3 className={styles.jdSubhead}>Verified Strengths</h3>
                    <ul className={styles.jdList}>
                      {(latestJdResult.strengths ?? []).length > 0 ? (
                        (latestJdResult.strengths ?? []).map(item => <li key={item}>{item}</li>)
                      ) : (
                        <li>No grounded overlap detected.</li>
                      )}
                    </ul>
                  </div>
                  <div className={styles.jdColumn}>
                    <h3 className={styles.jdSubhead}>Gaps / Unverified</h3>
                    <ul className={styles.jdList}>
                      {(latestJdResult.gaps ?? []).length > 0 ? (
                        (latestJdResult.gaps ?? []).map(item => <li key={item}>{item}</li>)
                      ) : (
                        <li>No unverified gaps flagged.</li>
                      )}
                    </ul>
                  </div>
                </div>

                {latestJdResult.sources.length > 0 && (
                  <ul className={styles.citations} aria-label='JD Match citations'>
                    {latestJdResult.sources.map(source => (
                      <li key={source.id} className={styles.citationCard}>
                        <div className={styles.citationHeader}>
                          <strong>{source.title}</strong>
                          <span className={styles.citationScore}>
                            {source.category} · {Math.round(source.score * 100)}%
                          </span>
                        </div>
                        <p className={styles.citationSnippet}>{source.snippet}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </Tabs.Panel>
        </Tabs.Root>
      </TuiWindow>
    </div>
  );
}
