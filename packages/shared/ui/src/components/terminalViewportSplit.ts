import { useSyncExternalStore } from 'react';

import type { SplitCreateDirection } from './terminalPaneTree';

const PORTRAIT_MEDIA_QUERY = '(orientation: portrait)';

export type ViewportLayoutMode = 'desktop' | 'mobile-portrait' | 'mobile-landscape';
export type ElementViewMode = 'auto' | 'desktop' | 'mobile';
export type ServerViewportLayoutMode = 'desktop' | 'mobile-portrait';

export const MOBILE_PORTRAIT_MEDIA_QUERY = '(max-width: 48rem)';
export const MOBILE_LANDSCAPE_MEDIA_QUERY = '(max-height: 32rem) and (orientation: landscape)';

const MOBILE_USER_AGENT_REGEX =
  /Android.*Mobile|iPhone|iPod|IEMobile|Mobile Safari|Windows Phone|BlackBerry/i;

type HeaderMap = Headers | Readonly<Record<string, string | string[] | undefined>>;

function readHeaderValue(headers: HeaderMap, name: string): string | undefined {
  if (typeof (headers as Headers).get === 'function') {
    const value = (headers as Headers).get(name);
    return value ?? undefined;
  }
  const record = headers as Readonly<Record<string, string | string[] | undefined>>;
  const target = name.toLowerCase();
  for (const [key, raw] of Object.entries(record)) {
    if (key.toLowerCase() === target) {
      if (Array.isArray(raw)) {
        return raw[0];
      }
      return raw;
    }
  }
  return undefined;
}

export function detectServerViewportMode(headers: HeaderMap): ServerViewportLayoutMode {
  const chMobile = readHeaderValue(headers, 'sec-ch-ua-mobile')?.trim();
  if (chMobile === '?1') {
    return 'mobile-portrait';
  }
  if (chMobile === '?0') {
    return 'desktop';
  }
  const userAgent = readHeaderValue(headers, 'user-agent')?.trim() ?? '';
  if (userAgent.length > 0 && MOBILE_USER_AGENT_REGEX.test(userAgent)) {
    return 'mobile-portrait';
  }
  return 'desktop';
}

export function resolveElementViewport(
  ambientMode: ViewportLayoutMode,
  viewMode?: ElementViewMode,
): ViewportLayoutMode {
  if (viewMode === 'desktop') {
    return 'desktop';
  }
  if (viewMode === 'mobile') {
    return ambientMode === 'mobile-landscape' ? 'mobile-landscape' : 'mobile-portrait';
  }
  return ambientMode;
}

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

export function subscribeViewportLayoutMode(onStoreChange: () => void): () => void {
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

export function useViewportLayoutMode(
  initialMode: ViewportLayoutMode = 'desktop',
): ViewportLayoutMode {
  return useSyncExternalStore(
    subscribeViewportLayoutMode,
    resolveViewportLayoutMode,
    () => initialMode ?? getServerViewportLayoutMode(),
  );
}
