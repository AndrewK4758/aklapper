import type { AdminHomeContent, MenuItem } from '@aklapper/core';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AdminHomePage } from './index';

const CONTENT: AdminHomeContent = {
  heading: 'Operations Console',
  description: 'Isolated admin operations console.',
  actions: [{ label: 'Analytics Telemetry', to: '/analytics', variant: 'primary' }],
};

const ITEMS: MenuItem[] = [
  {
    slug: 'analytics',
    title: 'Analytics Telemetry',
    description: 'Telemetry dashboard',
    keyShortcut: 'a',
    sortOrder: 1,
    adminOnly: true,
    namespace: 'portfolio-admin',
    enabled: true,
    targetK8sDeploy: null,
  },
];

describe('admin/pages/home', () => {
  it('renders admin actions and registry items', () => {
    render(
      <MemoryRouter>
        <AdminHomePage content={CONTENT} menuItems={ITEMS} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: CONTENT.heading })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Analytics Telemetry' }).getAttribute('href')).toBe(
      '/analytics',
    );
    expect(screen.getByText(/\(admin\)/)).toBeTruthy();
  });
});
