import type { ReactNode } from 'react';

import { Progress, Separator } from '../../elements/base';
import { cx } from '../../elements/_internal/elementFactory';

import styles from './SiteContentPreview.module.css';

export interface MaintenanceProgressCardProps {
  readonly heading: string;
  readonly lead: string;
  readonly progressPercent: number;
  readonly progressAriaLabel: string;
  readonly metaLeft: string;
  readonly metaRight: string;
  readonly className?: string | undefined;
  readonly children?: ReactNode | undefined;
}

export function MaintenanceProgressCard({
  heading,
  lead,
  progressPercent,
  progressAriaLabel,
  metaLeft,
  metaRight,
  className,
  children,
}: MaintenanceProgressCardProps) {
  const clampedProgress = Math.max(0, Math.min(100, Math.round(progressPercent)));

  return (
    <div className={cx(styles.maintenanceGrid, className)}>
      <h1 className={styles.heroHeading}>{heading}</h1>
      <p className={styles.maintenanceLead}>{lead}</p>
      <Progress.Root
        className={styles.maintenanceProgress}
        value={clampedProgress}
        max={100}
        aria-label={progressAriaLabel}
      >
        <Progress.Track>
          <Progress.Indicator />
        </Progress.Track>
      </Progress.Root>
      {children}
      <Separator.Root />
      <div className={styles.maintenanceMetaRow}>
        <span>{metaLeft}</span>
        <span>{metaRight}</span>
      </div>
    </div>
  );
}
