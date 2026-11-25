import { useSyncExternalStore } from 'react';

import type { SplitCreateDirection } from './terminalPaneTree';

const PORTRAIT_MEDIA_QUERY = '(orientation: portrait)';

export type ViewportLayoutMode = 'desktop' | 'mobile-portrait' | 'mobile-landscape';

export const MOBILE_PORTRAIT_MEDIA_QUERY = '(max-width: 48rem)';
export const MOBILE_LANDSCAPE_MEDIA_QUERY = '(max-height: 32rem) and (orientation: landscape)';

export function isPortraitViewport(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  if (typeof window.matchMedia === 'function') {
    const query = window.matchMedia(PORTRAIT_MEDIA_QUERY);
    if (typeof query.matches === 'boolean') {
      return query.matches;
    }
  }
  return window.innerHeight > window.innerWidth;
}

export function resolveAutoSplitDirection(): SplitCreateDirection {
  return isPortraitViewport() ? 'down' : 'right';
}

export function resolveViewportLayoutMode(): ViewportLayoutMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'desktop';
  }
  const landscapeQuery = window.matchMedia(MOBILE_LANDSCAPE_MEDIA_QUERY);
  if (landscapeQuery?.matches === true) {
    return 'mobile-landscape';
  }
  const portraitQuery = window.matchMedia(MOBILE_PORTRAIT_MEDIA_QUERY);
  if (portraitQuery?.matches === true) {
    return 'mobile-portrait';
  }
  return 'desktop';
}

function subscribeMediaQueries(queries: readonly string[], onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const cleanups: Array<() => void> = [];
  if (typeof window.matchMedia === 'function') {
    for (const media of queries) {
      const query = window.matchMedia(media);
      if (query && typeof query.addEventListener === 'function') {
        query.addEventListener('change', onStoreChange);
        cleanups.push(() => query.removeEventListener('change', onStoreChange));
      }
    }
  }
  window.addEventListener('resize', onStoreChange);
  cleanups.push(() => window.removeEventListener('resize', onStoreChange));
  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

function subscribeViewportOrientation(onStoreChange: () => void): () => void {
  return subscribeMediaQueries([PORTRAIT_MEDIA_QUERY], onStoreChange);
}

function subscribeViewportLayoutMode(onStoreChange: () => void): () => void {
  return subscribeMediaQueries(
    [MOBILE_LANDSCAPE_MEDIA_QUERY, MOBILE_PORTRAIT_MEDIA_QUERY],
    onStoreChange,
  );
}

function getServerAutoSplitDirection(): SplitCreateDirection {
  return 'right';
}

function getServerViewportLayoutMode(): ViewportLayoutMode {
  return 'desktop';
}

export function useAutoSplitDirection(): SplitCreateDirection {
  return useSyncExternalStore(
    subscribeViewportOrientation,
    resolveAutoSplitDirection,
    getServerAutoSplitDirection,
  );
}

export function useViewportLayoutMode(): ViewportLayoutMode {
  return useSyncExternalStore(
    subscribeViewportLayoutMode,
    resolveViewportLayoutMode,
    getServerViewportLayoutMode,
  );
}
