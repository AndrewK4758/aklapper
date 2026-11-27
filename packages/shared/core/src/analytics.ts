import {
  createAnalyticsClient,
  normalizeAnalyticsPathname,
  type AnalyticsClient,
  type AnalyticsTrackOptions,
} from './analytics-client.ts';

export {
  createAnalyticsClient,
  isPrivacyOptOut,
  type AnalyticsClient,
  type AnalyticsClientOptions,
  type AnalyticsTrackOptions,
  type AnalyticsTransportOptions,
} from './analytics-client.ts';
export * from './error-reporter.ts';

let activeAnalyticsClient: AnalyticsClient | null = null;
let activeAnalyticsAppName = 'portal';
let lastTrackedPathname: string | null = null;
let historyTrackingCleanup: (() => void) | null = null;
const sessionIdListeners = new Set<() => void>();

function notifySessionIdListeners(): void {
  for (const listener of sessionIdListeners) {
    listener();
  }
}

export function getActiveAnalyticsClient(): AnalyticsClient | null {
  return activeAnalyticsClient;
}

export function getActiveAnalyticsSessionId(): string {
  if (!activeAnalyticsClient || !activeAnalyticsClient.enabled) return '';
  return activeAnalyticsClient.sessionId;
}

export function subscribeAnalyticsSessionId(listener: () => void): () => void {
  sessionIdListeners.add(listener);
  return () => {
    sessionIdListeners.delete(listener);
  };
}

export function trackRouteNavigation(pathname: string, appName = activeAnalyticsAppName): void {
  if (!activeAnalyticsClient || !activeAnalyticsClient.enabled) return;
  const normalized = normalizeAnalyticsPathname(pathname);
  if (lastTrackedPathname === normalized) return;
  lastTrackedPathname = normalized;
  activeAnalyticsClient.track({
    type: 'page_view',
    name: `${appName}_page_view`,
    path: normalized,
    metadata: { app: appName, navigation: 'spa' },
  });
}

export function trackPortalInteraction(
  name: string,
  path: string,
  metadata?: Record<string, string | number | boolean>,
  options?: AnalyticsTrackOptions,
): void {
  if (!activeAnalyticsClient || !activeAnalyticsClient.enabled) return;
  activeAnalyticsClient.track(
    {
      type: 'interaction',
      name,
      path: normalizeAnalyticsPathname(path),
      ...(metadata ? { metadata } : {}),
    },
    options,
  );
}

export function trackPaneOpen(path: string, surface?: 'desktop' | 'mobile'): void {
  trackPortalInteraction(
    'pane_open',
    path,
    surface ? { app: activeAnalyticsAppName, surface } : { app: activeAnalyticsAppName },
  );
}

export function trackProfileOutboundClick(
  target: 'email' | 'github' | 'website',
  path = '/about',
): void {
  trackPortalInteraction(
    'about_outbound_click',
    path,
    { app: activeAnalyticsAppName, target },
    { immediate: true },
  );
}

export function trackTerminalCommand(commandName: string, path = '/'): void {
  trackPortalInteraction('terminal_command', path, {
    app: activeAnalyticsAppName,
    command: commandName,
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
  activeAnalyticsClient?.dispose?.();
  activeAnalyticsClient = null;
  activeAnalyticsAppName = 'portal';
  lastTrackedPathname = null;
  notifySessionIdListeners();
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
  activeAnalyticsClient?.dispose?.();

  const client = createAnalyticsClient({
    endpoint,
    onSessionIdChange: () => {
      notifySessionIdListeners();
    },
  });
  activeAnalyticsClient = client;
  activeAnalyticsAppName = appName;
  notifySessionIdListeners();

  if (!client.enabled) return client;

  const initialPath = normalizeAnalyticsPathname(window.location.pathname || '/');
  lastTrackedPathname = initialPath;

  client.startWebVitals();
  client.track({
    type: 'page_view',
    name: `${appName}_page_view`,
    path: initialPath,
    metadata: { app: appName, navigation: 'initial' },
  });

  const cleanupHistory = installSpaHistoryTracking();
  const handlePageHide = (): void => {
    client.flush({ unload: true });
  };
  const handleVisibilityChange = (): void => {
    if (doc.visibilityState === 'hidden') {
      client.flush({ unload: true });
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
