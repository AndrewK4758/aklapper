import type { CadenceGateAudit, CadenceGateCheckStatus, CadenceGateVerdict } from '@aklapper/core';

import { cx } from '../elements/_internal/elementFactory';
import { Button } from '../elements/base/Button';
import { StatusPill, type StatusPillTone } from '../elements/StatusPill';

import styles from './GateAuditChecklist.module.css';

export interface GateAuditChecklistProps {
  readonly gateAudit?: CadenceGateAudit;
  readonly gateVerdict: CadenceGateVerdict;
  readonly isGolden?: boolean;
  readonly isPipelineBusy?: boolean;
  readonly isRunReady?: boolean;
  readonly goldenVerifiedLabel?: string;
  readonly goldenReadOnlyNotice?: string;
  readonly approveLabel?: string;
  readonly rejectLabel?: string;
  readonly emptyNotice?: string;
  readonly onGateVerdict?: (verdict: Exclude<CadenceGateVerdict, 'pending'>) => void;
  readonly className?: string;
}

function verdictTone(verdict: CadenceGateVerdict): StatusPillTone {
  if (verdict === 'approved') return 'success';
  if (verdict === 'rejected') return 'danger';
  return 'warn';
}

function checkStatusTone(status: CadenceGateCheckStatus): StatusPillTone {
  if (status === 'pass') return 'success';
  if (status === 'warn') return 'warn';
  return 'danger';
}

export function GateAuditChecklist({
  gateAudit,
  gateVerdict,
  isGolden = false,
  isPipelineBusy = false,
  isRunReady = true,
  goldenVerifiedLabel = 'Verified Golden',
  goldenReadOnlyNotice = 'Verified Golden Showcase run — read-only reference artifact.',
  approveLabel = 'Approve Gate',
  rejectLabel = 'Reject Gate',
  emptyNotice = 'Structured gate audit details are not available for this run.',
  onGateVerdict,
  className,
}: GateAuditChecklistProps) {
  return (
    <section className={cx(styles.checklist, className)} data-testid='gate-audit-checklist'>
      <div className={styles.header}>
        <div className={styles.pills}>
          <StatusPill tone={verdictTone(gateVerdict)} size='sm'>
            gate: {gateVerdict}
          </StatusPill>
          {isGolden ? (
            <StatusPill tone='accent' size='sm' data-testid='gate-audit-golden-badge'>
              {goldenVerifiedLabel}
            </StatusPill>
          ) : null}
          {gateAudit ? (
            <StatusPill tone={gateAudit.sanitized ? 'warn' : 'success'} size='sm'>
              {gateAudit.sanitized ? 'sanitized' : 'csp clean'} · {gateAudit.artifactBytes} B
            </StatusPill>
          ) : null}
        </div>

        {!isGolden && onGateVerdict ? (
          <div className={styles.controls}>
            <Button
              type='button'
              variant='primary'
              size='xs'
              disabled={isPipelineBusy || !isRunReady || gateVerdict === 'approved'}
              onClick={() => onGateVerdict('approved')}
              data-testid='gate-audit-approve'
            >
              <Button.Label>{approveLabel}</Button.Label>
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='xs'
              disabled={isPipelineBusy || !isRunReady || gateVerdict === 'rejected'}
              onClick={() => onGateVerdict('rejected')}
              data-testid='gate-audit-reject'
            >
              <Button.Label>{rejectLabel}</Button.Label>
            </Button>
          </div>
        ) : null}
      </div>

      {isGolden ? (
        <p className={styles.goldenNotice} data-testid='gate-audit-readonly-notice'>
          {goldenReadOnlyNotice}
        </p>
      ) : null}

      {gateAudit ? (
        <>
          <p className={styles.summary}>{gateAudit.summary}</p>
          <ul className={styles.list}>
            {gateAudit.checks.map(check => (
              <li key={check.id} className={styles.item} data-check-status={check.status}>
                <div className={styles.itemTop}>
                  <span className={styles.itemLabel}>{check.label}</span>
                  <StatusPill tone={checkStatusTone(check.status)} size='sm'>
                    {check.status}
                  </StatusPill>
                </div>
                <p className={styles.itemDetail}>{check.detail}</p>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className={styles.empty}>{emptyNotice}</p>
      )}
    </section>
  );
}
