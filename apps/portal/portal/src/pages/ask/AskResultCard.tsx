import type {
  AskResponse,
  AskServiceStatus,
  AskTurnState,
  Osc7501State,
  PortalAskContent,
  QuotaStatus,
} from '@aklapper/core';
import { Button, Meter, OscStatusBadge } from '@aklapper/ui';
import type { ReactNode } from 'react';

import styles from './PortalAskPage.module.css';

export function resolveAskBadgeStatus(
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

export function AskHeaderBadge({
  content,
  isBusy,
  latestResponse,
  askStatus,
  askStatusSlot,
}: {
  readonly content: PortalAskContent;
  readonly isBusy: boolean;
  readonly latestResponse: AskResponse | null;
  readonly askStatus?: AskServiceStatus;
  readonly askStatusSlot?: ReactNode;
}): ReactNode {
  if (!isBusy && !latestResponse && askStatusSlot) {
    return askStatusSlot;
  }
  const badge = resolveAskBadgeStatus(content, isBusy, latestResponse, askStatus);
  return (
    <OscStatusBadge source={content.statusBadge.source} state={badge.state} label={badge.label} />
  );
}

export function AskStarterRow({
  questions,
  onSelect,
}: {
  readonly questions: readonly string[];
  readonly onSelect: (question: string) => void;
}) {
  return (
    <div className={styles.starterRow} aria-label='Starter questions'>
      {questions.map((starter, idx) => (
        <Button
          key={starter}
          type='button'
          variant='ghost'
          size='xs'
          onClick={() => onSelect(starter)}
          data-testid={`ask-starter-${idx}`}
        >
          <Button.Label>{starter}</Button.Label>
        </Button>
      ))}
    </div>
  );
}

export function AskQuotaMeter({ quota }: { readonly quota: QuotaStatus }) {
  return (
    <div className={styles.quotaBar} data-testid='ask-quota-meter'>
      <Meter.Root value={quota.turnsUsed} min={0} max={Math.max(1, quota.maxTurns)}>
        <div className={styles.meterHeader}>
          <Meter.Label>Session Quota ({quota.role})</Meter.Label>
          <Meter.Value>{() => `${quota.turnsUsed}/${quota.maxTurns} turns`}</Meter.Value>
        </div>
        <Meter.Track>
          <Meter.Indicator />
        </Meter.Track>
      </Meter.Root>
    </div>
  );
}

export interface AskPendingCardProps {
  readonly turnState: AskTurnState;
  readonly submittedText: string;
}

export function AskPendingCard({ turnState, submittedText }: AskPendingCardProps) {
  return (
    <output aria-live='polite' className={styles.entryCard} data-testid='ask-turn-pending'>
      <div className={styles.entryHeader}>
        <strong className={styles.entryQuestion}>
          {turnState.mode === 'jd_match'
            ? 'JD Fit Assessment (In Progress)'
            : `Q: ${submittedText}`}
        </strong>
        <span className={styles.groundingPill} data-grounded='false'>
          {turnState.status.toUpperCase()}
        </span>
      </div>
      <p className={styles.answerText}>
        Retrieving portfolio evidence and synthesizing grounded response...
      </p>
      <p className={styles.metaLine}>
        attempt: {turnState.attemptId} · ref: {turnState.correlationId}
      </p>
    </output>
  );
}

function CitationList({
  sources,
  ariaLabel,
}: {
  readonly sources: AskResponse['sources'];
  readonly ariaLabel: string;
}) {
  if (sources.length === 0) return null;
  return (
    <ul className={styles.citations} aria-label={ariaLabel}>
      {sources.map(source => (
        <li key={source.id ?? source.title} className={styles.citationCard}>
          <div className={styles.citationHeader}>
            <strong>{source.title}</strong>
            <span className={styles.citationScore}>
              {source.category ?? 'corpus'} · {Math.round(source.score * 100)}%
            </span>
          </div>
          <p className={styles.citationSnippet}>{source.snippet}</p>
        </li>
      ))}
    </ul>
  );
}

function TelemetryLine({ response }: { readonly response: AskResponse }) {
  return (
    <p className={styles.metaLine} data-testid='ask-telemetry-line'>
      provider: {response.provider} · model: {response.model ?? 'default'} · tokens:{' '}
      {response.tokensUsed}
      {typeof response.latencyMs === 'number' ? ` · ${response.latencyMs}ms` : ''}
    </p>
  );
}

export function AskQaTranscriptCard({
  question,
  response,
}: {
  readonly question: string;
  readonly response: AskResponse;
}) {
  return (
    <li className={styles.entryCard} data-testid='ask-qa-entry'>
      <div className={styles.entryHeader}>
        <strong className={styles.entryQuestion}>Q: {question}</strong>
        <span className={styles.groundingPill} data-grounded={response.grounded ? 'true' : 'false'}>
          {response.grounded ? 'GROUNDED' : 'ABSTAINED'}
        </span>
      </div>
      <p className={styles.answerText}>{response.answer}</p>
      <TelemetryLine response={response} />
      <CitationList sources={response.sources} ariaLabel='Grounded citations' />
    </li>
  );
}

export function AskJdResultCard({ response }: { readonly response: AskResponse }) {
  return (
    <section className={styles.entryCard} data-testid='ask-jd-result'>
      <div className={styles.entryHeader}>
        <strong className={styles.entryQuestion}>JD Fit Assessment</strong>
        <span className={styles.groundingPill} data-grounded={response.grounded ? 'true' : 'false'}>
          {response.grounded ? 'GROUNDED' : 'ABSTAINED'}
        </span>
      </div>

      {typeof response.matchScore === 'number' && (
        <Meter.Root value={response.matchScore} min={0} max={100}>
          <div className={styles.meterHeader}>
            <Meter.Label>Grounded Match Score</Meter.Label>
            <Meter.Value>{() => `${response.matchScore ?? 0}%`}</Meter.Value>
          </div>
          <Meter.Track>
            <Meter.Indicator />
          </Meter.Track>
        </Meter.Root>
      )}

      <p className={styles.answerText}>{response.answer}</p>
      <TelemetryLine response={response} />

      <div className={styles.jdGrid}>
        <div className={styles.jdColumn}>
          <h3 className={styles.jdSubhead}>Verified Strengths</h3>
          <ul className={styles.jdList}>
            {(response.strengths ?? []).length > 0 ? (
              (response.strengths ?? []).map(item => <li key={item}>{item}</li>)
            ) : (
              <li>No grounded overlap detected.</li>
            )}
          </ul>
        </div>
        <div className={styles.jdColumn}>
          <h3 className={styles.jdSubhead}>Gaps / Unverified</h3>
          <ul className={styles.jdList}>
            {(response.gaps ?? []).length > 0 ? (
              (response.gaps ?? []).map(item => <li key={item}>{item}</li>)
            ) : (
              <li>No unverified gaps flagged.</li>
            )}
          </ul>
        </div>
      </div>

      <CitationList sources={response.sources} ariaLabel='JD Match citations' />
    </section>
  );
}
