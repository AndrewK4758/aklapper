import type { ActionErrorMetadata } from '@aklapper/core';
import type { ReactElement } from 'react';

import { cx } from '../elements/_internal/elementFactory';

import styles from './ActionFeedbackBanner.module.css';

export interface ActionFeedbackBannerProps extends ActionErrorMetadata {
  readonly ok: boolean;
  readonly message: string;
  readonly testId?: string;
  readonly className?: string;
}

export function ActionFeedbackBanner({
  ok,
  message,
  action,
  code,
  correlationId,
  testId,
  className,
}: ActionFeedbackBannerProps): ReactElement {
  if (ok) {
    return (
      <output className={cx(styles.statusNote, className)} data-testid={testId}>
        {message}
      </output>
    );
  }

  return (
    <div role='alert' className={cx(styles.errorNote, className)} data-testid={testId}>
      <p className={styles.message}>{message}</p>
      {action ? <p className={styles.action}>{action}</p> : null}
      {code || correlationId ? (
        <p className={styles.meta}>
          {code ? <span>{code}</span> : null}
          {correlationId ? <span>ref: {correlationId}</span> : null}
        </p>
      ) : null}
    </div>
  );
}
