import type { CadenceRunResult } from '@aklapper/core';
import { Button, StatusPill, type StatusPillTone } from '@aklapper/ui';
import { type FormEvent, useState } from 'react';

import styles from './PortalCadencePage.module.css';

export interface CadenceSpecGatePaneProps {
  readonly activeRun: CadenceRunResult | null;
  readonly isStreaming: boolean;
  readonly isSubmitting: boolean;
  readonly onApproveSpec?: (runId: string) => void;
  readonly onReviseSpec?: (feedback: string) => void;
}

function resolveSpecStatusPill(
  activeRun: CadenceRunResult | null,
  isStreaming: boolean,
): { readonly label: string; readonly tone: StatusPillTone } {
  if (!activeRun) {
    return { label: 'Ready', tone: 'neutral' };
  }
  if (activeRun.isGolden) {
    return { label: 'Verified Golden', tone: 'accent' };
  }
  if (activeRun.runStatus === 'awaiting_approval') {
    return { label: 'Awaiting Approval', tone: 'warn' };
  }
  if (activeRun.runStatus === 'build_queued' || activeRun.runStatus === 'building') {
    return { label: 'Spec Approved · Building', tone: 'info' };
  }
  if (activeRun.runStatus === 'ready') {
    return { label: 'Approved & Built', tone: 'success' };
  }
  if (activeRun.runStatus === 'failed') {
    return { label: 'Failed', tone: 'danger' };
  }
  if (isStreaming || activeRun.runStatus === 'pending' || activeRun.runStatus === 'running') {
    return { label: 'Drafting Spec...', tone: 'info' };
  }
  return { label: 'Spec', tone: 'neutral' };
}

export function CadenceSpecGatePane({
  activeRun,
  isStreaming,
  isSubmitting,
  onApproveSpec,
  onReviseSpec,
}: CadenceSpecGatePaneProps) {
  const [specFeedback, setSpecFeedback] = useState('');
  const spec = activeRun?.spec;
  const isAwaitingApproval = Boolean(
    activeRun && !activeRun.isGolden && activeRun.runStatus === 'awaiting_approval',
  );
  const pill = resolveSpecStatusPill(activeRun, isStreaming);

  const chordSections = spec
    ? [
        { key: 'conditions', heading: 'Conditions', items: spec.conditions },
        { key: 'handling', heading: 'Handling', items: spec.handling },
        { key: 'outcomes', heading: 'Outcomes', items: spec.outcomes },
        { key: 'rules', heading: 'Rules', items: spec.rules },
        { key: 'deltas', heading: 'Deltas', items: spec.deltas },
      ]
    : [];

  const handleReviseSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = specFeedback.trim();
    if (trimmed.length < 3 || !onReviseSpec || isSubmitting || isStreaming) return;
    setSpecFeedback('');
    onReviseSpec(trimmed);
  };

  return (
    <section
      className={styles.specPane}
      aria-label='CHORD Specification and Human Gate'
      data-testid='cadence-live-spec-view'
    >
      <div className={styles.specPaneHeader}>
        <h2 className={styles.sectionTitle}>CHORD Specification</h2>
        <StatusPill tone={pill.tone} size='sm' data-testid='cadence-spec-status-pill'>
          {pill.label}
        </StatusPill>
      </div>

      {isAwaitingApproval && activeRun && (
        <div className={styles.humanGateBanner} data-testid='cadence-human-spec-gate'>
          <div className={styles.humanGateHeader}>
            <span className={styles.humanGateBadge}>⏸ HUMAN SPEC GATE</span>
            <p className={styles.humanGateCopy}>
              Review the generated CHORD specification below. Phase 3 (Build) will not execute until
              you approve this spec or request a revision.
            </p>
          </div>
          <div className={styles.humanGateActions}>
            {onApproveSpec && (
              <Button
                type='button'
                variant='primary'
                size='sm'
                disabled={isSubmitting || isStreaming}
                onClick={() => onApproveSpec(activeRun.runId)}
                data-testid='cadence-spec-approve'
              >
                <Button.Label>
                  {isSubmitting ? 'Starting Build...' : 'Approve Spec & Start Build'}
                </Button.Label>
              </Button>
            )}
          </div>
          {onReviseSpec && (
            <form className={styles.specReviseForm} onSubmit={handleReviseSubmit}>
              <input
                type='text'
                className={styles.revisionInput}
                value={specFeedback}
                onChange={event => setSpecFeedback(event.currentTarget.value)}
                placeholder='Request changes to this spec before building...'
                aria-label='Spec revision feedback'
                data-testid='cadence-spec-revise-input'
              />
              <Button
                type='submit'
                variant='ghost'
                size='xs'
                disabled={isSubmitting || isStreaming || specFeedback.trim().length < 3}
                data-testid='cadence-spec-revise-submit'
              >
                <Button.Label>Revise Spec</Button.Label>
              </Button>
            </form>
          )}
        </div>
      )}

      {spec ? (
        <div className={styles.specDoc}>
          <h3 className={styles.specDocTitle}>{spec.title}</h3>
          <p className={styles.specDocSummary}>{spec.summary}</p>
          <div className={styles.specDocGrid}>
            {chordSections.map(section => (
              <div key={section.key} className={styles.specDocGroup}>
                <h4 className={styles.specDocHeading}>{section.heading}</h4>
                <ul className={styles.specDocList}>
                  {section.items.map((item, idx) => (
                    <li key={`${section.key}-${idx}`}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {spec.recalledPatterns && spec.recalledPatterns.length > 0 && (
            <div className={styles.specPatternRow}>
              {spec.recalledPatterns.map(pattern => (
                <StatusPill key={pattern} tone='info' size='sm'>
                  {pattern}
                </StatusPill>
              ))}
            </div>
          )}
        </div>
      ) : isStreaming ||
        activeRun?.runStatus === 'pending' ||
        activeRun?.runStatus === 'running' ? (
        <p className={styles.specEmptyState} data-testid='cadence-spec-streaming-notice'>
          Authoring live CHORD specification from your prompt...
        </p>
      ) : (
        <p className={styles.specEmptyState}>
          Submit a prompt above to generate a tailored CHORD specification for human review before
          build execution.
        </p>
      )}
    </section>
  );
}
