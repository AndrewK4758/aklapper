import { type K8sPodEvent, K8sPodEventSchema } from '@aklapper/core';
import { useSyncExternalStore } from 'react';

export interface OpsClusterSnapshot {
  readonly connected: boolean;
  readonly publicDeployments: readonly K8sPodEvent[];
  readonly adminDeployments: readonly K8sPodEvent[];
}

const DEFAULT_PUBLIC: readonly K8sPodEvent[] = [
  {
    eventId: 'init-cadence-demo',
    namespace: 'portfolio-public',
    deployment: 'svc-cadence-demo',
    podName: 'svc-cadence-demo-0',
    phase: 'ScaledZero',
    message: 'Awaiting cluster stream',
    ready: false,
    timestamp: '2026-01-01T00:00:00.000Z',
  },
  {
    eventId: 'init-ai-ask',
    namespace: 'portfolio-public',
    deployment: 'svc-ai-ask',
    podName: 'svc-ai-ask-0',
    phase: 'ScaledZero',
    message: 'Awaiting cluster stream',
    ready: false,
    timestamp: '2026-01-01T00:00:00.000Z',
  },
  {
    eventId: 'init-contact',
    namespace: 'portfolio-public',
    deployment: 'svc-contact',
    podName: 'svc-contact-0',
    phase: 'ScaledZero',
    message: 'Awaiting cluster stream',
    ready: false,
    timestamp: '2026-01-01T00:00:00.000Z',
  },
];

const DEFAULT_ADMIN: readonly K8sPodEvent[] = [
  {
    eventId: 'init-cadence-admin',
    namespace: 'cadence-admin',
    deployment: 'cadence-admin',
    podName: 'cadence-admin-0',
    phase: 'ScaledZero',
    message: 'Awaiting isolated cadence-admin stream',
    ready: false,
    timestamp: '2026-01-01T00:00:00.000Z',
  },
];

const SERVER_SNAPSHOT: OpsClusterSnapshot = {
  connected: false,
  publicDeployments: DEFAULT_PUBLIC,
  adminDeployments: DEFAULT_ADMIN,
};

let deploymentMap: Record<string, K8sPodEvent> = {};
for (const ev of [...DEFAULT_PUBLIC, ...DEFAULT_ADMIN]) {
  deploymentMap[`${ev.namespace}:${ev.deployment}`] = ev;
}

let currentSnapshot: OpsClusterSnapshot = SERVER_SNAPSHOT;
let eventSource: EventSource | null = null;
const listeners = new Set<() => void>();

function rebuildSnapshot(connected: boolean): void {
  const all = Object.values(deploymentMap);
  const publicDeployments = all
    .filter(ev => ev.namespace === 'portfolio-public')
    .sort((a, b) => a.deployment.localeCompare(b.deployment));
  const adminDeployments = all
    .filter(ev => ev.namespace === 'cadence-admin')
    .sort((a, b) => a.deployment.localeCompare(b.deployment));

  currentSnapshot = {
    connected,
    publicDeployments,
    adminDeployments,
  };
}

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
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
  deploymentMap[`${ev.namespace}:${ev.deployment}`] = ev;
  rebuildSnapshot(true);
  notifyListeners();
}

export function markDeploymentWaking(deployment: string): void {
  const namespace = deployment === 'cadence-admin' ? 'cadence-admin' : 'portfolio-public';
  const key = `${namespace}:${deployment}`;
  const existing = deploymentMap[key];
  deploymentMap[key] = {
    eventId: `wake-${deployment}-${Date.now()}`,
    namespace,
    deployment,
    podName: existing?.podName ?? `${deployment}-0`,
    phase: 'TriggeredScaleUp',
    message: 'Manual wake requested from admin ops console',
    ready: false,
    timestamp: new Date().toISOString(),
  };
  rebuildSnapshot(currentSnapshot.connected);
  notifyListeners();
}

function ensureConnection(): void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return;
  }
  if (eventSource) return;

  try {
    const source = new EventSource('/api/ops/cluster/stream');
    eventSource = source;

    source.addEventListener('pod', event => {
      if (event instanceof MessageEvent && typeof event.data === 'string') {
        applyPodEvent(event.data);
      }
    });

    source.onerror = () => {
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

function getSnapshot(): OpsClusterSnapshot {
  return currentSnapshot;
}

function getServerSnapshot(): OpsClusterSnapshot {
  return SERVER_SNAPSHOT;
}

export function useOpsClusterStream(): OpsClusterSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
