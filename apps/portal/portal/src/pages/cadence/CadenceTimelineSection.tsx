import type {
  CadenceGateVerdict,
  CadenceRunResult,
  CadenceTurn,
  Osc7501State,
  PortalCadenceContent,
} from '@aklapper/core';
import { Button, StatusPill } from '@aklapper/ui';

import styles from './PortalCadencePage.module.css';

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function TurnPayloadDetails({ turn }: { readonly turn: CadenceTurn }) {
  const payload = turn.payload;
  if (!payload) return null;

  const keywords = readStringArray(payload['detectedKeywords']);
  const patterns = readStringArray(payload['recalledPatterns']);
  const criteria = readStringArray(payload['acceptanceCriteria']);
  const checks = readStringArray(payload['checks']);
  const isolationPolicy = readString(payload['isolationPolicy']);
  const sandboxConstraints = readString(payload['sandboxConstraints']);
  const provider = readString(payload['provider']);
  const fallbackReason = readString(payload['fallbackReason']);
  const artifactBytes = readNumber(payload['artifactBytes']);
  const hasDetails =
    keywords.length > 0 ||
    patterns.length > 0 ||
    criteria.length > 0 ||
    checks.length > 0 ||
    Boolean(isolationPolicy || sandboxConstraints || provider || fallbackReason || artifactBytes);

  if (!hasDetails) return null;

  return (
    <details className={styles.turnDetails} data-testid={`cadence-turn-details-${turn.phase}`}>
      <summary className={styles.turnDetailsSummary}>Inspect {turn.phase} artifact</summary>
      <div className={styles.turnDetailsBody}>
        {provider && (
          <p className={styles.turnDetailLine}>
            <strong>Provider:</strong> {provider}
            {artifactBytes !== null ? ` (${artifactBytes} bytes)` : ''}
          </p>
        )}
        {fallbackReason && <output className={styles.turnFallbackNote}>{fallbackReason}</output>}
        {isolationPolicy && (
          <p className={styles.turnDetailLine}>
            <strong>Isolation:</strong> {isolationPolicy}
          </p>
        )}
        {sandboxConstraints && (
          <p className={styles.turnDetailLine}>
            <strong>CSP:</strong> {sandboxConstraints}
          </p>
        )}
        {keywords.length > 0 && (
          <div className={styles.turnPillRow}>
            {keywords.map(kw => (
              <span key={kw} className={styles.turnPill}>
                {kw}
              </span>
            ))}
          </div>
        )}
        {patterns.length > 0 && (
          <p className={styles.turnDetailLine}>
            <strong>Qdrant Recall:</strong> {patterns.join(', ')}
          </p>
        )}
        {criteria.length > 0 && (
          <ul className={styles.turnDetailList}>
            {criteria.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        {checks.length > 0 && (
          <ul className={styles.turnDetailList}>
            {checks.map(check => (
              <li key={check}>{check}</li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

export function resolveCadenceBadge(
  content: PortalCadenceContent,
  isSubmitting: boolean,
  isStreaming: boolean,
  activeRun: CadenceRunResult | null,
  hasActiveRunError: boolean,
): { state: Osc7501State; label: string } {
  if (activeRun?.runStatus === 'failed') {
    return { state: 'error', label: 'CHORD run failed' };
  }
  const isRunPendingOrRunning =
    activeRun?.runStatus === 'pending' || activeRun?.runStatus === 'running';
  if (isSubmitting || isStreaming || (isRunPendingOrRunning && !hasActiveRunError)) {
    const runningTurn = activeRun?.turns.find(turn => turn.status === 'running');
    return {
      state: isStreaming ? 'running' : 'scaling',
      label: runningTurn ? `live · ${runningTurn.phase} running` : 'waking · CHORD running',
    };
  }
  if (isRunPendingOrRunning && hasActiveRunError) {
    return { state: 'error', label: 'CHORD stream interrupted' };
  }
  if (!activeRun) {
    return { state: content.statusBadge.state, label: content.statusBadge.label };
  }
  if (activeRun.gateVerdict === 'approved') {
    return { state: 'ready', label: '1/1 replicas · gate approved' };
  }
  if (activeRun.gateVerdict === 'rejected') {
    return { state: 'error', label: '1/1 replicas · gate rejected' };
  }
  return { state: 'gate', label: '1/1 replicas · gate pending' };
}

export interface CadenceTimelineSectionProps {
  readonly content: PortalCadenceContent;
  readonly activeRun: CadenceRunResult;
  readonly isPipelineBusy: boolean;
  readonly isRunReady: boolean;
  readonly onGateVerdict?: (payload: {
    runId: string;
    verdict: Exclude<CadenceGateVerdict, 'pending'>;
  }) => void;
}

export function CadenceTimelineSection({
  content,
  activeRun,
  isPipelineBusy,
  isRunReady,
  onGateVerdict,
}: CadenceTimelineSectionProps) {
  const isGoldenRun = Boolean(activeRun.isGolden);

  return (
    <section className={styles.runSection} data-testid='cadence-active-run'>
      <div className={styles.runHeader}>
        <h2 className={styles.sectionTitle}>CHORD Execution Timeline</h2>
        <div className={styles.gateControls}>
          <span
            className={styles.verdictPill}
            data-verdict={activeRun.gateVerdict}
            data-testid='cadence-gate-verdict'
          >
            gate: {activeRun.gateVerdict}
          </span>
          {isGoldenRun ? (
            <StatusPill tone='accent' size='sm' data-testid='cadence-golden-readonly-pill'>
              {content.goldenVerifiedBadgeLabel}
            </StatusPill>
          ) : (
            onGateVerdict && (
              <>
                <Button
                  type='button'
                  variant='primary'
                  size='xs'
                  disabled={isPipelineBusy || !isRunReady || activeRun.gateVerdict === 'approved'}
                  onClick={() => onGateVerdict({ runId: activeRun.runId, verdict: 'approved' })}
                  data-testid='cadence-gate-approve'
                >
                  <Button.Label>{content.approveGateLabel}</Button.Label>
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  size='xs'
                  disabled={isPipelineBusy || !isRunReady || activeRun.gateVerdict === 'rejected'}
                  onClick={() => onGateVerdict({ runId: activeRun.runId, verdict: 'rejected' })}
                  data-testid='cadence-gate-reject'
                >
                  <Button.Label>{content.rejectGateLabel}</Button.Label>
                </Button>
              </>
            )
          )}
        </div>
      </div>

      <ol className={styles.turnTimeline} data-testid='cadence-turn-timeline'>
        {activeRun.turns.map(turn => (
          <li
            key={`${activeRun.runId}-${turn.phase}-${turn.id ?? 0}`}
            className={styles.turnCard}
            data-testid={`cadence-turn-${turn.phase}`}
            data-status={turn.status}
          >
            <div className={styles.turnTop}>
              <span className={styles.turnPhase}>{turn.phase.toUpperCase()}</span>
              <span className={styles.turnStatus} data-status={turn.status}>
                {turn.status}
              </span>
              <span className={styles.turnLatency}>{turn.latencyMs}ms</span>
            </div>
            <div className={styles.turnMeta}>
              <span className={styles.turnAgent}>{turn.agentName}</span>
            </div>
            <p className={styles.turnSummary}>{turn.summary}</p>
            <TurnPayloadDetails turn={turn} />
          </li>
        ))}
      </ol>
    </section>
  );
}
