import type {
  ActionErrorMetadata,
  CadenceGateVerdict,
  CadencePreset,
  CadenceRunMode,
  CadenceRunResult,
  PortalCadenceContent,
  QuotaStatus,
} from '@aklapper/core';
import {
  ActionFeedbackBanner,
  ArtifactInspector,
  Button,
  Meter,
  OscStatusBadge,
  Separator,
  TuiWindow,
} from '@aklapper/ui';
import { type FormEvent, useState } from 'react';

import { CadenceComposerSection, CUSTOM_PRESET_VALUE } from './CadenceComposerSection';
import { CadenceGoldenStrip } from './CadenceGoldenStrip';
import { CadenceHistoryStrip } from './CadenceHistoryStrip';
import { CadenceTimelineSection, resolveCadenceBadge } from './CadenceTimelineSection';

import styles from './PortalCadencePage.module.css';

export type PortalCadenceActionResult =
  | {
      readonly ok: true;
      readonly intent: 'run-init';
      readonly run: CadenceRunResult;
      readonly quota?: QuotaStatus;
    }
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
  | ({
      readonly ok: false;
      readonly intent: 'run' | 'gate';
      readonly error: string;
      readonly run?: CadenceRunResult;
      readonly quota?: QuotaStatus;
    } & ActionErrorMetadata);

export interface PortalCadencePageProps {
  content: PortalCadenceContent;
  presets: readonly CadencePreset[];
  quota?: QuotaStatus;
  goldenRuns?: readonly CadenceRunResult[];
  recentRuns?: readonly CadenceRunResult[];
  actionResult?: PortalCadenceActionResult;
  isSubmitting?: boolean;
  isStreaming?: boolean;
  streamLogs?: readonly string[];
  onRunBuild?: (payload: { prompt: string; presetSlug: string; mode: CadenceRunMode }) => void;
  onGateVerdict?: (payload: {
    runId: string;
    verdict: Exclude<CadenceGateVerdict, 'pending'>;
  }) => void;
  onClose: () => void;
}

const DEFAULT_QUOTA: QuotaStatus = {
  role: 'guest',
  turnsUsed: 0,
  maxTurns: 10,
  tokensUsed: 0,
  maxTokens: 100_000,
};

function isSameQuotaValues(a: QuotaStatus, b: QuotaStatus): boolean {
  return (
    a.role === b.role &&
    a.turnsUsed === b.turnsUsed &&
    a.maxTurns === b.maxTurns &&
    a.tokensUsed === b.tokensUsed &&
    a.maxTokens === b.maxTokens
  );
}

