import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from './_internal/elementFactory';

import styles from './StatusPill.module.css';

export type StatusPillTone = 'neutral' | 'info' | 'success' | 'warn' | 'danger' | 'accent';
export type StatusPillSize = 'sm' | 'md';

export interface StatusPillProps extends Omit<
  HTMLAttributes<HTMLElement>,
  'children' | 'className'
> {
  readonly tone?: StatusPillTone;
  readonly size?: StatusPillSize;
  readonly pulse?: boolean;
  readonly as?: 'span' | 'output';
  readonly children: ReactNode;
  readonly className?: string;
}

export function StatusPill({
  tone = 'neutral',
  size = 'sm',
  pulse = false,
  as = 'span',
  children,
  className,
  ...rest
}: StatusPillProps) {
  const Tag = as;
  return (
    <Tag
      {...rest}
      className={cx(styles.pill, className)}
      data-tone={tone}
      data-size={size}
      data-pulse={pulse ? 'true' : undefined}
    >
      {pulse ? <span className={styles.dot} aria-hidden='true' /> : null}
      <span className={styles.label}>{children}</span>
    </Tag>
  );
}
