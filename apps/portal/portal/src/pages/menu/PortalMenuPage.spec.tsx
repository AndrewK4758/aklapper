import type { MenuItem, PortalMenuContent } from '@aklapper/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { PortalMenuPage } from './index';

const CONTENT: PortalMenuContent = {
  heading: 'Launch Menu',
  description: 'Select a Solar Forge module.',
  localTargetLabel: 'portal-ssr',
};

const ITEMS: MenuItem[] = [
  {
    slug: 'cadence',
    title: 'CADENCE Builder',
    description: 'Sandboxed artifact builder',
    keyShortcut: 'c',
    sortOrder: 1,
    adminOnly: false,
    namespace: 'portfolio-public',
    enabled: true,
    targetK8sDeploy: 'cadence-api',
  },
  {
    slug: 'analytics',
    title: 'Admin Analytics',
    description: 'Internal telemetry',
    keyShortcut: 'a',
    sortOrder: 2,
    adminOnly: true,
    namespace: 'portfolio-admin',
    enabled: true,
    targetK8sDeploy: null,
  },
];

describe('portal/pages/menu', () => {
  it('filters admin-only items and navigates on shortcut keypress', () => {
    const onNavigate = vi.fn<(to: string) => void>();
    render(
      <MemoryRouter>
        <PortalMenuPage content={CONTENT} items={ITEMS} onNavigate={onNavigate} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: CONTENT.heading })).toBeTruthy();
    expect(screen.getByText('CADENCE Builder')).toBeTruthy();
    expect(screen.queryByText('Admin Analytics')).toBeNull();

    fireEvent.keyDown(window, { key: 'c' });
    expect(onNavigate).toHaveBeenCalledWith('/cadence');
  });
});
