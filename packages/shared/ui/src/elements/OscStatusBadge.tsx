import type { Osc7501State } from '@aklapper/contracts';

import { Progress } from './base/Progress';
import { Separator } from './base/Separator';

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
      <Separator.Root orientation='vertical' className={styles.divider} />
      <span>{label}</span>
      {typeof progress === 'number' ? (
        <Progress.Root
          className={styles.progress}
          value={progress}
          max={100}
          aria-label={`${source} progress`}
        >
          <Progress.Track className={styles.progressTrack}>
            <Progress.Indicator />
          </Progress.Track>
          <Progress.Value>{(_formatted, value) => `${value ?? progress}%`}</Progress.Value>
        </Progress.Root>
      ) : null}
    </output>
  );
}
