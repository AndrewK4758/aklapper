import type {
  CadenceExecutionMode,
  CadenceGateAudit,
  CadenceGateVerdict,
  CadenceRunLifecycleStatus,
  CadenceSpecArtifact,
} from '@aklapper/core';
import { useState } from 'react';

import { cx } from '../elements/_internal/elementFactory';
import { Button } from '../elements/base/Button';
import { Dialog } from '../elements/base/Dialog';
import { Tabs } from '../elements/base/Tabs';
import { StatusPill, type StatusPillTone } from '../elements/StatusPill';
import { CodeArtifactViewer } from './CodeArtifactViewer';
import { GateAuditChecklist } from './GateAuditChecklist';
import { SandboxedArtifactFrame } from './SandboxedArtifactFrame';
import { StreamingTextFeed } from './StreamingTextFeed';

import styles from './ArtifactInspector.module.css';

export interface ArtifactInspectorLabels {
  readonly iframeTitle: string;
  readonly tabPreviewLabel?: string;
  readonly tabSpecLabel?: string;
  readonly tabSourceLabel?: string;
  readonly tabGateAuditLabel?: string;
  readonly streamLogHeading?: string;
  readonly copySourceLabel?: string;
  readonly copiedSourceLabel?: string;
  readonly downloadSourceLabel?: string;
  readonly fullscreenLabel?: string;
  readonly exitFullscreenLabel?: string;
  readonly approveGateLabel?: string;
  readonly rejectGateLabel?: string;
  readonly goldenVerifiedBadgeLabel?: string;
  readonly goldenReadOnlyNotice?: string;
  readonly emptySpecNotice?: string;
  readonly modeBadgeGoldenLabel?: string;
  readonly modeBadgeCachedLabel?: string;
  readonly modeBadgeLiveLabel?: string;
  readonly modeBadgeFastLabel?: string;
  readonly modeBadgeFallbackLabel?: string;
}

export interface ArtifactInspectorProps {
  readonly artifactHtml: string;
  readonly fileName?: string;
  readonly executionMode?: CadenceExecutionMode;
  readonly runStatus?: CadenceRunLifecycleStatus;
  readonly isGolden?: boolean;
  readonly spec?: CadenceSpecArtifact;
  readonly gateAudit?: CadenceGateAudit;
  readonly gateVerdict?: CadenceGateVerdict;
  readonly isPipelineBusy?: boolean;
  readonly isRunReady?: boolean;
  readonly isStreaming?: boolean;
  readonly streamLogs?: readonly string[];
  readonly labels: ArtifactInspectorLabels;
  readonly onGateVerdict?: (verdict: Exclude<CadenceGateVerdict, 'pending'>) => void;
  readonly className?: string;
}

function resolveModeBadge(
  mode: CadenceExecutionMode | undefined,
  labels: ArtifactInspectorLabels,
): { readonly label: string; readonly tone: StatusPillTone } | null {
  if (!mode) return null;
  switch (mode) {
    case 'golden':
      return { label: labels.modeBadgeGoldenLabel ?? 'Golden Showcase', tone: 'accent' };
    case 'cached':
      return { label: labels.modeBadgeCachedLabel ?? 'Cached ($0)', tone: 'success' };
    case 'live':
      return { label: labels.modeBadgeLiveLabel ?? 'Live LLM', tone: 'info' };
    case 'fast':
      return { label: labels.modeBadgeFastLabel ?? 'Fast Synthesis', tone: 'neutral' };
    case 'fallback':
      return { label: labels.modeBadgeFallbackLabel ?? 'Fallback Template', tone: 'warn' };
  }
}

interface SpecDocumentViewProps {
  readonly spec: CadenceSpecArtifact;
  readonly headingBadge?: string;
}

