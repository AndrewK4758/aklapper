import type { MenuItem } from '../src/index.ts';
import { filterMenuForRole, hasRemainingBudget, remainingBudget } from '../src/index.ts';

describe('@aklapper/core/rbac', () => {
  it('hides admin menu items from guests and sorts enabled items cleanly', () => {
    const items: MenuItem[] = [
      {
        slug: 'admin-analytics',
        keyShortcut: '9',
        title: 'Admin Analytics',
        description: 'Private telemetry',
        adminOnly: true,
        sortOrder: 9,
        enabled: true,
      },
      {
        slug: 'cadence',
        keyShortcut: '1',
        title: 'CADENCE Builder',
        description: 'Public demo',
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
