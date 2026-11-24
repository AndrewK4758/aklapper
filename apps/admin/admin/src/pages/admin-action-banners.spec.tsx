import type {
  AdminCmsLoaderData,
  AdminInboxLoaderData,
  AdminOpsLoaderData,
  AdminQuotasLoaderData,
  QdrantHealthStatus,
} from '@aklapper/core';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AdminCmsPage } from './cms/AdminCmsPage';
import { AdminInboxPage } from './inbox/AdminInboxPage';
import { AdminOpsPage } from './ops/AdminOpsPage';
import { AdminQuotasPage } from './quotas/AdminQuotasPage';

const QDRANT_FIXTURE: QdrantHealthStatus = {
  online: false,
  collection: 'portfolio_docs',
  pointsCount: 0,
  status: 'unconfigured',
  provider: 'unconfigured',
  detail: 'Local fallback',
};

const CMS_DATA: AdminCmsLoaderData = {
  siteContents: [],
  maintenanceModeDefault: false,
  rebuildProgressPercent: 50,
  menuItems: [],
  terminalProfiles: [],
  terminalCommands: [],
  terminalInitialEntries: [],
  terminalDirectoryEntries: [],
  roadmapMilestones: [],
  agensiSkills: [],
  cadencePresets: [],
};

const INBOX_DATA: AdminInboxLoaderData = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 20,
  query: '',
};

const QUOTAS_DATA: AdminQuotasLoaderData = {
  policies: [],
  buckets: [],
};

const OPS_DATA: AdminOpsLoaderData = {
  cadenceAdminStatus: {
    online: false,
    namespace: 'cadence-admin',
    isolated: true,
    mode: 'full-cadence-runtime',
    databaseConnected: false,
    totalSandboxRuns: 0,
    pendingGates: 0,
    timestamp: '2026-11-24T12:00:00.000Z',
    detail: 'Local fallback',
  },
  qdrantStatus: QDRANT_FIXTURE,
  sandboxRuns: [],
  k8sWatchConfigured: false,
};

const ERROR_FEEDBACK = {
  ok: false as const,
  message: 'Database temporarily unavailable.',
  code: 'ERR_DB_UNAVAILABLE' as const,
  action: 'Retry shortly or share ID.',
  correlationId: 'corr-admin-page-503',
};

describe('Admin page action error banners', () => {
  it('renders code, action, and correlationId in AdminCmsPage alert banner', async () => {
    const Stub = createRoutesStub([
      {
        path: '/cms',
        Component: () => (
          <AdminCmsPage data={CMS_DATA} qdrant={QDRANT_FIXTURE} actionData={ERROR_FEEDBACK} />
        ),
      },
    ]);

    render(<Stub initialEntries={['/cms']} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Database temporarily unavailable.');
    expect(alert.textContent).toContain('ERR_DB_UNAVAILABLE');
    expect(alert.textContent).toContain('Retry shortly or share ID.');
    expect(alert.textContent).toContain('corr-admin-page-503');
  });

  it('renders code, action, and correlationId in AdminInboxPage alert banner', async () => {
    const Stub = createRoutesStub([
      {
        path: '/inbox',
        Component: () => <AdminInboxPage data={INBOX_DATA} actionData={ERROR_FEEDBACK} />,
      },
    ]);

    render(<Stub initialEntries={['/inbox']} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Database temporarily unavailable.');
    expect(alert.textContent).toContain('ERR_DB_UNAVAILABLE');
    expect(alert.textContent).toContain('Retry shortly or share ID.');
    expect(alert.textContent).toContain('corr-admin-page-503');
  });

  it('renders code, action, and correlationId in AdminQuotasPage alert banner', async () => {
    const Stub = createRoutesStub([
      {
        path: '/quotas',
        Component: () => <AdminQuotasPage data={QUOTAS_DATA} actionData={ERROR_FEEDBACK} />,
      },
    ]);

    render(<Stub initialEntries={['/quotas']} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Database temporarily unavailable.');
    expect(alert.textContent).toContain('ERR_DB_UNAVAILABLE');
    expect(alert.textContent).toContain('Retry shortly or share ID.');
    expect(alert.textContent).toContain('corr-admin-page-503');
  });

  it('renders code, action, and correlationId in AdminOpsPage alert banner', async () => {
    const Stub = createRoutesStub([
      {
        path: '/ops',
        Component: () => <AdminOpsPage data={OPS_DATA} actionData={ERROR_FEEDBACK} />,
      },
    ]);

    render(<Stub initialEntries={['/ops']} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Database temporarily unavailable.');
    expect(alert.textContent).toContain('ERR_DB_UNAVAILABLE');
    expect(alert.textContent).toContain('Retry shortly or share ID.');
    expect(alert.textContent).toContain('corr-admin-page-503');
  });
});
