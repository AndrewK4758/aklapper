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
  Button,
  Meter,
  OscStatusBadge,
  SandboxedArtifactFrame,
  Select,
  Separator,
  Switch,
  TuiWindow,
} from '@aklapper/ui';
import { type FormEvent, useState } from 'react';

import { CadenceTimelineSection, resolveCadenceBadge } from './CadenceTimelineSection';

import styles from './PortalCadencePage.module.css';

const CUSTOM_PRESET_VALUE = '__custom__';

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
  recentRuns?: readonly CadenceRunResult[];
  actionResult?: PortalCadenceActionResult;
  isSubmitting?: boolean;
  isStreaming?: boolean;
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
  maxTurns: 5,
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
  recentRuns = [],
  actionResult,
  isSubmitting = false,
  isStreaming = false,
  onRunBuild,
  onGateVerdict,
  onClose,
}: PortalCadencePageProps) {
  const defaultPreset = presets[0];
  const [activePresetSlug, setActivePresetSlug] = useState(
    defaultPreset?.slug ?? CUSTOM_PRESET_VALUE,
  );
  const [promptText, setPromptText] = useState(defaultPreset?.starterPrompt ?? '');
  const [fastMode, setFastMode] = useState(true);
  const [runs, setRuns] = useState<readonly CadenceRunResult[]>(recentRuns);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(recentRuns[0]?.runId ?? null);
  const [artifactViewMode, setArtifactViewMode] = useState<'preview' | 'source'>('preview');
  const [copiedSource, setCopiedSource] = useState(false);
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
  const activeRun = runs.find(run => run.runId === selectedRunId) ?? null;

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

  const selectItems: Record<string, string> = {
    ...Object.fromEntries(presets.map(preset => [preset.slug, preset.title])),
    [CUSTOM_PRESET_VALUE]: 'Custom Prompt (Free-form)',
  };

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
    if (slug === CUSTOM_PRESET_VALUE) {
      return;
    }
    const chosen = presets.find(preset => preset.slug === slug);
    if (chosen) {
      setPromptText(chosen.starterPrompt);
    }
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

  const handleCopyArtifactHtml = () => {
    if (!previewHtml || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    void navigator.clipboard.writeText(previewHtml).then(() => {
      setCopiedSource(true);
      setTimeout(() => setCopiedSource(false), 1800);
    });
  };

  const handleDownloadArtifactHtml = () => {
    if (
      !previewHtml ||
      typeof document === 'undefined' ||
      typeof URL.createObjectURL !== 'function'
    ) {
      return;
    }
    const blob = new Blob([previewHtml], { type: 'text/html;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `cadence-${activeRun?.presetSlug ?? 'artifact'}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
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

        <div className={styles.selectorRow}>
          <div className={styles.selectField}>
            <label className={styles.composerLabel} htmlFor='cadence-preset-trigger'>
              Buildable Example / Workflow
            </label>
            <Select.Root
              value={activePresetSlug}
              items={selectItems}
              onValueChange={val => {
                if (val) {
                  handlePresetChange(String(val));
                }
              }}
            >
              <Select.Trigger id='cadence-preset-trigger' data-testid='cadence-preset-select'>
                <Select.Value placeholder='Choose buildable item...' />
                <Select.Icon aria-hidden='true'>▾</Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner alignItemWithTrigger={false} sideOffset={4}>
                  <Select.Popup>
                    <Select.List>
                      {presets.map(preset => (
                        <Select.Item
                          key={preset.slug}
                          value={preset.slug}
                          data-testid={`cadence-preset-${preset.slug}`}
                        >
                          <Select.ItemIndicator>✓</Select.ItemIndicator>
                          <Select.ItemText>{preset.title}</Select.ItemText>
                        </Select.Item>
                      ))}
                      <Select.Separator />
                      <Select.Item value={CUSTOM_PRESET_VALUE} data-testid='cadence-preset-custom'>
                        <Select.ItemIndicator>✓</Select.ItemIndicator>
                        <Select.ItemText>Custom Prompt (Free-form)</Select.ItemText>
                      </Select.Item>
                    </Select.List>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
            <p className={styles.presetPrompt}>
              {activePreset
                ? `Selected (${activePreset.expectedKind}): ${activePreset.starterPrompt}`
                : 'Free-form mode: describe any self-contained Solar Forge widget below.'}
            </p>
          </div>

          <div className={styles.modeToggle}>
            <Switch.Label>
              <Switch.Root
                checked={fastMode}
                onCheckedChange={setFastMode}
                aria-label='Fast deterministic mode'
                data-testid='cadence-fast-mode-switch'
              >
                <Switch.Thumb />
              </Switch.Root>
              <span>Fast Mode ({fastMode ? 'instant interactive demo' : 'Live LLM'})</span>
            </Switch.Label>
          </div>
        </div>

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
              disabled={isPipelineBusy || promptText.trim().length < 4 || !onRunBuild}
              data-testid='cadence-run-submit'
            >
              <Button.Label>
                {isStreaming
                  ? 'Streaming CHORD Phases...'
                  : isSubmitting
                    ? 'Starting CHORD Run...'
                    : 'Run CHORD Build'}
              </Button.Label>
            </Button>
          </div>
        </form>

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

        {activeRun && (
          <CadenceTimelineSection
            activeRun={activeRun}
            isPipelineBusy={isPipelineBusy}
            isRunReady={isRunReady}
            onGateVerdict={onGateVerdict}
          />
        )}

        {activeRun && isRunReady && activeRun.gateVerdict === 'approved' && (
          <div
            className={styles.gateActionBanner}
            data-verdict='approved'
            data-testid='cadence-approved-actions'
          >
            <span>Gate approved. Export this sanitized artifact:</span>
            <div className={styles.artifactActions}>
              <Button
                type='button'
                variant='primary'
                size='xs'
                onClick={handleDownloadArtifactHtml}
                data-testid='cadence-download-html'
              >
                <Button.Label>Download .html</Button.Label>
              </Button>
              <Button type='button' variant='ghost' size='xs' onClick={handleCopyArtifactHtml}>
                <Button.Label>{copiedSource ? 'Copied!' : 'Copy Approved HTML'}</Button.Label>
              </Button>
            </div>
          </div>
        )}

        {activeRun && isRunReady && activeRun.gateVerdict === 'rejected' && onRunBuild && (
          <form
            className={styles.revisionForm}
            onSubmit={handleRevisionSubmit}
            data-testid='cadence-revision-form'
          >
            <label className={styles.composerLabel} htmlFor='cadence-revision-input'>
              Gate Rejected — Request Revision &amp; Re-run CHORD
            </label>
            <div className={styles.revisionRow}>
              <input
                id='cadence-revision-input'
                type='text'
                className={styles.revisionInput}
                value={revisionNote}
                onChange={event => setRevisionNote(event.currentTarget.value)}
                placeholder='e.g. Add a latency breakdown table and highlight p99 thresholds...'
                data-testid='cadence-revision-input'
              />
              <Button
                type='submit'
                variant='primary'
                size='xs'
                disabled={isPipelineBusy || revisionNote.trim().length < 3}
                data-testid='cadence-revision-submit'
              >
                <Button.Label>Re-run with Revision</Button.Label>
              </Button>
            </div>
          </form>
        )}

        <section className={styles.artifactSection}>
          <div className={styles.artifactHeader}>
            <div className={styles.artifactTabs} role='tablist' aria-label='Artifact view mode'>
              <Button
                type='button'
                role='tab'
                aria-selected={artifactViewMode === 'preview'}
                variant={artifactViewMode === 'preview' ? 'secondary' : 'ghost'}
                size='xs'
                onClick={() => setArtifactViewMode('preview')}
                data-testid='cadence-view-preview'
              >
                <Button.Label>Live Preview</Button.Label>
              </Button>
              <Button
                type='button'
                role='tab'
                aria-selected={artifactViewMode === 'source'}
                variant={artifactViewMode === 'source' ? 'secondary' : 'ghost'}
                size='xs'
                onClick={() => setArtifactViewMode('source')}
                data-testid='cadence-view-source'
              >
                <Button.Label>Source HTML</Button.Label>
              </Button>
            </div>
            <div className={styles.artifactActions}>
              <span className={styles.isolationHint}>{previewHtml.length} bytes</span>
              <Button
                type='button'
                variant='ghost'
                size='xs'
                onClick={handleCopyArtifactHtml}
                disabled={!previewHtml}
                data-testid='cadence-copy-html'
              >
                <Button.Label>{copiedSource ? 'Copied!' : 'Copy HTML'}</Button.Label>
              </Button>
            </div>
          </div>

          {artifactViewMode === 'preview' ? (
            <SandboxedArtifactFrame title={content.iframeTitle} srcDoc={previewHtml} />
          ) : (
            <pre className={styles.sourcePre} data-testid='cadence-source-code'>
              <code>{previewHtml}</code>
            </pre>
          )}
        </section>

        {runs.length > 0 && (
          <section className={styles.historySection} data-testid='cadence-run-history'>
            <h2 className={styles.sectionTitle}>Recent Session Runs ({runs.length})</h2>
            <ul className={styles.historyList}>
              {runs.map(run => (
                <li key={run.runId}>
                  <button
                    type='button'
                    className={styles.historyItem}
                    data-active={run.runId === activeRun?.runId ? 'true' : 'false'}
                    onClick={() => setSelectedRunId(run.runId)}
                  >
                    <span className={styles.historyPrompt}>{run.prompt}</span>
                    <span>
                      {run.runStatus ?? 'ready'} · {run.gateVerdict} · {run.tokensIn ?? 0}/
                      {run.tokensOut ?? 0} tok
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
