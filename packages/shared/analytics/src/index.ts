import type { AnalyticsBatch, AnalyticsEvent } from '@aklapper/contracts';
import { onCLS, onINP, onLCP, onTTFB } from 'web-vitals';

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
