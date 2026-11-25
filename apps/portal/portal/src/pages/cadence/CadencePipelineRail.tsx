import type { CadenceRunResult } from '@aklapper/core';

import styles from './PortalCadencePage.module.css';

export interface CadencePipelineRailProps {
  readonly activeRun: CadenceRunResult | null;
  readonly isStreaming: boolean;
}

type RailStepStatus = 'pending' | 'running' | 'gate' | 'completed' | 'failed';

interface RailStep {
  readonly id: string;
  readonly index: string;
  readonly label: string;
  readonly agent: string;
  readonly status: RailStepStatus;
  readonly meta: string;
}

function resolveSteps(
  activeRun: CadenceRunResult | null,
  isStreaming: boolean,
): readonly RailStep[] {
  const findTurn = (phase: 'triage' | 'spec' | 'build' | 'gate') =>
    activeRun?.turns.find(t => t.phase === phase);

  const triage = findTurn('triage');
  const spec = findTurn('spec');
  const build = findTurn('build');
  const gate = findTurn('gate');
  const runStatus = activeRun?.runStatus;

  const mapTurnStatus = (
    status: string | undefined,
    fallback: RailStepStatus = 'pending',
  ): RailStepStatus => {
    if (status === 'completed' || status === 'running' || status === 'failed') return status;
    return fallback;
  };

  let humanGateStatus: RailStepStatus = 'pending';
  let humanGateMeta = 'locked';
  if (runStatus === 'awaiting_approval') {
    humanGateStatus = 'gate';
    humanGateMeta = 'action required';
  } else if (
    runStatus === 'build_queued' ||
    runStatus === 'building' ||
    runStatus === 'ready' ||
    activeRun?.isGolden
  ) {
    humanGateStatus = 'completed';
    humanGateMeta = activeRun?.isGolden ? 'verified' : 'approved';
  } else if (runStatus === 'failed' && spec?.status === 'completed') {
    humanGateStatus = 'completed';
    humanGateMeta = 'approved';
  }

  return [
    {
      id: 'triage',
      index: '01',
      label: 'Triage',
      agent: triage?.agentName ?? 'chord-triage',
      status: mapTurnStatus(triage?.status, isStreaming && !activeRun ? 'running' : 'pending'),
      meta: triage && triage.latencyMs > 0 ? `${triage.latencyMs}ms` : (triage?.status ?? 'idle'),
    },
    {
      id: 'spec',
      index: '02',
      label: 'CHORD Spec',
      agent: spec?.agentName ?? 'chord-spec',
      status: mapTurnStatus(spec?.status),
      meta: spec && spec.latencyMs > 0 ? `${spec.latencyMs}ms` : (spec?.status ?? 'idle'),
    },
    {
      id: 'human-gate',
      index: '⏸',
      label: 'Human Gate',
      agent: 'operator-review',
      status: humanGateStatus,
      meta: humanGateMeta,
    },
    {
      id: 'build',
      index: '03',
      label: 'Build',
      agent: build?.agentName ?? 'chord-builder',
      status: runStatus === 'build_queued' ? 'running' : mapTurnStatus(build?.status),
      meta:
        runStatus === 'awaiting_approval'
          ? 'awaiting spec'
          : build && build.latencyMs > 0
            ? `${build.latencyMs}ms`
            : (build?.status ?? 'idle'),
    },
    {
      id: 'gate',
      index: '04',
      label: 'Gate Audit',
      agent: gate?.agentName ?? 'chord-gate',
      status: mapTurnStatus(gate?.status),
      meta: gate && gate.latencyMs > 0 ? `${gate.latencyMs}ms` : (gate?.status ?? 'idle'),
    },
  ];
}

export function CadencePipelineRail({ activeRun, isStreaming }: CadencePipelineRailProps) {
  const steps = resolveSteps(activeRun, isStreaming);

  return (
    <nav
      className={styles.pipelineRail}
      aria-label='CHORD execution stages'
      data-testid='cadence-pipeline-rail'
    >
      <ol className={styles.pipelineRailList}>
        {steps.map(step => (
          <li
            key={step.id}
            className={styles.pipelineStep}
            data-status={step.status}
            data-testid={`cadence-rail-${step.id}`}
          >
            <div className={styles.pipelineStepTop}>
              <span className={styles.pipelineStepIndex}>{step.index}</span>
              <span className={styles.pipelineStepLabel}>{step.label}</span>
              <span className={styles.pipelineStepMeta}>{step.meta}</span>
            </div>
            <span className={styles.pipelineStepAgent}>{step.agent}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
