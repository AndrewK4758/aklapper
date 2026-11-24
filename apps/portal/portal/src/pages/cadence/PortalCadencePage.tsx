import type {
  CadenceGateVerdict,
  CadencePreset,
  CadenceRunResult,
  Osc7501State,
  PortalCadenceContent,
  QuotaStatus,
} from '@aklapper/core';
import {
  Button,
  Meter,
  OscStatusBadge,
  SandboxedArtifactFrame,
  Separator,
  Tabs,
  TuiWindow,
} from '@aklapper/ui';
import { type FormEvent, useState } from 'react';

import styles from './PortalCadencePage.module.css';

export type PortalCadenceActionResult =
  | {
      readonly ok: true;
      readonly intent: 'run';
      readonly run: CadenceRunResult;
      readonly quota?: QuotaStatus;
    }
  | {
      readonly ok: true;
      readonly intent: 'gate';
      readonly run: CadenceRunResult;
    }
  | {
      readonly ok: false;
      readonly intent: 'run' | 'gate';
      readonly error: string;
      readonly quota?: QuotaStatus;
    };

export interface PortalCadencePageProps {
  content: PortalCadenceContent;
  presets: readonly CadencePreset[];
  quota?: QuotaStatus;
  recentRuns?: readonly CadenceRunResult[];
  actionResult?: PortalCadenceActionResult;
  isSubmitting?: boolean;
  onRunBuild?: (payload: { prompt: string; presetSlug: string }) => void;
  onGateVerdict?: (payload: {
    runId: string;
    verdict: Exclude<CadenceGateVerdict, 'pending'>;
  }) => void;
  onClose: () => void;
}

const DEFAULT_QUOTA: QuotaStatus = {
  role: 'guest',
  turnsUsed: 0,
  maxTurns: 5,
  tokensUsed: 0,
  maxTokens: 100_000,
};

