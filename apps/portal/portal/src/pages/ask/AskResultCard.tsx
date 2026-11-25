import type {
  AskResponse,
  AskServiceStatus,
  AskTurnState,
  Osc7501State,
  PortalAskContent,
  QuotaStatus,
} from '@aklapper/core';
import {
  CitationSourceList,
  DeepLinkCardRow,
  Meter,
  OscStatusBadge,
  PaneLink,
  StatusPill,
  SuggestionChipRow,
} from '@aklapper/ui';
import type { ReactNode } from 'react';

import styles from './PortalAskPage.module.css';

function isGeneralConversationalResponse(response: AskResponse): boolean {
  return response.groundingTier === 'general' && !response.abstained;
}

export function resolveAskBadgeStatus(
  content: PortalAskContent,
  isBusy: boolean,
  latestResponse: AskResponse | null,
  askStatus?: AskServiceStatus,
): { state: Osc7501State; label: string } {
  if (isBusy) return { state: 'scaling', label: 'waking · querying corpus' };
  if (latestResponse) {
    if (isGeneralConversationalResponse(latestResponse)) {
      return { state: 'ready', label: 'general · conversational' };
    }
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
  disabled = false,
  onSelect,
}: {
  readonly questions: readonly string[];
  readonly disabled?: boolean;
  readonly onSelect: (question: string) => void;
}) {
  return (
    <SuggestionChipRow
      ariaLabel='Starter questions'
      disabled={disabled}
      testIdPrefix='ask-starter'
      items={questions.map((starter, idx) => ({ id: String(idx), label: starter }))}
      onSelect={item => onSelect(item.label)}
    />
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
        <span data-grounded='false'>
          <StatusPill tone='warn' size='sm' pulse>
            {turnState.status.toUpperCase()}
          </StatusPill>
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

function TelemetryLine({ response }: { readonly response: AskResponse }) {
  return (
    <p className={styles.metaLine} data-testid='ask-telemetry-line'>
      provider: {response.provider} · model: {response.model ?? 'default'} · tokens:{' '}
      {response.tokensUsed}
      {typeof response.latencyMs === 'number' ? ` · ${response.latencyMs}ms` : ''}
      {response.groundingTier ? ` · tier: ${response.groundingTier}` : ''}
    </p>
  );
}

function resolveTierLabel(response: AskResponse): string {
  if (isGeneralConversationalResponse(response)) return 'GENERAL';
  if (!response.grounded) return 'ABSTAINED';
  if (response.groundingTier === 'profile') return 'PROFILE · GROUNDED';
  return 'GROUNDED';
}

export function AskQaTranscriptCard({
  question,
  response,
  content,
  isBusy = false,
  onSelectFollowUp,
}: {
  readonly question: string;
  readonly response: AskResponse;
  readonly content: PortalAskContent;
  readonly isBusy?: boolean;
  readonly onSelectFollowUp?: (followUp: string) => void;
}) {
  const isGeneral = isGeneralConversationalResponse(response);
  const pillTone = response.grounded ? 'success' : isGeneral ? 'info' : 'warn';

  return (
    <li
      className={styles.entryCard}
      data-testid='ask-qa-entry'
      data-grounding-tier={response.groundingTier ?? (response.grounded ? 'evidence' : 'boundary')}
    >
      <div className={styles.entryHeader}>
        <strong className={styles.entryQuestion}>Q: {question}</strong>
        <span data-grounded={response.grounded ? 'true' : 'false'}>
          <StatusPill tone={pillTone} size='sm'>
            {resolveTierLabel(response)}
          </StatusPill>
        </span>
      </div>
      <p className={styles.answerText}>{response.answer}</p>
      {!response.grounded && !isGeneral && content.boundaryFallbackNotice ? (
        <p className={styles.notice}>{content.boundaryFallbackNotice}</p>
      ) : null}
      <TelemetryLine response={response} />
      <CitationSourceList heading={content.citationsHeading} sources={response.sources} />
      {response.suggestedLinks && response.suggestedLinks.length > 0 ? (
        <DeepLinkCardRow heading={content.suggestedLinksHeading} links={response.suggestedLinks} />
      ) : !response.grounded && !isGeneral ? (
        <div className={styles.ctaRow}>
          <PaneLink to={content.contactCtaHref} className={styles.ctaLink}>
            {content.contactCtaLabel}
          </PaneLink>
        </div>
      ) : null}
      {onSelectFollowUp && response.followUpQuestions && response.followUpQuestions.length > 0 ? (
        <SuggestionChipRow
          ariaLabel={content.followUpsHeading}
          disabled={isBusy}
          testIdPrefix='ask-followup'
          items={response.followUpQuestions.map((q, idx) => ({ id: String(idx), label: q }))}
          onSelect={item => onSelectFollowUp(item.label)}
        />
      ) : null}
    </li>
  );
}

export function AskJdResultCard({
  response,
  content,
}: {
  readonly response: AskResponse;
  readonly content: PortalAskContent;
}) {
  return (
    <section className={styles.entryCard} data-testid='ask-jd-result'>
      <div className={styles.entryHeader}>
        <strong className={styles.entryQuestion}>JD Fit Assessment</strong>
        <span data-grounded={response.grounded ? 'true' : 'false'}>
          <StatusPill tone={response.grounded ? 'success' : 'warn'} size='sm'>
            {response.grounded ? 'GROUNDED' : 'ABSTAINED'}
          </StatusPill>
        </span>
      </div>

      {typeof response.matchScore === 'number' && (
        <Meter.Root value={response.matchScore} min={0} max={100}>
          <div className={styles.meterHeader}>
            <Meter.Label>{content.jdMatchScoreLabel}</Meter.Label>
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
          <h3 className={styles.jdSubhead}>{content.jdStrengthsHeading}</h3>
          <ul className={styles.jdList}>
            {(response.strengths ?? []).length > 0 ? (
              (response.strengths ?? []).map(item => <li key={item}>{item}</li>)
            ) : (
              <li>{content.jdEmptyStrengthsLabel}</li>
            )}
          </ul>
        </div>
        <div className={styles.jdColumn}>
          <h3 className={styles.jdSubhead}>{content.jdGapsHeading}</h3>
          <ul className={styles.jdList}>
            {(response.gaps ?? []).length > 0 ? (
              (response.gaps ?? []).map(item => <li key={item}>{item}</li>)
            ) : (
              <li>{content.jdEmptyGapsLabel}</li>
            )}
          </ul>
        </div>
      </div>

      <CitationSourceList heading={content.citationsHeading} sources={response.sources} />
    </section>
  );
}
