import type { K8sPodEvent, MenuItem } from '../src/index.ts';
import {
  ADMIN_NAMESPACE,
  filterMenuForRole,
  hasRemainingBudget,
  isPodEventVisibleToRole,
  remainingBudget,
} from '../src/index.ts';

describe('@aklapper/core/rbac', () => {
  it('hides admin menu items and cadence-admin pod events from guests', () => {
    const items: MenuItem[] = [
      {
        slug: 'admin-analytics',
        keyShortcut: '9',
        title: 'Admin Analytics',
        description: 'Private telemetry',
        targetK8sDeploy: null,
        namespace: ADMIN_NAMESPACE,
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
        namespace: 'portfolio-public',
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

    const adminEvent: K8sPodEvent = {
      eventId: 'e1',
      namespace: ADMIN_NAMESPACE,
      deployment: 'cadence-admin-runner',
      podName: 'cadence-admin-runner-0',
      phase: 'Running',
      ready: true,
      message: 'Ready',
      timestamp: new Date().toISOString(),
    };
    expect(isPodEventVisibleToRole(adminEvent, 'guest')).toBe(false);
    expect(isPodEventVisibleToRole(adminEvent, 'admin')).toBe(true);
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
