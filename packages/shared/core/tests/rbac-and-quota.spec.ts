import type { K8sPodEvent, MenuItem } from '../src/index.ts';
import {
  filterMenuForRole,
  hasRemainingBudget,
  isPodEventVisibleToRole,
  PUBLIC_NAMESPACE,
  remainingBudget,
} from '../src/index.ts';

describe('@aklapper/core/rbac', () => {
  it('hides admin menu items and non-public pod events from guests', () => {
    const items: MenuItem[] = [
      {
        slug: 'admin-analytics',
        keyShortcut: '9',
        title: 'Admin Analytics',
        description: 'Private telemetry',
        targetK8sDeploy: null,
        namespace: null,
        adminOnly: true,
        sortOrder: 9,
        enabled: true,
      },
      {
        slug: 'cadence',
        keyShortcut: '1',
        title: 'CADENCE Builder',
        description: 'Public demo',
        targetK8sDeploy: 'svc-cadence-demo',
        namespace: PUBLIC_NAMESPACE,
        adminOnly: false,
        sortOrder: 1,
        enabled: true,
      },
    ];

    expect(filterMenuForRole(items, 'guest').map(i => i.slug)).toEqual(['cadence']);
    expect(filterMenuForRole(items, 'admin').map(i => i.slug)).toEqual([
      'cadence',
      'admin-analytics',
    ]);

    const privateEvent: K8sPodEvent = {
      eventId: 'e1',
      namespace: 'internal-ops',
      deployment: 'internal-worker',
      podName: 'internal-worker-0',
      phase: 'Running',
      ready: true,
      message: 'Ready',
      timestamp: new Date().toISOString(),
    };
    const publicEvent: K8sPodEvent = {
      eventId: 'e2',
      namespace: PUBLIC_NAMESPACE,
      deployment: 'svc-cadence-demo',
      podName: 'svc-cadence-demo-0',
      phase: 'Running',
      ready: true,
      message: 'Ready',
      timestamp: new Date().toISOString(),
    };
    expect(isPodEventVisibleToRole(privateEvent, 'guest')).toBe(false);
    expect(isPodEventVisibleToRole(privateEvent, 'admin')).toBe(true);
    expect(isPodEventVisibleToRole(publicEvent, 'guest')).toBe(true);
  });

  it('enforces turn and token quotas accurately', () => {
    const quota = {
      role: 'guest' as const,
      turnsUsed: 2,
      maxTurns: 3,
      tokensUsed: 4500,
      maxTokens: 6000,
    };
    expect(hasRemainingBudget(quota, 1000)).toBe(true);
    expect(hasRemainingBudget(quota, 2000)).toBe(false);
    expect(remainingBudget(quota)).toEqual({ turns: 1, tokens: 1500 });
  });
});
