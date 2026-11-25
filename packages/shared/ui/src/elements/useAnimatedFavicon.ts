import { useEffect } from 'react';

const FRAME_COUNT = 16;
const SWEEP_AMPLITUDE = 5.5;
const FRAME_INTERVAL_MS = 140;
const STATIC_FAVICON_HREF = '/favicon.svg';

export function buildFaviconFrameDataUri(dx: number): string {
  const offset = Math.round(dx * 10) / 10;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">` +
    `<defs>` +
    `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0%" stop-color="#2c261f"/>` +
    `<stop offset="100%" stop-color="#141210"/>` +
    `</linearGradient>` +
    `<linearGradient id="b" x1="20" y1="6" x2="44" y2="58" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0%" stop-color="#ffe44d"/>` +
    `<stop offset="50%" stop-color="#ffa000"/>` +
    `<stop offset="100%" stop-color="#ff3d00"/>` +
    `</linearGradient>` +
    `<radialGradient id="f" cx="32" cy="28" r="20" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0%" stop-color="#352f27"/>` +
    `<stop offset="100%" stop-color="#171512"/>` +
    `</radialGradient>` +
    `</defs>` +
    `<rect x="2" y="2" width="60" height="60" rx="6" fill="url(#bg)" stroke="#ffb800" stroke-width="4"/>` +
    `<g transform="translate(${offset} 0)">` +
    `<circle cx="32" cy="32" r="20" fill="url(#f)" stroke="#ffd300" stroke-width="4.5"/>` +
    `<path d="M32 12 V20 M32 44 V52 M12 32 H20 M44 32 H52" stroke="#ffd300" stroke-width="4" stroke-linecap="round"/>` +
    `</g>` +
    `<path d="M37.5 6.5 L15.5 35.5 H29.5 L26.5 57.5 L48.5 28.5 H34.5 Z" fill="url(#b)" stroke="#121110" stroke-width="3.2" stroke-linejoin="round" paint-order="stroke"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const PRECOMPUTED_FRAMES: readonly string[] = Array.from({ length: FRAME_COUNT }, (_, idx) => {
  const phase = (idx / FRAME_COUNT) * Math.PI * 2;
  return buildFaviconFrameDataUri(Math.sin(phase) * SWEEP_AMPLITUDE);
});

export function useAnimatedFavicon(): void {
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return undefined;
    }

    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]');
    if (!link) {
      return undefined;
    }

    const mediaQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    let timer: ReturnType<typeof setInterval> | null = null;
    let frameIndex = 0;

    const stopTimer = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const stop = () => {
      stopTimer();
      link.href = STATIC_FAVICON_HREF;
    };

    const sync = () => {
      if (mediaQuery?.matches) {
        stop();
        return;
      }
      if (document.hidden) {
        stopTimer();
        return;
      }
      if (timer !== null) {
        return;
      }
      timer = setInterval(() => {
        frameIndex = (frameIndex + 1) % PRECOMPUTED_FRAMES.length;
        const nextHref = PRECOMPUTED_FRAMES[frameIndex];
        if (nextHref !== undefined) {
          link.href = nextHref;
        }
      }, FRAME_INTERVAL_MS);
    };

    sync();
    mediaQuery?.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);

    return () => {
      mediaQuery?.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
      stop();
    };
  }, []);
}
