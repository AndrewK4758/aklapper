import type { AdminOverviewLoaderData } from '@aklapper/core';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AdminHomePage } from './index';

const OVERVIEW_DATA: AdminOverviewLoaderData = {
  content: {
    heading: 'Operations Console',
    description: 'Isolated admin operations console.',
    actions: [{ label: 'Analytics Telemetry', to: '/analytics', variant: 'primary' }],
  },
  menuItems: [
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
  ],
  health: {
    postgres: { name: 'PostgreSQL 19', status: 'ok', detail: 'Connected' },
    qdrant: { name: 'Qdrant', status: 'ok', detail: 'portfolio_docs (12 points)' },
    portfolioPublic: { name: 'portfolio-public', status: 'ok', detail: 'Scale-to-0 watcher ready' },
    cadenceAdmin: { name: 'cadence-admin', status: 'ok', detail: 'full-cadence-runtime' },
  },
  metrics: {
    contactCount: 4,
    sessions24h: 19,
    events24h: 82,
    dailyTokensUsed: 1200,
    dailyTokenCap: 100000,
    totalSandboxRuns: 3,
    pendingGates: 1,
  },
  maintenanceModeDefault: false,
  rebuildProgressPercent: 60,
  security: {
    handle: 'admin',
    passkeyCount: 1,
    totpEnabled: false,
  },
};

describe('admin/pages/home', () => {
  it('renders overview health cards, KPIs, security settings trigger, and registry items', () => {
    render(
      <MemoryRouter>
        <AdminHomePage data={OVERVIEW_DATA} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: OVERVIEW_DATA.content.heading })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Analytics Telemetry' }).getAttribute('href')).toBe(
      '/analytics',
    );
    expect(screen.getByText('PostgreSQL 19')).toBeTruthy();
    expect(screen.getAllByText('cadence-admin').length).toBeGreaterThan(0);
    expect(screen.getByText('full-cadence-runtime')).toBeTruthy();
    expect(screen.getByText('PORTAL LIVE')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Security Settings' })).toBeTruthy();
    expect(screen.getByText(/\(admin\)/)).toBeTruthy();
  });
});
