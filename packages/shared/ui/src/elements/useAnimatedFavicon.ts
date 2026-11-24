import { useEffect } from 'react';

const FRAME_COUNT = 16;
const SWEEP_AMPLITUDE = 5;
const FRAME_INTERVAL_MS = 140;
const STATIC_FAVICON_HREF = '/favicon.svg';

export function buildFaviconFrameDataUri(dx: number): string {
  const offset = Math.round(dx * 10) / 10;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">` +
    `<defs>` +
    `<linearGradient id="b" x1="22" y1="10" x2="42" y2="54" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0%" stop-color="#ffe44d"/>` +
    `<stop offset="50%" stop-color="#ffa000"/>` +
    `<stop offset="100%" stop-color="#ff3d00"/>` +
    `</linearGradient>` +
    `<radialGradient id="f" cx="32" cy="26" r="30" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0%" stop-color="#262420"/>` +
    `<stop offset="100%" stop-color="#121110"/>` +
    `</radialGradient>` +
    `<clipPath id="c"><circle cx="32" cy="32" r="27.25"/></clipPath>` +
    `</defs>` +
    `<circle cx="32" cy="32" r="29.5" fill="url(#f)" stroke="#ffd300" stroke-width="4.5"/>` +
    `<g clip-path="url(#c)">` +
    `<g transform="translate(${offset} 0)">` +
    `<path d="M32 3 V12.5 M32 51.5 V61 M3 32 H14.5 M49.5 32 H61" stroke="#ffd300" stroke-width="3.8" stroke-linecap="round"/>` +
    `</g>` +
    `</g>` +
    `<path d="M36.5 11.5 L18.5 35 H29.5 L27.5 52.5 L45.5 29 H34.5 Z" fill="url(#b)" stroke="#141312" stroke-width="2" stroke-linejoin="round" paint-order="stroke"/>` +
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
