import { type K8sPodEvent, K8sPodEventSchema, type Osc7501State } from '@aklapper/core';
import { useSyncExternalStore } from 'react';

export interface ClusterTelemetrySnapshot {
  readonly connected: boolean;
  readonly readyCount: number;
  readonly scalingCount: number;
  readonly deployments: Readonly<Record<string, K8sPodEvent>>;
  readonly summaryState: Osc7501State;
  readonly summaryLabel: string | null;
}

const SERVER_SNAPSHOT: ClusterTelemetrySnapshot = {
  connected: false,
  readyCount: 0,
  scalingCount: 0,
  deployments: {},
  summaryState: 'idle',
  summaryLabel: null,
};

let currentSnapshot: ClusterTelemetrySnapshot = SERVER_SNAPSHOT;
let eventSource: EventSource | null = null;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

function buildSummary(deployments: Record<string, K8sPodEvent>): {
  readyCount: number;
  scalingCount: number;
  summaryState: Osc7501State;
  summaryLabel: string;
} {
  const entries = Object.values(deployments);
  let readyCount = 0;
  let scalingCount = 0;

  for (const ev of entries) {
    if (ev.ready || ev.phase === 'Running') {
      readyCount += 1;
    } else if (
      ev.phase === 'TriggeredScaleUp' ||
      ev.phase === 'ContainerCreating' ||
      ev.phase === 'Pending'
    ) {
      scalingCount += 1;
    }
  }

  if (scalingCount > 0) {
    return {
      readyCount,
      scalingCount,
      summaryState: 'scaling',
      summaryLabel: `${readyCount} ready · ${scalingCount} waking`,
    };
  }
  if (readyCount > 0) {
    return {
      readyCount,
      scalingCount,
      summaryState: 'ready',
      summaryLabel: `${readyCount} pod${readyCount === 1 ? '' : 's'} active`,
    };
  }
  return {
    readyCount: 0,
    scalingCount: 0,
    summaryState: 'idle',
    summaryLabel: '0 pods (scale-to-0)',
  };
}

function applyPodEvent(rawData: string): void {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawData);
  } catch {
    return;
  }
  const parsed = K8sPodEventSchema.safeParse(parsedJson);
  if (!parsed.success) return;
  const ev = parsed.data;
  if (ev.namespace !== 'portfolio-public') return;

  const nextDeployments: Record<string, K8sPodEvent> = {
    ...currentSnapshot.deployments,
    [ev.deployment]: ev,
  };
  const summary = buildSummary(nextDeployments);
  currentSnapshot = {
    connected: true,
    deployments: nextDeployments,
    ...summary,
  };
  notifyListeners();
}

function ensureConnection(): void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return;
  }
  if (eventSource) return;

  try {
    const source = new EventSource('/api/cluster/stream');
    eventSource = source;

    source.addEventListener('pod', event => {
      if (event instanceof MessageEvent && typeof event.data === 'string') {
        applyPodEvent(event.data);
      }
    });

    source.onerror = () => {
      // Close on stream EOF/error so simulated one-shot streams don't spin aggressively.
      source.close();
      if (eventSource === source) {
        eventSource = null;
      }
    };
  } catch {
    eventSource = null;
  }
}

function teardownConnection(): void {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    ensureConnection();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      teardownConnection();
    }
  };
}

function getSnapshot(): ClusterTelemetrySnapshot {
  return currentSnapshot;
}

function getServerSnapshot(): ClusterTelemetrySnapshot {
  return SERVER_SNAPSHOT;
}

export function useClusterTelemetry(): ClusterTelemetrySnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