export function PortalCadencePage({
  content,
  presets,
  quota = DEFAULT_QUOTA,
  goldenRuns = [],
  recentRuns = [],
  actionResult,
  isSubmitting = false,
  isStreaming = false,
  streamLogs = [],
  onRunBuild,
  onGateVerdict,
  onClose,
}: PortalCadencePageProps) {
  const defaultPreset = presets[0];
  const initialSelectedRunId = recentRuns[0]?.runId ?? goldenRuns[0]?.runId ?? null;
  const [activePresetSlug, setActivePresetSlug] = useState(
    defaultPreset?.slug ?? CUSTOM_PRESET_VALUE,
  );
  const [promptText, setPromptText] = useState(defaultPreset?.starterPrompt ?? '');
  const [fastMode, setFastMode] = useState(false);
  const [runs, setRuns] = useState<readonly CadenceRunResult[]>(recentRuns);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(initialSelectedRunId);
  const [revisionNote, setRevisionNote] = useState('');
  const [lastPropQuota, setLastPropQuota] = useState<QuotaStatus>(quota);
  const [latestQuota, setLatestQuota] = useState<QuotaStatus>(quota);
  const [lastRecordedResult, setLastRecordedResult] = useState<
    PortalCadenceActionResult | undefined
  >(undefined);

  // Sync streamed & completed fetcher actions during render without useEffect.
  const propQuotaChanged = !isSameQuotaValues(quota, lastPropQuota);
  if (propQuotaChanged) {
    setLastPropQuota(quota);
    setLatestQuota(quota);
  }
  if (actionResult && actionResult !== lastRecordedResult) {
    setLastRecordedResult(actionResult);
    const updatedRun = actionResult.run;
    const nextQuota = 'quota' in actionResult ? actionResult.quota : updatedRun?.quota;
    if (nextQuota) {
      setLatestQuota(nextQuota);
    }
    if (updatedRun) {
      setRuns(prev => {
        const filtered = prev.filter(item => item.runId !== updatedRun.runId);
        return [updatedRun, ...filtered];
      });
      setSelectedRunId(updatedRun.runId);
    }
  }

  const activePreset =
    activePresetSlug === CUSTOM_PRESET_VALUE
      ? null
      : (presets.find(preset => preset.slug === activePresetSlug) ?? defaultPreset ?? null);
  const activeRun =
    runs.find(run => run.runId === selectedRunId) ??
    goldenRuns.find(run => run.runId === selectedRunId) ??
    null;

  const actionQuota = actionResult
    ? 'quota' in actionResult
      ? actionResult.quota
      : actionResult.run?.quota
    : undefined;
  const activeQuota = actionQuota ?? (propQuotaChanged ? quota : latestQuota);

  const hasActiveRunError = Boolean(
    !isSubmitting &&
    !isStreaming &&
    actionResult &&
    !actionResult.ok &&
    actionResult.intent === 'run' &&
    (!actionResult.run || actionResult.run.runId === activeRun?.runId),
  );
  const badge = resolveCadenceBadge(
    content,
    isSubmitting,
    isStreaming,
    activeRun,
    hasActiveRunError,
  );
  const fallbackStarterHtml =
    activePreset?.starterArtifactHtml ?? presets[0]?.starterArtifactHtml ?? '';
  const previewHtml =
    activeRun?.artifactHtml && activeRun.artifactHtml.trim().length > 0
      ? activeRun.artifactHtml
      : fallbackStarterHtml;

  const isRunReady = Boolean(
    activeRun && (!activeRun.runStatus || activeRun.runStatus === 'ready'),
  );
  const isPipelineBusy =
    isSubmitting ||
    isStreaming ||
    (!hasActiveRunError &&
      (activeRun?.runStatus === 'pending' || activeRun?.runStatus === 'running'));

  const handlePresetChange = (slug: string) => {
    setActivePresetSlug(slug);
    if (slug === CUSTOM_PRESET_VALUE) return;
    const chosen = presets.find(preset => preset.slug === slug);
    if (chosen) {
      setPromptText(chosen.starterPrompt);
    }
  };

  const handleSelectGolden = (run: CadenceRunResult) => {
    setSelectedRunId(run.runId);
    if (run.presetSlug && presets.some(preset => preset.slug === run.presetSlug)) {
      setActivePresetSlug(run.presetSlug);
    }
    setPromptText(run.prompt);
  };

  const handleRunSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = promptText.trim();
    if (trimmed.length < 4 || isPipelineBusy || !onRunBuild) return;
    onRunBuild({
      prompt: trimmed,
      presetSlug:
        activePresetSlug === CUSTOM_PRESET_VALUE ? 'custom' : (activePreset?.slug ?? 'custom'),
      mode: fastMode ? 'fast' : 'llm',
    });
  };

  const handleRevisionSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const note = revisionNote.trim();
    if (!note || isPipelineBusy || !onRunBuild) return;
    const basePrompt = activeRun?.prompt ?? promptText.trim();
    const nextPrompt = `${basePrompt}\nRevision: ${note}`.slice(0, 1200);
    setPromptText(nextPrompt);
    setRevisionNote('');
    onRunBuild({
      prompt: nextPrompt,
      presetSlug:
        activePresetSlug === CUSTOM_PRESET_VALUE ? 'custom' : (activePreset?.slug ?? 'custom'),
      mode: fastMode ? 'fast' : 'llm',
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
              <Meter.Label>
                {content.quotaMeterLabel} ({activeQuota.role})
              </Meter.Label>
              <Meter.Value>
                {() => `${activeQuota.turnsUsed}/${activeQuota.maxTurns} turns`}
              </Meter.Value>
            </div>
            <Meter.Track>
              <Meter.Indicator />
            </Meter.Track>
          </Meter.Root>
        </div>

        <CadenceGoldenStrip
          content={content}
          goldenRuns={goldenRuns}
          activeRunId={activeRun?.runId ?? null}
          onSelectGolden={handleSelectGolden}
        />

        <Separator.Root />

        <CadenceComposerSection
          content={content}
          presets={presets}
          activePresetSlug={activePresetSlug}
          activePreset={activePreset}
          promptText={promptText}
          fastMode={fastMode}
          isPipelineBusy={isPipelineBusy}
          canSubmit={!isPipelineBusy && promptText.trim().length >= 4 && Boolean(onRunBuild)}
          onPresetChange={handlePresetChange}
          onPromptChange={setPromptText}
          onFastModeChange={setFastMode}
          onSubmit={handleRunSubmit}
        />

        {actionResult && !actionResult.ok && (
          <ActionFeedbackBanner
            ok={false}
            message={actionResult.error}
            action={actionResult.action}
            code={actionResult.code}
            correlationId={actionResult.correlationId}
            testId='cadence-error-banner'
          />
        )}

        <ArtifactInspector
          artifactHtml={previewHtml}
          fileName={`cadence-${activeRun?.presetSlug ?? 'artifact'}.html`}
          executionMode={activeRun?.executionMode}
          isGolden={Boolean(activeRun?.isGolden)}
          spec={activeRun?.spec}
          gateAudit={activeRun?.gateAudit}
          gateVerdict={activeRun?.gateVerdict ?? 'pending'}
          isPipelineBusy={isPipelineBusy}
          isRunReady={isRunReady}
          isStreaming={isStreaming}
          streamLogs={streamLogs}
          labels={content}
          onGateVerdict={
            activeRun && !activeRun.isGolden && onGateVerdict
              ? verdict => onGateVerdict({ runId: activeRun.runId, verdict })
              : undefined
          }
        />

        {activeRun &&
          isRunReady &&
          !activeRun.isGolden &&
          activeRun.gateVerdict === 'rejected' &&
          onRunBuild && (
            <form
              className={styles.revisionForm}
              onSubmit={handleRevisionSubmit}
              data-testid='cadence-revision-form'
            >
              <label className={styles.composerLabel} htmlFor='cadence-revision-input'>
                {content.rejectGateLabel} — Revision Prompt
              </label>
              <div className={styles.revisionRow}>
                <input
                  id='cadence-revision-input'
                  type='text'
                  className={styles.revisionInput}
                  value={revisionNote}
                  onChange={event => setRevisionNote(event.currentTarget.value)}
                  placeholder={content.promptPlaceholder}
                  data-testid='cadence-revision-input'
                />
                <Button
                  type='submit'
                  variant='primary'
                  size='xs'
                  disabled={isPipelineBusy || revisionNote.trim().length < 3}
                  data-testid='cadence-revision-submit'
                >
                  <Button.Label>{content.submitRunLabel}</Button.Label>
                </Button>
              </div>
            </form>
          )}

        {activeRun && (
          <CadenceTimelineSection
            content={content}
            activeRun={activeRun}
            isPipelineBusy={isPipelineBusy}
            isRunReady={isRunReady}
            onGateVerdict={onGateVerdict}
          />
        )}

        <CadenceHistoryStrip
          content={content}
          runs={runs}
          activeRunId={activeRun?.runId ?? null}
          onSelectRun={setSelectedRunId}
        />
      </TuiWindow>
    </div>
  );
}