function SpecDocumentView({ spec, headingBadge }: SpecDocumentViewProps) {
  const chordSections = [
    { key: 'conditions', heading: 'Conditions', items: spec.conditions },
    { key: 'handling', heading: 'Handling', items: spec.handling },
    { key: 'outcomes', heading: 'Outcomes', items: spec.outcomes },
    { key: 'rules', heading: 'Rules', items: spec.rules },
    { key: 'deltas', heading: 'Deltas', items: spec.deltas },
  ];

  return (
    <div className={styles.specCard}>
      <div className={styles.specHeaderRow}>
        <h3 className={styles.specTitle}>{spec.title}</h3>
        {headingBadge ? (
          <StatusPill tone='info' size='sm'>
            {headingBadge}
          </StatusPill>
        ) : null}
      </div>
      <p className={styles.specSummary}>{spec.summary}</p>
      <div className={styles.chordGrid}>
        {chordSections.map(section => (
          <div key={section.key} className={styles.chordGroup}>
            <h4 className={styles.chordHeading}>{section.heading}</h4>
            <ul className={styles.chordList}>
              {section.items.map((item, idx) => (
                <li key={`${section.key}-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {spec.recalledPatterns && spec.recalledPatterns.length > 0 ? (
        <div className={styles.patternRow}>
          {spec.recalledPatterns.map(pattern => (
            <StatusPill key={pattern} tone='info' size='sm'>
              {pattern}
            </StatusPill>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ArtifactInspector({
  artifactHtml,
  fileName = 'cadence-artifact.html',
  executionMode,
  runStatus,
  isGolden = false,
  spec,
  gateAudit,
  gateVerdict = 'pending',
  isPipelineBusy = false,
  isRunReady = true,
  isStreaming = false,
  streamLogs = [],
  labels,
  onGateVerdict,
  className,
}: ArtifactInspectorProps) {
  const [activeTab, setActiveTab] = useState<string>('preview');
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const modeBadge = resolveModeBadge(executionMode, labels);
  const streamText = streamLogs.join('\n');

  return (
    <section className={cx(styles.inspector, className)} data-testid='artifact-inspector'>
      <Tabs.Root
        value={activeTab}
        onValueChange={val => {
          if (typeof val === 'string') setActiveTab(val);
        }}
      >
        <div className={styles.header}>
          <Tabs.List className={styles.tabBar} aria-label='Artifact inspector tabs'>
            <Tabs.Tab value='preview' data-testid='cadence-view-preview'>
              {labels.tabPreviewLabel ?? 'Preview'}
            </Tabs.Tab>
            <Tabs.Tab value='spec' data-testid='cadence-view-spec'>
              {labels.tabSpecLabel ?? 'Spec'}
            </Tabs.Tab>
            <Tabs.Tab value='source' data-testid='cadence-view-source'>
              {labels.tabSourceLabel ?? 'Source Code'}
            </Tabs.Tab>
            <Tabs.Tab value='gate' data-testid='cadence-view-gate'>
              {labels.tabGateAuditLabel ?? 'Gate Audit'}
            </Tabs.Tab>
            <Tabs.Tab value='stream' data-testid='cadence-view-stream'>
              {labels.streamLogHeading ?? 'Pipeline Stream Output'}
            </Tabs.Tab>
          </Tabs.List>

          <div className={styles.headerMeta}>
            {modeBadge ? (
              <StatusPill
                tone={modeBadge.tone}
                size='sm'
                data-testid='cadence-execution-mode-badge'
                data-execution-mode={executionMode}
              >
                {modeBadge.label}
              </StatusPill>
            ) : null}
            <Button
              type='button'
              variant='ghost'
              size='xs'
              onClick={() => setFullscreenOpen(true)}
              data-testid='cadence-fullscreen-toggle'
            >
              <Button.Label>{labels.fullscreenLabel ?? 'Fullscreen'}</Button.Label>
            </Button>
          </div>
        </div>

        <Tabs.Panel value='preview'>
          {runStatus === 'awaiting_approval' ? (
            <div className={styles.buildLockedPanel} data-testid='cadence-build-locked-panel'>
              <StatusPill tone='warn' size='sm'>
                ⏸ Phase 3 Locked · Human Spec Gate
              </StatusPill>
              <h3 className={styles.specTitle}>Awaiting Spec Approval Before Build</h3>
              <p className={styles.specSummary}>
                Inspect the CHORD specification in the left panel. Click{' '}
                <strong>Approve Spec &amp; Start Build</strong> to authorize{' '}
                <code>chord-builder</code> to synthesize the sandboxed HTML5/CSS artifact, or
                request a spec revision first.
              </p>
            </div>
          ) : (
            <div className={styles.previewStack}>
              {isStreaming && streamLogs.length > 0 && (
                <StreamingTextFeed
                  content={streamText}
                  isStreaming={isStreaming}
                  ariaLabel={labels.streamLogHeading ?? 'Pipeline Stream Output'}
                  header={labels.streamLogHeading ?? 'Live Pipeline Stream'}
                  statusLabel='streaming'
                />
              )}
              <SandboxedArtifactFrame title={labels.iframeTitle} srcDoc={artifactHtml} />
            </div>
          )}
        </Tabs.Panel>

        <Tabs.Panel value='spec' data-testid='cadence-spec-panel'>
          {spec ? (
            <SpecDocumentView spec={spec} />
          ) : (
            <p className={styles.emptyNotice}>
              {labels.emptySpecNotice ??
                'Structured CHORD specification metadata is not available for this run.'}
            </p>
          )}
        </Tabs.Panel>

        <Tabs.Panel value='source'>
          <CodeArtifactViewer
            code={artifactHtml}
            fileName={fileName}
            copyLabel={labels.copySourceLabel}
            copiedLabel={labels.copiedSourceLabel}
            downloadLabel={labels.downloadSourceLabel}
          />
        </Tabs.Panel>

        <Tabs.Panel value='gate'>
          <GateAuditChecklist
            gateAudit={gateAudit}
            gateVerdict={gateVerdict}
            isGolden={isGolden}
            isPipelineBusy={isPipelineBusy}
            isRunReady={isRunReady}
            goldenVerifiedLabel={labels.goldenVerifiedBadgeLabel}
            goldenReadOnlyNotice={labels.goldenReadOnlyNotice}
            approveLabel={labels.approveGateLabel}
            rejectLabel={labels.rejectGateLabel}
            emptyNotice={labels.emptySpecNotice}
            onGateVerdict={onGateVerdict}
          />
        </Tabs.Panel>

        <Tabs.Panel value='stream' data-testid='cadence-stream-panel'>
          <StreamingTextFeed
            content={streamText}
            isStreaming={isStreaming}
            ariaLabel={labels.streamLogHeading ?? 'Pipeline Stream Output'}
            header={labels.streamLogHeading ?? 'Pipeline Stream Output'}
            statusLabel={isStreaming ? 'streaming' : streamLogs.length > 0 ? 'complete' : 'idle'}
            emptyText='Run a live or fast CADENCE build to watch pipeline stdout progress.'
          />
        </Tabs.Panel>
      </Tabs.Root>

      <Dialog.Root open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className={styles.fullscreenBackdrop} />
          <Dialog.Popup
            className={styles.fullscreenPopup}
            aria-modal='true'
            data-fullscreen='true'
            data-testid='cadence-fullscreen-dialog'
          >
            <div className={styles.fullscreenHeader}>
              <Dialog.Title className={styles.fullscreenTitle}>{labels.iframeTitle}</Dialog.Title>
              <Dialog.Close
                render={
                  <Button type='button' variant='ghost' size='xs'>
                    <Button.Label>{labels.exitFullscreenLabel ?? 'Exit Fullscreen'}</Button.Label>
                  </Button>
                }
              />
            </div>
            <SandboxedArtifactFrame
              title={`${labels.iframeTitle} (Fullscreen)`}
              srcDoc={artifactHtml}
              className={styles.fullscreenFrame}
            />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
