import type {
  CadenceGateVerdict,
  CadenceRunResult,
  Osc7501State,
  PortalCadenceContent,
} from '@aklapper/core';
import { Button } from '@aklapper/ui';

import styles from './PortalCadencePage.module.css';

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
  readonly activeRun: CadenceRunResult;
  readonly isPipelineBusy: boolean;
  readonly isRunReady: boolean;
  readonly onGateVerdict?: (payload: {
    runId: string;
    verdict: Exclude<CadenceGateVerdict, 'pending'>;
  }) => void;
}

export function CadenceTimelineSection({
  activeRun,
  isPipelineBusy,
  isRunReady,
  onGateVerdict,
}: CadenceTimelineSectionProps) {
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
          {onGateVerdict && (
            <>
              <Button
                type='button'
                variant='primary'
                size='xs'
                disabled={isPipelineBusy || !isRunReady || activeRun.gateVerdict === 'approved'}
                onClick={() => onGateVerdict({ runId: activeRun.runId, verdict: 'approved' })}
                data-testid='cadence-gate-approve'
              >
                <Button.Label>Approve Gate</Button.Label>
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='xs'
                disabled={isPipelineBusy || !isRunReady || activeRun.gateVerdict === 'rejected'}
                onClick={() => onGateVerdict({ runId: activeRun.runId, verdict: 'rejected' })}
                data-testid='cadence-gate-reject'
              >
                <Button.Label>Reject Gate</Button.Label>
              </Button>
            </>
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
          </li>
        ))}
      </ol>
    </section>
  );
}
