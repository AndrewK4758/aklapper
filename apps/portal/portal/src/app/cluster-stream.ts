import { createPodEventStreamStore, type K8sPodEvent, type Osc7501State } from '@aklapper/core';
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

const portalClusterStore = createPodEventStreamStore<ClusterTelemetrySnapshot>({
  endpoint: '/api/cluster/stream',
  initialSnapshot: SERVER_SNAPSHOT,
  onPodEvent: (current, ev) => {
    if (ev.namespace !== 'portfolio-public') return current;
    const nextDeployments: Record<string, K8sPodEvent> = {
      ...current.deployments,
      [ev.deployment]: ev,
    };
    return {
      connected: true,
      deployments: nextDeployments,
      ...buildSummary(nextDeployments),
    };
  },
});

export function useClusterTelemetry(): ClusterTelemetrySnapshot {
  return useSyncExternalStore(
    portalClusterStore.subscribe,
    portalClusterStore.getSnapshot,
    portalClusterStore.getServerSnapshot,
  );
}