function resolveCadenceBadge(
  content: PortalCadenceContent,
  isSubmitting: boolean,
  activeRun: CadenceRunResult | null,
): { state: Osc7501State; label: string } {
  if (isSubmitting) {
    return { state: 'scaling', label: 'waking · CHORD running' };
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

export function PortalCadencePage({
  content,
  presets,
  quota = DEFAULT_QUOTA,
  recentRuns = [],
  actionResult,
  isSubmitting = false,
  onRunBuild,
  onGateVerdict,
  onClose,
}: PortalCadencePageProps) {
  const defaultPreset = presets[0];
  const [activePresetSlug, setActivePresetSlug] = useState(defaultPreset?.slug ?? '');
  const [promptText, setPromptText] = useState(defaultPreset?.starterPrompt ?? '');
  const [runs, setRuns] = useState<readonly CadenceRunResult[]>(recentRuns);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(recentRuns[0]?.runId ?? null);
  const [lastRecordedResult, setLastRecordedResult] = useState<
    PortalCadenceActionResult | undefined
  >(undefined);

  // Sync completed fetcher actions during render without useEffect.
  if (actionResult && actionResult !== lastRecordedResult) {
    setLastRecordedResult(actionResult);
    if (actionResult.ok) {
      const updatedRun = actionResult.run;
      setRuns(prev => {
        const filtered = prev.filter(item => item.runId !== updatedRun.runId);
        return [updatedRun, ...filtered];
      });
      setSelectedRunId(updatedRun.runId);
    }
  }

  const activePreset =
    presets.find(preset => preset.slug === activePresetSlug) ?? defaultPreset ?? null;
  const activeRun = runs.find(run => run.runId === selectedRunId) ?? null;

  const activeQuota =
    actionResult?.ok && actionResult.intent === 'run' && actionResult.quota
      ? actionResult.quota
      : !actionResult?.ok && actionResult?.quota
        ? actionResult.quota
        : quota;

  const badge = resolveCadenceBadge(content, isSubmitting, activeRun);
  const previewHtml = activeRun?.artifactHtml ?? activePreset?.starterArtifactHtml ?? '';

  const handlePresetChange = (slug: string) => {
    setActivePresetSlug(slug);
    const chosen = presets.find(preset => preset.slug === slug);
    if (chosen) {
      setPromptText(chosen.starterPrompt);
    }
  };

  const handleRunSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = promptText.trim();
    if (trimmed.length < 4 || isSubmitting || !onRunBuild) return;
    onRunBuild({
      prompt: trimmed,
      presetSlug: activePreset?.slug ?? 'solar-forge-starter',
    });
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

        <div className={styles.quotaBar} data-testid='cadence-quota-meter'>
          <Meter.Root value={activeQuota.turnsUsed} min={0} max={Math.max(1, activeQuota.maxTurns)}>
            <div className={styles.meterHeader}>
              <Meter.Label>CADENCE Sandbox Quota ({activeQuota.role})</Meter.Label>
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

        {presets.length > 0 && (
          <Tabs.Root
            value={activePresetSlug}
            onValueChange={val => handlePresetChange(String(val))}
          >
            <Tabs.List>
              {presets.map(preset => (
                <Tabs.Tab
                  key={preset.slug}
                  value={preset.slug}
                  data-testid={`cadence-preset-${preset.slug}`}
                >
                  {preset.title}
                </Tabs.Tab>
              ))}
              <Tabs.Indicator />
            </Tabs.List>
            {presets.map(preset => (
              <Tabs.Panel key={preset.slug} value={preset.slug} className={styles.presetPanel}>
                <p className={styles.presetPrompt}>Template: {preset.starterPrompt}</p>
              </Tabs.Panel>
            ))}
          </Tabs.Root>
        )}

        <form className={styles.composer} onSubmit={handleRunSubmit}>
          <label className={styles.composerLabel} htmlFor='cadence-prompt-input'>
            CHORD Prompt Composer (4..1200 chars)
          </label>
          <textarea
            id='cadence-prompt-input'
            name='prompt'
            rows={3}
            className={styles.textarea}
            value={promptText}
            onChange={event => setPromptText(event.currentTarget.value)}
            placeholder='Describe a self-contained Solar Forge diagnostic widget to build in the CHORD sandbox...'
            data-testid='cadence-prompt-input'
          />
          <div className={styles.composerActions}>
            <span className={styles.isolationHint}>
              sandbox=&quot;allow-scripts&quot; (no allow-same-origin)
            </span>
            <Button
              type='submit'
              variant='primary'
              disabled={isSubmitting || promptText.trim().length < 4 || !onRunBuild}
              data-testid='cadence-run-submit'
            >
              <Button.Label>
                {isSubmitting ? 'Running CHORD Pipeline...' : 'Run CHORD Build'}
              </Button.Label>
            </Button>
          </div>
        </form>

        {actionResult && !actionResult.ok && (
          <div className={styles.errorBanner} role='alert' data-testid='cadence-error-banner'>
            {actionResult.error}
          </div>
        )}

        {activeRun && (
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
                      disabled={isSubmitting || activeRun.gateVerdict === 'approved'}
                      onClick={() => onGateVerdict({ runId: activeRun.runId, verdict: 'approved' })}
                      data-testid='cadence-gate-approve'
                    >
                      <Button.Label>Approve Gate</Button.Label>
                    </Button>
                    <Button
                      type='button'
                      variant='ghost'
                      size='xs'
                      disabled={isSubmitting || activeRun.gateVerdict === 'rejected'}
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
                >
                  <div className={styles.turnTop}>
                    <span className={styles.turnPhase}>{turn.phase.toUpperCase()}</span>
                    <span className={styles.turnAgent}>{turn.agentName}</span>
                    <span className={styles.turnLatency}>{turn.latencyMs}ms</span>
                  </div>
                  <p className={styles.turnSummary}>{turn.summary}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        <SandboxedArtifactFrame title={content.iframeTitle} srcDoc={previewHtml} />

        {runs.length > 0 && (
          <section className={styles.historySection} aria-label='Session run history'>
            <h2 className={styles.sectionTitle}>Session Run History ({runs.length})</h2>
            <ul className={styles.historyList} data-testid='cadence-run-history'>
              {runs.map(run => (
                <li key={run.runId}>
                  <button
                    type='button'
                    className={styles.historyItem}
                    data-active={run.runId === activeRun?.runId ? 'true' : 'false'}
                    onClick={() => setSelectedRunId(run.runId)}
                  >
                    <span className={styles.historyPrompt}>{run.prompt}</span>
                    <span className={styles.verdictPill} data-verdict={run.gateVerdict}>
                      {run.gateVerdict}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </TuiWindow>
    </div>
  );
}
