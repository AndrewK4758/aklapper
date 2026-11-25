import type { CareerDossierPublishStatus, PrivacySanitizationFinding } from '@aklapper/core';

import { StatusPill } from '../elements/StatusPill';

import styles from './ValidationGatePreview.module.css';

export interface ValidationGatePreviewProps {
  readonly passed: boolean;
  readonly findings: readonly PrivacySanitizationFinding[];
  readonly chunkCount: number;
  readonly publishStatus: CareerDossierPublishStatus;
  readonly testId?: string;
}

export function ValidationGatePreview({
  passed,
  findings,
  chunkCount,
  publishStatus,
  testId,
}: ValidationGatePreviewProps) {
  const safePassed = passed && findings.length === 0;
  const safeChunkCount = Math.max(0, Math.floor(chunkCount));

  return (
    <section
      className={styles.container}
      aria-label='Privacy validation gate preview'
      data-testid={testId}
      data-gate-status={safePassed ? 'pass' : 'fail'}
    >
      <div className={styles.header}>
        <div className={styles.pillGroup}>
          <span data-testid={testId ? `${testId}-status` : undefined}>
            <StatusPill tone={safePassed ? 'success' : 'danger'} size='sm' as='output'>
              {safePassed ? 'Privacy Gate Passed' : `Privacy Gate Blocked (${findings.length})`}
            </StatusPill>
          </span>
          <span className={styles.metaBadge}>status: {publishStatus}</span>
        </div>
        <span className={styles.metaBadge}>
          {safeChunkCount} {safeChunkCount === 1 ? 'chunk' : 'chunks'}
        </span>
      </div>

      {findings.length > 0 ? (
        <ul className={styles.findingsList} aria-label='Privacy gate findings'>
          {findings.map((finding, index) => (
            <li
              key={`${finding.ruleId}-${finding.field}-${finding.location}-${index}`}
              className={styles.findingItem}
            >
              <span>rule: {finding.ruleId}</span>
              <span>category: {finding.category}</span>
              <span>field: {finding.field}</span>
              <span>location: {finding.location}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.cleanNote}>
          Ready for storage and deterministic chunk indexing (no blocked patterns detected).
        </p>
      )}
    </section>
  );
}
