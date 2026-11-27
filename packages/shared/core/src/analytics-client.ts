import { onCLS, onINP, onLCP, onTTFB } from 'web-vitals';

import type {
  AnalyticsBatch,
  AnalyticsEvent,
  AnalyticsIngestResponse,
} from './analytics-schemas.ts';

export interface AnalyticsTransportOptions {
  readonly unload?: boolean;
}

export interface AnalyticsTrackOptions {
  readonly immediate?: boolean;
}

export interface AnalyticsClientOptions {
  endpoint: string;
  respectPrivacySignals?: boolean;
  maxBatchSize?: number;
  promptFlushDelayMs?: number;
  transport?: (
    endpoint: string,
    payload: AnalyticsBatch,
    options?: AnalyticsTransportOptions,
  ) => unknown;
  onSessionIdChange?: (sessionId: string) => void;
}

export interface AnalyticsClient {
  readonly enabled: boolean;
  readonly sessionId: string;
  track: (event: Omit<AnalyticsEvent, 'timestamp'>, options?: AnalyticsTrackOptions) => void;
  startWebVitals: () => void;
  flush: (options?: AnalyticsTransportOptions) => void;
  dispose?: () => void;
}

interface NavigatorWithGpc extends Navigator {
  globalPrivacyControl?: boolean;
}

interface ClientLandingAttribution {
  readonly landingPath?: string;
  readonly refParam?: string;
  readonly utmSource?: string;
  readonly utmMedium?: string;
  readonly utmCampaign?: string;
  readonly utmContent?: string;
}

const DEFAULT_PROMPT_FLUSH_DELAY_MS = 300;
const WIRE_PARAM_MAX_LEN = 512;
const IMMEDIATE_FLUSH_EVENT_NAMES = new Set<string>([
  'about_outbound_click',
  'agensi_outbound_click',
]);

export function isPrivacyOptOut(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as NavigatorWithGpc;
  return nav.doNotTrack === '1' || nav.globalPrivacyControl === true;
}

export function normalizeAnalyticsPathname(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed) return '/';
  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return normalized.slice(0, WIRE_PARAM_MAX_LEN);
}

function readBoundedSearchParam(params: URLSearchParams, key: string): string | undefined {
  const raw = params.get(key);
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, WIRE_PARAM_MAX_LEN);
}

function extractClientLandingAttribution(): ClientLandingAttribution {
  if (typeof window === 'undefined' || !window.location) return {};
  const landingPath = normalizeAnalyticsPathname(window.location.pathname || '/');
  const params = new URLSearchParams(window.location.search || '');
  const refParam = readBoundedSearchParam(params, 'ref');
  const utmSource = readBoundedSearchParam(params, 'utm_source');
  const utmMedium = readBoundedSearchParam(params, 'utm_medium');
  const utmCampaign = readBoundedSearchParam(params, 'utm_campaign');
  const utmContent = readBoundedSearchParam(params, 'utm_content');

  return {
    landingPath,
    ...(refParam ? { refParam } : {}),
    ...(utmSource ? { utmSource } : {}),
    ...(utmMedium ? { utmMedium } : {}),
    ...(utmCampaign ? { utmCampaign } : {}),
    ...(utmContent ? { utmContent } : {}),
  };
}

function parseReconciledResponse(value: unknown): AnalyticsIngestResponse | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (
    typeof record['accepted'] === 'number' &&
    typeof record['sessionId'] === 'string' &&
    record['sessionId'].trim().length > 0 &&
    typeof record['ipHash'] === 'string'
  ) {
    return {
      accepted: record['accepted'],
      sessionId: record['sessionId'].trim(),
      ipHash: record['ipHash'],
    };
  }
  return undefined;
}

function defaultTransport(
  endpoint: string,
  payload: AnalyticsBatch,
  options?: AnalyticsTransportOptions,
): void | Promise<AnalyticsIngestResponse | undefined> {
  const body = JSON.stringify(payload);
  if (
    options?.unload &&
    typeof navigator !== 'undefined' &&
    typeof navigator.sendBeacon === 'function'
  ) {
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon(endpoint, blob)) return;
  }
  if (typeof fetch === 'function') {
    return fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    })
      .then(async response => {
        if (!response.ok || response.status === 204) return undefined;
        try {
          const json: unknown = await response.json();
          return parseReconciledResponse(json);
        } catch {
          return undefined;
        }
      })
      .catch(() => undefined);
  }
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(endpoint, blob);
  }
  return undefined;
}

export function createAnalyticsClient(options: AnalyticsClientOptions): AnalyticsClient {
  const respectPrivacy = options.respectPrivacySignals ?? true;
  const enabled = !(respectPrivacy && isPrivacyOptOut());
  let currentSessionId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `sess-${Date.now()}`;
  const maxBatchSize = options.maxBatchSize ?? 10;
  const promptFlushDelayMs = options.promptFlushDelayMs ?? DEFAULT_PROMPT_FLUSH_DELAY_MS;
  const send = options.transport ?? defaultTransport;
  const landingAttribution = extractClientLandingAttribution();
  const queue: AnalyticsEvent[] = [];
  let promptFlushTimer: ReturnType<typeof setTimeout> | null = null;

  const clearPromptTimer = (): void => {
    if (promptFlushTimer !== null) {
      clearTimeout(promptFlushTimer);
      promptFlushTimer = null;
    }
  };

  const reconcileSessionId = (nextSessionId: string): void => {
    const trimmed = nextSessionId.trim();
    if (!trimmed || trimmed === currentSessionId) return;
    currentSessionId = trimmed;
    options.onSessionIdChange?.(currentSessionId);
  };

  const flush = (transportOptions?: AnalyticsTransportOptions): void => {
    clearPromptTimer();
    if (!enabled || queue.length === 0) return;
    const events = queue.splice(0, queue.length);
    const referrer =
      typeof document !== 'undefined' && document.referrer ? document.referrer : undefined;
    const payload: AnalyticsBatch = {
      sessionId: currentSessionId,
      ...(referrer ? { referrer } : {}),
      ...landingAttribution,
      events,
    };
    const maybePromise = send(options.endpoint, payload, transportOptions);
    if (
      maybePromise !== null &&
      typeof maybePromise === 'object' &&
      'then' in maybePromise &&
      typeof (maybePromise as PromiseLike<unknown>).then === 'function'
    ) {
      void Promise.resolve(maybePromise)
        .then(response => {
          const parsed = parseReconciledResponse(response);
          if (parsed) {
            reconcileSessionId(parsed.sessionId);
          }
        })
        .catch(() => undefined);
    }
  };

  const schedulePromptFlush = (): void => {
    if (promptFlushTimer !== null) return;
    promptFlushTimer = setTimeout(() => {
      promptFlushTimer = null;
      flush();
    }, promptFlushDelayMs);
  };

  const track = (
    event: Omit<AnalyticsEvent, 'timestamp'>,
    trackOptions?: AnalyticsTrackOptions,
  ): void => {
    if (!enabled) return;
    queue.push({ ...event, timestamp: new Date().toISOString() });
    if (
      trackOptions?.immediate ||
      IMMEDIATE_FLUSH_EVENT_NAMES.has(event.name) ||
      queue.length >= maxBatchSize
    ) {
      flush();
      return;
    }
    if (event.type === 'page_view' || event.type === 'interaction') {
      schedulePromptFlush();
    }
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

  return {
    enabled,
    get sessionId(): string {
      return currentSessionId;
    },
    track,
    startWebVitals,
    flush,
    dispose: clearPromptTimer,
  };
}
