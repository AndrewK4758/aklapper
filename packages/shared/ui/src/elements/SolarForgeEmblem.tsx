import { useId } from 'react';

import styles from './SolarForgeEmblem.module.css';

export interface SolarForgeEmblemProps {
  size?: number;
}

export function SolarForgeEmblem({ size = 20 }: SolarForgeEmblemProps) {
  const clipId = useId();
  return (
    <svg
      className={styles.emblem}
      width={size}
      height={size}
      viewBox='0 0 64 64'
      aria-hidden='true'
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx='32' cy='32' r='27.25' />
        </clipPath>
      </defs>
      <circle className={styles.ring} cx='32' cy='32' r='29.5' />
      <g clipPath={`url(#${clipId})`}>
        <g className={styles.crosshairs}>
          <path
            className={styles.ticks}
            d='M32 3 V12.5 M32 51.5 V61 M3 32 H14.5 M49.5 32 H61'
            strokeLinecap='round'
          />
        </g>
      </g>
      <path
        className={styles.bolt}
        d='M36.5 11.5 L18.5 35 H29.5 L27.5 52.5 L45.5 29 H34.5 Z'
        strokeLinejoin='round'
      />
    </svg>
  );
}
