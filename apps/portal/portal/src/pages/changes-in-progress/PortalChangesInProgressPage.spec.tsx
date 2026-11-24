import type { PortalMaintenanceLoaderData } from '@aklapper/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PortalChangesInProgressPage } from './index';

const DATA: PortalMaintenanceLoaderData = {
  content: {
    windowTitle: 'SOLAR FORGE // CHANGES IN PROGRESS',
    statusBadge: { source: 'build-pipeline', state: 'running', label: 'in progress' },
    heading: 'Changes in Progress',
    lead: 'Solar Forge v2 is actively shipping.',
    progressPercent: 72,
    progressAriaLabel: 'Rollout progress',
    metaLeft: 'release: v2',
    metaRight: 'gke-autopilot',
  },
  milestones: [
    { slug: 'ui', label: 'OKLCH UI library', status: 'done', sortOrder: 1, enabled: true },
    {
      slug: 'pages',
      label: 'Buildable page artifacts',
      status: 'active',
      sortOrder: 2,
      enabled: true,
    },
  ],
  terminal: {
    slug: 'maintenance',
    bannerTitle: 'Solar Forge Status',
    bannerMeta: 'tty1',
    osLabel: '⚡',
    directory: '~/projects/aklapper',
    vcsBranch: 'portfolio_v2',
    vcsState: 'clean',
    contextLabel: 'guest@andrew-k.us',
    placeholder: 'type status',
    quickCommands: ['status'],
    initialEntries: [],
    commands: [
      {
        name: 'status',
        description: 'show status',
        kind: 'static',
        output: 'all systems nominal',
        targetRoute: null,
        allowedRoutes: [],
        errorTemplate: null,
        sortOrder: 1,
      },
    ],
  },
};

describe('portal/pages/changes-in-progress', () => {
  it('renders maintenance roadmap milestones and interactive status terminal', () => {
    render(<PortalChangesInProgressPage data={DATA} />);

    expect(screen.getByRole('heading', { name: DATA.content.heading })).toBeTruthy();
    expect(screen.getByText('OKLCH UI library')).toBeTruthy();
    expect(screen.getByText('Buildable page artifacts')).toBeTruthy();
    expect(screen.getByLabelText('Terminal command input')).toBeTruthy();
  });
});
