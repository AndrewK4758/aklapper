import { createPodEventStreamStore, type K8sPodEvent } from '@aklapper/core';
import { useSyncExternalStore } from 'react';

export interface OpsClusterSnapshot {
  readonly connected: boolean;
  readonly publicDeployments: readonly K8sPodEvent[];
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
];

const SERVER_SNAPSHOT: OpsClusterSnapshot = {
  connected: false,
  publicDeployments: DEFAULT_PUBLIC,
};

function upsertDeployment(list: readonly K8sPodEvent[], next: K8sPodEvent): readonly K8sPodEvent[] {
  const byName = new Map(list.map(ev => [ev.deployment, ev]));
  byName.set(next.deployment, next);
  return [...byName.values()].sort((a, b) => a.deployment.localeCompare(b.deployment));
}

function applyDeploymentUpdate(
  current: OpsClusterSnapshot,
  ev: K8sPodEvent,
  connected: boolean,
): OpsClusterSnapshot {
  if (ev.namespace === 'portfolio-public') {
    return {
      connected,
      publicDeployments: upsertDeployment(current.publicDeployments, ev),
    };
  }
  return current.connected === connected ? current : { ...current, connected };
}

const opsClusterStore = createPodEventStreamStore<OpsClusterSnapshot>({
  endpoint: '/api/ops/cluster/stream',
  initialSnapshot: SERVER_SNAPSHOT,
  onPodEvent: (current, ev) => applyDeploymentUpdate(current, ev, true),
});

export function markDeploymentWaking(deployment: string): void {
  opsClusterStore.update(current => {
    const existing = current.publicDeployments.find(ev => ev.deployment === deployment);
    return applyDeploymentUpdate(
      current,
      {
        eventId: `wake-${deployment}-${Date.now()}`,
        namespace: 'portfolio-public',
        deployment,
        podName: existing?.podName ?? `${deployment}-0`,
        phase: 'TriggeredScaleUp',
        message: 'Manual wake requested from admin ops console',
        ready: false,
        timestamp: new Date().toISOString(),
      },
      current.connected,
    );
  });
}

export function useOpsClusterStream(): OpsClusterSnapshot {
  return useSyncExternalStore(
    opsClusterStore.subscribe,
    opsClusterStore.getSnapshot,
    opsClusterStore.getServerSnapshot,
  );
}
