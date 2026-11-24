import type { PublicAppError } from '@aklapper/core';
import type { ReactElement } from 'react';
import { Link, useInRouterContext } from 'react-router';

import { cx } from '../elements/_internal/elementFactory';
import { Button } from '../elements/base';

import styles from './ErrorElement.module.css';

export interface ErrorElementProps {
  readonly error: PublicAppError;
  readonly onRetry?: () => void;
  readonly isRetrying?: boolean;
  readonly homeHref?: string;
  readonly retryLabel?: string;
  readonly homeLabel?: string;
  readonly className?: string;
}

export function ErrorElement({
  error,
  onRetry,
  isRetrying = false,
  homeHref = '/',
  retryLabel = 'Retry',
  homeLabel = 'Return Home',
  className,
}: ErrorElementProps): ReactElement {
  const inRouterContext = useInRouterContext();

  return (
    <section
      role='alert'
      className={cx(styles.card, className)}
      data-error-code={error.code}
      data-http-status={error.status}
    >
      <div className={styles.header}>
        <code className={styles.codeBadge}>{error.code}</code>
        <span className={styles.statusBadge}>HTTP {error.status}</span>
      </div>

      <div className={styles.body}>
        <p className={styles.message}>{error.message}</p>
        <p className={styles.action}>{error.action}</p>
        <p className={styles.reference}>
          <span>Reference ID:</span>
          <code className={styles.correlationId}>{error.correlationId}</code>
        </p>
      </div>

      {onRetry || homeHref ? (
        <div className={styles.controls}>
          {onRetry ? (
            <Button
              type='button'
              variant='primary'
              size='sm'
              loading={isRetrying}
              onClick={onRetry}
            >
              <Button.Label>{isRetrying ? 'Retrying...' : retryLabel}</Button.Label>
            </Button>
          ) : null}

          {homeHref ? (
            inRouterContext ? (
              <Button.Link variant='secondary' size='sm' render={<Link to={homeHref} />}>
                <Button.Label>{homeLabel}</Button.Label>
              </Button.Link>
            ) : (
              <Button.Link variant='secondary' size='sm' href={homeHref}>
                <Button.Label>{homeLabel}</Button.Label>
              </Button.Link>
            )
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
