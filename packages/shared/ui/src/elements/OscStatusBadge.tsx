import type { Osc7501State } from '@aklapper/contracts';

import styles from './OscStatusBadge.module.css';

export interface OscStatusBadgeProps {
  source: string;
  state: Osc7501State;
  label: string;
  progress?: number;
}

export function OscStatusBadge({ source, state, label, progress }: OscStatusBadgeProps) {
  return (
    <output className={styles.badge} data-state={state}>
      <strong>{source}</strong>
      <span>{label}</span>
      {typeof progress === 'number' ? <span>{progress}%</span> : null}
    </output>
  );
}
