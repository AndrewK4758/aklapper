import {
  type Osc7501State,
  type RuntimeServiceHealthSnapshot,
  RuntimeServiceHealthSnapshotSchema,
} from '@aklapper/core';
import { useSyncExternalStore } from 'react';

export interface RuntimeStatusTelemetrySnapshot {
  readonly loaded: boolean;
  readonly snapshot: RuntimeServiceHealthSnapshot | null;
  readonly summaryState: Osc7501State;
  readonly summaryLabel: string | null;
}

const SERVER_SNAPSHOT: RuntimeStatusTelemetrySnapshot = {
  loaded: false,
  snapshot: null,
  summaryState: 'idle',
  summaryLabel: null,
};

function mapSnapshotToOscState(snapshot: RuntimeServiceHealthSnapshot): Osc7501State {
  if (snapshot.services.some(item => item.status === 'offline')) {
    return 'error';
  }
  if (snapshot.services.some(item => item.status === 'degraded')) {
    return 'scaling';
  }
  if (snapshot.services.some(item => item.status === 'healthy')) {
    return 'ready';
  }
  return 'idle';
}

let currentSnapshot: RuntimeStatusTelemetrySnapshot = SERVER_SNAPSHOT;
let fetchStarted = false;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

function triggerInitialFetch(): void {
  if (fetchStarted || typeof window === 'undefined' || typeof fetch !== 'function') {
    return;
  }
  fetchStarted = true;
  void fetch('/api/runtime/status', {
    method: 'GET',
    headers: { accept: 'application/json' },
  })
    .then(async response => {
      if (!response.ok) return;
      const parsed = RuntimeServiceHealthSnapshotSchema.safeParse(await response.json());
      if (!parsed.success) return;
      currentSnapshot = {
        loaded: true,
        snapshot: parsed.data,
        summaryState: mapSnapshotToOscState(parsed.data),
        summaryLabel: parsed.data.summaryLabel,
      };
      notifyListeners();
    })
    .catch(() => {
      // Keep default chrome badge state when network probe is unavailable.
    });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  triggerInitialFetch();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): RuntimeStatusTelemetrySnapshot {
  return currentSnapshot;
}

function getServerSnapshot(): RuntimeStatusTelemetrySnapshot {
  return SERVER_SNAPSHOT;
}

export function useRuntimeStatusTelemetry(): RuntimeStatusTelemetrySnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
