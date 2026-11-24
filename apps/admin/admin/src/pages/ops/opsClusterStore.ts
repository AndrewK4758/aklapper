import { createPodEventStreamStore, type K8sPodEvent } from '@aklapper/core';
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
  if (ev.namespace === 'cadence-admin') {
    return {
      connected,
      publicDeployments: current.publicDeployments,
      adminDeployments: upsertDeployment(current.adminDeployments, ev),
    };
  }
  if (ev.namespace === 'portfolio-public') {
    return {
      connected,
      publicDeployments: upsertDeployment(current.publicDeployments, ev),
      adminDeployments: current.adminDeployments,
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
  const namespace = deployment === 'cadence-admin' ? 'cadence-admin' : 'portfolio-public';
  opsClusterStore.update(current => {
    const existingList =
      namespace === 'cadence-admin' ? current.adminDeployments : current.publicDeployments;
    const existing = existingList.find(ev => ev.deployment === deployment);
    return applyDeploymentUpdate(
      current,
      {
        eventId: `wake-${deployment}-${Date.now()}`,
        namespace,
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
