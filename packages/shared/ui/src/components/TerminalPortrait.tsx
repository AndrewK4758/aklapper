import { type CSSProperties, useState } from 'react';

import defaultPortraitSrc from '../assets/andrew-klapper-portrait.webp';
import { cx } from '../elements/_internal/elementFactory';

import styles from './TerminalPortrait.module.css';

export type TerminalPortraitSize = 'sm' | 'md' | 'lg';
export type TerminalPortraitVariant = 'terminal' | 'profile';

export const DEFAULT_PORTRAIT_PATH = '/images/andrew-klapper-portrait.webp';
export const DEFAULT_PORTRAIT_WIDTH = 440;
export const DEFAULT_PORTRAIT_HEIGHT = 520;
export const DEFAULT_PORTRAIT_SRC: string = defaultPortraitSrc;

export interface TerminalPortraitProps {
  readonly src?: string;
  readonly alt: string;
  readonly width?: number;
  readonly height?: number;
  readonly caption?: string;
  readonly ttyLabel?: string;
  readonly size?: TerminalPortraitSize;
  readonly variant?: TerminalPortraitVariant;
  readonly priority?: boolean;
  readonly showScanlines?: boolean;
  readonly className?: string;
}

export function TerminalPortrait({
  src,
  alt,
  width = DEFAULT_PORTRAIT_WIDTH,
  height = DEFAULT_PORTRAIT_HEIGHT,
  caption,
  ttyLabel,
  size = 'md',
  variant = 'terminal',
  priority = false,
  showScanlines = true,
  className,
}: TerminalPortraitProps) {
  const resolvedSrc = !src || src === DEFAULT_PORTRAIT_PATH ? DEFAULT_PORTRAIT_SRC : src;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const hasLoadError = !resolvedSrc || failedSrc === resolvedSrc;

  const frameStyle = {
    aspectRatio: `${width} / ${height}`,
  } satisfies CSSProperties;

  const handleImageError = () => {
    if (failedSrc === resolvedSrc) {
      return;
    }
    setFailedSrc(resolvedSrc);
    console.warn(
      JSON.stringify({
        event: 'portal.home.portrait_load_fallback',
        seam_type: 'BOUNDARY_FAULT',
        variant,
        size,
        hasCustomSrc: Boolean(src && src !== DEFAULT_PORTRAIT_PATH),
      }),
    );
  };

  return (
    <figure
      className={cx(styles.figure, className)}
      data-terminal-portrait='true'
      data-variant={variant}
      data-size={size}
    >
      <div className={styles.frame} style={frameStyle}>
        {ttyLabel ? <span className={styles.ttyBadge}>{ttyLabel}</span> : null}
        {hasLoadError ? (
          <div className={styles.fallback} aria-label={alt} data-portrait-fallback='true'>
            <span className={styles.monogram} aria-hidden='true'>
              AK
            </span>
            <span className={styles.fallbackSub}>PORTRAIT OFFLINE</span>
          </div>
        ) : (
          <>
            <img
              className={styles.image}
              src={resolvedSrc}
              alt={alt}
              width={width}
              height={height}
              decoding='async'
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : undefined}
              onError={handleImageError}
            />
            {showScanlines ? <span className={styles.scanlines} aria-hidden='true' /> : null}
          </>
        )}
      </div>
      {caption ? <figcaption className={styles.caption}>{caption}</figcaption> : null}
    </figure>
  );
}
