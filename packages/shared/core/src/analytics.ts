import { onCLS, onINP, onLCP, onTTFB } from 'web-vitals';

import type { AnalyticsBatch, AnalyticsEvent } from './index.ts';

export interface AnalyticsClientOptions {
  endpoint: string;
  respectPrivacySignals?: boolean;
  maxBatchSize?: number;
  transport?: (endpoint: string, payload: AnalyticsBatch) => void;
}

export interface AnalyticsClient {
  readonly enabled: boolean;
  readonly sessionId: string;
  track: (event: Omit<AnalyticsEvent, 'timestamp'>) => void;
  startWebVitals: () => void;
  flush: () => void;
}

interface NavigatorWithGpc extends Navigator {
  globalPrivacyControl?: boolean;
}

export function isPrivacyOptOut(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as NavigatorWithGpc;
  return nav.doNotTrack === '1' || nav.globalPrivacyControl === true;
}

function defaultTransport(endpoint: string, payload: AnalyticsBatch): void {
  const body = JSON.stringify(payload);
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon(endpoint, blob)) return;
  }
  if (typeof fetch === 'function') {
    void fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  }
}

export function createAnalyticsClient(options: AnalyticsClientOptions): AnalyticsClient {
  const respectPrivacy = options.respectPrivacySignals ?? true;
  const enabled = !(respectPrivacy && isPrivacyOptOut());
  const sessionId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `sess-${Date.now()}`;
  const maxBatchSize = options.maxBatchSize ?? 10;
  const send = options.transport ?? defaultTransport;
  const queue: AnalyticsEvent[] = [];

  const flush = (): void => {
    if (!enabled || queue.length === 0) return;
    const events = queue.splice(0, queue.length);
    const referrer =
      typeof document !== 'undefined' && document.referrer ? document.referrer : undefined;
    send(options.endpoint, { sessionId, referrer, events });
  };

  const track = (event: Omit<AnalyticsEvent, 'timestamp'>): void => {
    if (!enabled) return;
    queue.push({ ...event, timestamp: new Date().toISOString() });
    if (queue.length >= maxBatchSize) flush();
  };

  const startWebVitals = (): void => {
    if (!enabled || typeof window === 'undefined') return;
    const report = (name: string, value: number) => {
      track({
        type: 'web_vital',
        name,
        path: window.location.pathname,
        value: Math.round(value * 100) / 100,
      });
    };
    onLCP(metric => report('LCP', metric.value));
    onINP(metric => report('INP', metric.value));
    onCLS(metric => report('CLS', metric.value));
    onTTFB(metric => report('TTFB', metric.value));
  };

  return { enabled, sessionId, track, startWebVitals, flush };
}

let activeAnalyticsClient: AnalyticsClient | null = null;
let activeAnalyticsAppName = 'portal';
let lastTrackedPathname: string | null = null;
let historyTrackingCleanup: (() => void) | null = null;

function normalizeRoutePathname(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed) return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function getActiveAnalyticsClient(): AnalyticsClient | null {
  return activeAnalyticsClient;
}

export function trackRouteNavigation(pathname: string, appName = activeAnalyticsAppName): void {
  if (!activeAnalyticsClient || !activeAnalyticsClient.enabled) return;
  const normalized = normalizeRoutePathname(pathname);
  if (lastTrackedPathname === normalized) return;
  lastTrackedPathname = normalized;
  activeAnalyticsClient.track({
    type: 'page_view',
    name: `${appName}_page_view`,
    path: normalized,
    metadata: { app: appName, navigation: 'spa' },
  });
}

function installSpaHistoryTracking(): () => void {
  const originalPushState = window.history.pushState.bind(window.history);
  const handlePopState = (): void => {
    trackRouteNavigation(window.location.pathname || '/');
  };

  window.history.pushState = function patchedPushState(
    data: unknown,
    unused: string,
    url?: string | URL | null,
  ): void {
    originalPushState(data, unused, url);
    trackRouteNavigation(window.location.pathname || '/');
  };

  window.addEventListener('popstate', handlePopState);

  return () => {
    window.history.pushState = originalPushState;
    window.removeEventListener('popstate', handlePopState);
  };
}

export function resetAnalyticsBootstrap(): void {
  if (historyTrackingCleanup) {
    historyTrackingCleanup();
    historyTrackingCleanup = null;
  }
  activeAnalyticsClient = null;
  activeAnalyticsAppName = 'portal';
  lastTrackedPathname = null;
}

export function bootstrapDocumentAnalytics(
  doc: Document | undefined = typeof document !== 'undefined' ? document : undefined,
): AnalyticsClient | null {
  if (!doc || typeof window === 'undefined') return null;

  const endpointMeta = doc.querySelector<HTMLMetaElement>(
    'meta[name="aklapper-analytics-endpoint"]',
  );
  const endpoint = endpointMeta?.content.trim();
  if (!endpoint) return null;

  const appMeta = doc.querySelector<HTMLMetaElement>('meta[name="aklapper-analytics-app"]');
  const appName = appMeta?.content.trim() || 'portal';

  if (historyTrackingCleanup) {
    historyTrackingCleanup();
    historyTrackingCleanup = null;
  }

  const client = createAnalyticsClient({ endpoint });
  activeAnalyticsClient = client;
  activeAnalyticsAppName = appName;

  if (!client.enabled) return client;

  const initialPath = normalizeRoutePathname(window.location.pathname || '/');
  lastTrackedPathname = initialPath;

  client.startWebVitals();
  client.track({
    type: 'page_view',
    name: `${appName}_page_view`,
    path: initialPath,
    metadata: { app: appName },
  });

  const cleanupHistory = installSpaHistoryTracking();
  const handlePageHide = (): void => {
    client.flush();
  };
  const handleVisibilityChange = (): void => {
    if (doc.visibilityState === 'hidden') {
      client.flush();
    }
  };

  window.addEventListener('pagehide', handlePageHide);
  doc.addEventListener('visibilitychange', handleVisibilityChange);

  historyTrackingCleanup = () => {
    cleanupHistory();
    window.removeEventListener('pagehide', handlePageHide);
    doc.removeEventListener('visibilitychange', handleVisibilityChange);
  };

  return client;
}
