import type { ReactElement } from 'react';

import { cx } from '../elements/_internal/elementFactory';

import styles from './LoadingElement.module.css';

export interface LoadingElementProps {
  readonly label?: string;
  readonly detail?: string;
  readonly className?: string;
}

export function LoadingElement({
  label = 'Loading section...',
  detail,
  className,
}: LoadingElementProps): ReactElement {
  return (
    <output aria-live='polite' aria-busy='true' className={cx(styles.root, className)}>
      <span className={styles.header}>
        <span className={styles.spinner} aria-hidden='true' />
        <span className={styles.label}>{label}</span>
      </span>
      {detail ? <span className={styles.detail}>{detail}</span> : null}
      <span className={styles.track} aria-hidden='true'>
        <span className={styles.bar} />
      </span>
    </output>
  );
}
