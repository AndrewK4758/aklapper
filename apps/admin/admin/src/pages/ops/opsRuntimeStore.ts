import {
  type RuntimeServiceHealthSnapshot,
  RuntimeServiceHealthSnapshotSchema,
} from '@aklapper/core';
import { useSyncExternalStore } from 'react';

export interface OpsRuntimeSnapshot {
  readonly loaded: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  readonly snapshot: RuntimeServiceHealthSnapshot | null;
}

const SERVER_SNAPSHOT: OpsRuntimeSnapshot = {
  loaded: false,
  loading: false,
  error: null,
  snapshot: null,
};

let currentSnapshot: OpsRuntimeSnapshot = SERVER_SNAPSHOT;
let initialFetchStarted = false;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

function setSnapshot(next: OpsRuntimeSnapshot): void {
  currentSnapshot = next;
  notifyListeners();
}

async function fetchOpsRuntimeStatus(refresh: boolean): Promise<void> {
  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    return;
  }
  setSnapshot({
    ...currentSnapshot,
    loading: true,
    error: null,
  });

  try {
    const endpoint = refresh ? '/api/ops/runtime/status?refresh=1' : '/api/ops/runtime/status';
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      setSnapshot({
        ...currentSnapshot,
        loading: false,
        error: refresh ? `Runtime health probe failed (HTTP ${response.status}).` : null,
      });
      return;
    }
    const parsed = RuntimeServiceHealthSnapshotSchema.safeParse(await response.json());
    if (!parsed.success) {
      setSnapshot({
        ...currentSnapshot,
        loading: false,
        error: refresh ? 'Runtime health response failed schema validation.' : null,
      });
      return;
    }
    setSnapshot({
      loaded: true,
      loading: false,
      error: null,
      snapshot: parsed.data,
    });
  } catch {
    setSnapshot({
      ...currentSnapshot,
      loading: false,
      error: refresh ? 'Unable to reach /api/ops/runtime/status.' : null,
    });
  }
}

export function refreshOpsRuntimeStatus(): Promise<void> {
  return fetchOpsRuntimeStatus(true);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!initialFetchStarted && typeof window !== 'undefined') {
    initialFetchStarted = true;
    void fetchOpsRuntimeStatus(false);
  }
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): OpsRuntimeSnapshot {
  return currentSnapshot;
}

function getServerSnapshot(): OpsRuntimeSnapshot {
  return SERVER_SNAPSHOT;
}

export function useOpsRuntimeStatus(): OpsRuntimeSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
