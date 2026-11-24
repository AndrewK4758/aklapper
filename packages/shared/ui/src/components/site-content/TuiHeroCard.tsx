import type { LinkActionSpec } from '@aklapper/core';
import type { ReactNode } from 'react';

import { cx } from '../../elements/_internal/elementFactory';
import { Button, Toolbar } from '../../elements/base';

import styles from './SiteContentPreview.module.css';

export interface TuiHeroCardProps {
  readonly heading: string;
  readonly description: string;
  readonly actions: readonly LinkActionSpec[];
  readonly actionsAriaLabel?: string | undefined;
  readonly className?: string | undefined;
  readonly actionsClassName?: string | undefined;
  readonly renderAction?: ((action: LinkActionSpec, index: number) => ReactNode) | undefined;
}

export function TuiHeroCard({
  heading,
  description,
  actions,
  actionsAriaLabel = 'Launch actions',
  className,
  actionsClassName,
  renderAction,
}: TuiHeroCardProps) {
  return (
    <div className={cx(styles.heroBody, className)}>
      <h1 className={styles.heroHeading}>{heading}</h1>
      <p className={styles.heroDescription}>{description}</p>
      <Toolbar.Root
        className={cx(styles.heroActions, actionsClassName)}
        aria-label={actionsAriaLabel}
      >
        {actions.map((action, index) =>
          renderAction ? (
            renderAction(action, index)
          ) : (
            <Button.Root
              key={`${action.to}-${index}`}
              type='button'
              variant={action.variant}
              size='sm'
            >
              <Button.Label>{action.label}</Button.Label>
            </Button.Root>
          ),
        )}
      </Toolbar.Root>
    </div>
  );
}
