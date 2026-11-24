import type { StatusBadgeSpec } from '@aklapper/core';
import type { ReactNode } from 'react';

import { OscStatusBadge } from '../../elements/OscStatusBadge';
import { TuiWindow } from '../TuiWindow';

import styles from './SiteContentPreview.module.css';

export interface SiteContentWindowHeaderProps {
  readonly title: string;
  readonly heading?: string | undefined;
  readonly description: string;
  readonly statusBadge?: StatusBadgeSpec | undefined;
  readonly children?: ReactNode | undefined;
}

export function SiteContentWindowHeader({
  title,
  heading,
  description,
  statusBadge,
  children,
}: SiteContentWindowHeaderProps) {
  return (
    <TuiWindow
      title={title}
      badge={
        statusBadge ? (
          <OscStatusBadge
            source={statusBadge.source}
            state={statusBadge.state}
            label={statusBadge.label}
          />
        ) : undefined
      }
    >
      <div className={styles.windowHeaderBody}>
        {heading ? <h2 className={styles.heroHeading}>{heading}</h2> : null}
        <p className={styles.windowDescription}>{description}</p>
        {children}
      </div>
    </TuiWindow>
  );
}
