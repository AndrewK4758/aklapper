import { useSyncExternalStore } from 'react';

import type { SplitCreateDirection } from './terminalPaneTree';

const PORTRAIT_MEDIA_QUERY = '(orientation: portrait)';

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

function subscribeViewportOrientation(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const cleanups: Array<() => void> = [];
  if (typeof window.matchMedia === 'function') {
    const query = window.matchMedia(PORTRAIT_MEDIA_QUERY);
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', onStoreChange);
      cleanups.push(() => query.removeEventListener('change', onStoreChange));
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

function getServerAutoSplitDirection(): SplitCreateDirection {
  return 'right';
}

export function useAutoSplitDirection(): SplitCreateDirection {
  return useSyncExternalStore(
    subscribeViewportOrientation,
    resolveAutoSplitDirection,
    getServerAutoSplitDirection,
  );
}
