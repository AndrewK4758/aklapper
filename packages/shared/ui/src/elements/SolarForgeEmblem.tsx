import styles from './SolarForgeEmblem.module.css';

export interface SolarForgeEmblemProps {
  size?: number;
}

export function SolarForgeEmblem({ size = 20 }: SolarForgeEmblemProps) {
  return (
    <svg
      className={styles.emblem}
      width={size}
      height={size}
      viewBox='0 0 16 16'
      aria-hidden='true'
    >
      <circle className={styles.ring} cx='8' cy='8' r='7' />
      <path className={styles.bolt} d='M8 3.2 L11.4 8.6 L8.6 8.6 L9.4 12.8 L4.6 7.4 L7.4 7.4 Z' />
      <circle className={styles.core} cx='8' cy='8' r='1.4' />
    </svg>
  );
}
