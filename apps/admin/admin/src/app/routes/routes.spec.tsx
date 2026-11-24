import type {
  AdminAnalyticsLoaderData,
  AdminCmsLoaderData,
  AdminInboxLoaderData,
  AdminOpsLoaderData,
  AdminOverviewLoaderData,
  AdminQuotasLoaderData,
  AdminRootLoaderData,
  QdrantHealthStatus,
} from '@aklapper/core';
import { ADMIN_OPS_TERMINAL_PROFILE } from '@aklapper/db';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterContextProvider, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  resolveAdminSessionFromRequest: vi.fn<(request: Request) => Promise<unknown>>(),
}));

vi.mock('@aklapper/db/auth', () => authMocks);

import AdminRoot from '../root';
import { ADMIN_ROBOTS_DIRECTIVE, buildAdminPageMeta } from '../seo';
import AdminAnalyticsRoute from './analytics';
import { loader as opsStreamLoader } from './api.ops.cluster.stream';
import AdminCmsRoute from './cms';
import AdminHomeRoute from './home';
import AdminInboxRoute from './inbox';
import { loader as attachmentLoader } from './inbox.$id.attachment';
import AdminLoginRoute, { loader as loginLoader } from './login';
import AdminOpsRoute from './ops';
import AdminQuotasRoute from './quotas';

const ADMIN_OVERVIEW_FIXTURE: AdminOverviewLoaderData = {
  content: {
    heading: 'Admin Operations Console',
    description: 'Manage passkey auth, portal content, and analytics.',
    actions: [{ label: 'Open Telemetry View', to: '/analytics', variant: 'primary' }],
  },
  menuItems: [
    {
      slug: 'cadence',
      keyShortcut: '1',
      title: 'CADENCE Builder',
      description: 'Public sandbox',
      targetK8sDeploy: 'svc-cadence-demo',
      namespace: 'portfolio-public',
      adminOnly: false,
      sortOrder: 1,
      enabled: true,
    },
    {
      slug: 'cadence-admin',
      keyShortcut: '9',
      title: 'Admin Ops',
      description: 'Internal admin route',
      targetK8sDeploy: 'svc-admin',
      namespace: 'portfolio-admin',
      adminOnly: true,
      sortOrder: 9,
      enabled: true,
    },
  ],
  health: {
    postgres: { name: 'PostgreSQL 19', status: 'ok', detail: 'Connected' },
    qdrant: { name: 'Qdrant', status: 'degraded', detail: 'Unconfigured' },
    portfolioPublic: { name: 'portfolio-public', status: 'ok', detail: 'Ready' },
    cadenceAdmin: { name: 'cadence-admin', status: 'ok', detail: 'Isolated' },
  },
  metrics: {
    contactCount: 3,
    sessions24h: 12,
    events24h: 48,
    dailyTokensUsed: 500,
    dailyTokenCap: 100000,
    totalSandboxRuns: 2,
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

const ADMIN_ANALYTICS_FIXTURE: AdminAnalyticsLoaderData = {
  content: {
    windowTitle: 'First-Party Visitor Analytics // Postgres 19',
    description: 'Telemetry ingested via node-api-analytics.',
  },
  window: '7d',
  totalSessions: 42,
  totalEvents: 150,
  summary: {
    totalSessions: 42,
    totalEvents: 150,
  },
  cwv: [
    { metric: 'LCP', sampleCount: 5, p50: 1200, p75: 1500, p95: 2000 },
    { metric: 'INP', sampleCount: 5, p50: 45, p75: 80, p95: 120 },
    { metric: 'CLS', sampleCount: 5, p50: 0.01, p75: 0.02, p95: 0.04 },
    { metric: 'TTFB', sampleCount: 5, p50: 90, p75: 130, p95: 180 },
  ],
  topPaths: [{ label: '/cadence', count: 40 }],
  topReferrers: [{ label: 'direct', count: 22 }],
  geoBreakdown: [{ label: 'US', secondaryLabel: 'GA', count: 20 }],
  agensiConversions: [{ slug: 'solar-forge-cli', clicks: 4 }],
  aiMetrics: {
    totalRuns: 2,
    totalTokensIn: 300,
    totalTokensOut: 900,
    approvedGates: 1,
    rejectedGates: 0,
    pendingGates: 1,
    abstentionEvents: 0,
  },
};

const ADMIN_INBOX_FIXTURE: AdminInboxLoaderData = {
  items: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Grace Hopper',
      email: 'grace@example.com',
      phone: null,
      message: 'Testing verified attachment download flow.',
      attachmentName: 'spec.txt',
      attachmentMimeType: 'text/plain',
      attachmentSizeBytes: 64,
      attachmentSha256: 'a'.repeat(64),
      createdAt: '2026-11-24T12:00:00.000Z',
    },
  ],
  totalCount: 1,
  page: 1,
  pageSize: 20,
  query: '',
};

const ADMIN_QUOTAS_FIXTURE: AdminQuotasLoaderData = {
  policies: [
    {
      role: 'guest',
      maxTurnsPerSession: 5,
      maxTokensPerRun: 4000,
      maxDailyGlobalTokens: 100000,
    },
    {
      role: 'admin',
      maxTurnsPerSession: 100,
      maxTokensPerRun: 32000,
      maxDailyGlobalTokens: 2000000,
    },
  ],
  buckets: [
    {
      scopeKey: 'session:demo-1',
      windowStart: '2026-11-24T12:00:00.000Z',
      turnsUsed: 2,
      tokensUsed: 950,
    },
  ],
};

const QDRANT_FIXTURE: QdrantHealthStatus = {
  online: false,
  collection: 'portfolio_docs',
  pointsCount: 0,
  status: 'unconfigured',
  provider: 'unconfigured',
  detail: 'Local fallback',
};

const ADMIN_CMS_FIXTURE: AdminCmsLoaderData = {
  siteContents: [
    {
      key: 'portal-chrome',
      markdownBody: '# Chrome',
      metadataJson: { maintenanceModeDefault: false },
      updatedAt: '2026-11-24T12:00:00.000Z',
    },
  ],
  maintenanceModeDefault: false,
  rebuildProgressPercent: 60,
  menuItems: ADMIN_OVERVIEW_FIXTURE.menuItems,
  terminalProfiles: [
    {
      slug: 'portal-shell',
      bannerTitle: 'andrew-k.us // Solar Forge',
      bannerMeta: 'portal-public',
      osLabel: 'linux',
      directory: '~/portfolio',
      vcsBranch: 'main',
      vcsState: 'clean',
      contextLabel: 'guest@andrew-k.us',
      placeholder: 'help',
      quickCommands: ['help', 'menu'],
    },
  ],
  terminalCommands: [],
  terminalInitialEntries: [],
  roadmapMilestones: [
    {
      slug: 'slice-1',
      status: 'done',
      label: 'Foundation',
      sortOrder: 1,
      enabled: true,
    },
  ],
  agensiSkills: [],
  cadencePresets: [
    {
      slug: 'landing-hero',
      title: 'Landing Hero',
      starterPrompt: 'Build Solar Forge hero',
      expectedKind: 'html',
      starterArtifactHtml: '<html><body>Preview</body></html>',
      sortOrder: 1,
    },
  ],
};

const ADMIN_OPS_FIXTURE: AdminOpsLoaderData = {
  cadenceAdminStatus: {
    online: false,
    namespace: 'cadence-admin',
    isolated: true,
    mode: 'full-cadence-runtime',
    databaseConnected: false,
    totalSandboxRuns: 1,
    pendingGates: 1,
    timestamp: '2026-11-24T12:00:00.000Z',
    detail: 'Local fallback',
  },
  qdrantStatus: QDRANT_FIXTURE,
  sandboxRuns: [
    {
      runId: '11111111-1111-4111-8111-111111111111',
      sessionId: 'sess-ops',
      menuSlug: 'cadence',
      prompt: 'Audit sandbox artifact',
      runStatus: 'completed',
      gateVerdict: 'pending',
      tokensIn: 120,
      tokensOut: 340,
      artifactHtml: '<html><body>Artifact</body></html>',
      createdAt: '2026-11-24T12:00:00.000Z',
      turns: [
        {
          id: 1,
          phase: 'triage',
          agentName: 'chord-triage',
          status: 'completed',
          summary: 'Scoped run',
          latencyMs: 14,
        },
      ],
    },
  ],
  k8sWatchConfigured: false,
};

describe('Admin routes & SEO', () => {
  it('renders AdminHomeRoute with health tiles and both public and admin registry entries', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          loader: (): AdminOverviewLoaderData => ADMIN_OVERVIEW_FIXTURE,
          Component: AdminHomeRoute,
        },
      ],
      { initialEntries: ['/'] },
    );

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: 'Admin Operations Console' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Telemetry View' }).getAttribute('href')).toBe(
      '/analytics',
    );
    expect(screen.getByText(/CADENCE Builder/)).toBeTruthy();
    expect(screen.getByText(/Admin Ops/)).toBeTruthy();
    expect(screen.getByText(/\(admin\)/)).toBeTruthy();
    expect(screen.getByText(/\(public\)/)).toBeTruthy();
  });

  it('renders AdminAnalyticsRoute with dynamic meter cap, CWV cards, and summary counts', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/analytics',
          loader: (): AdminAnalyticsLoaderData => ADMIN_ANALYTICS_FIXTURE,
          Component: AdminAnalyticsRoute,
        },
      ],
      { initialEntries: ['/analytics'] },
    );

    render(<RouterProvider router={router} />);

    expect(await screen.findByText(/node-api-analytics/i)).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('150')).toBeTruthy();
    expect(screen.getByText('150 / 150')).toBeTruthy();
    expect(screen.getByText('LCP')).toBeTruthy();
  });

  it('renders AdminInboxRoute, AdminQuotasRoute, AdminCmsRoute, and AdminOpsRoute', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/inbox',
          loader: (): AdminInboxLoaderData => ADMIN_INBOX_FIXTURE,
          Component: AdminInboxRoute,
        },
        {
          path: '/quotas',
          loader: (): AdminQuotasLoaderData => ADMIN_QUOTAS_FIXTURE,
          Component: AdminQuotasRoute,
        },
        {
          path: '/cms',
          loader: () => ({ cms: ADMIN_CMS_FIXTURE, qdrant: QDRANT_FIXTURE }),
          Component: AdminCmsRoute,
        },
        {
          path: '/ops',
          loader: (): AdminOpsLoaderData => ADMIN_OPS_FIXTURE,
          Component: AdminOpsRoute,
        },
      ],
      { initialEntries: ['/inbox'] },
    );

    render(<RouterProvider router={router} />);
    expect(await screen.findByText('SHA-256 Verified')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Download spec.txt' }).getAttribute('href')).toBe(
      '/inbox/11111111-1111-4111-8111-111111111111/attachment',
    );

    await router.navigate('/quotas');
    expect(await screen.findByText('Role Policy: guest')).toBeTruthy();
    expect(screen.getByText('session:demo-1')).toBeTruthy();

    await router.navigate('/cms');
    expect(await screen.findByText(/Maintenance Mode Default/i)).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Agensi & Presets/i })).toBeTruthy();

    await router.navigate('/ops');
    expect(await screen.findByText('Namespace: cadence-admin')).toBeTruthy();
    expect(screen.getAllByText('Audit sandbox artifact').length).toBeGreaterThan(0);
  });

  it('returns HTTP 401 on unauthenticated attachment download and ops SSE endpoints', async () => {
    authMocks.resolveAdminSessionFromRequest.mockResolvedValue({
      authenticated: false,
      session: null,
      totpEnabled: false,
      passkeyCount: 0,
    });

    const attachmentUrl = new URL(
      'http://localhost:4301/inbox/11111111-1111-4111-8111-111111111111/attachment',
    );
    const attThrown = await attachmentLoader({
      request: new Request(attachmentUrl),
      url: attachmentUrl,
      pattern: '/inbox/:id/attachment',
      params: { id: '11111111-1111-4111-8111-111111111111' },
      context: new RouterContextProvider(),
    }).catch((err: unknown) => err);
    expect(attThrown).toBeInstanceOf(Response);
    expect((attThrown as Response).status).toBe(401);

    const streamUrl = new URL('http://localhost:4301/api/ops/cluster/stream');
    const streamThrown = await opsStreamLoader({
      request: new Request(streamUrl),
      url: streamUrl,
      pattern: '/api/ops/cluster/stream',
      params: {},
      context: new RouterContextProvider(),
    }).catch((err: unknown) => err);
    expect(streamThrown).toBeInstanceOf(Response);
    expect((streamThrown as Response).status).toBe(401);
  });

  it('enforces noindex/nofollow/noarchive on all admin pages via buildAdminPageMeta', () => {
    const tags = buildAdminPageMeta({
      matches: [
        {
          id: 'root',
          loaderData: { runtimeSeo: { siteUrl: 'https://ops.andrew-k.us' } },
        },
      ],
      pathname: '/analytics',
      title: 'Analytics Telemetry // admin.andrew-k.us',
      description: 'First-party analytics.',
    });

    expect(tags).toContainEqual({ name: 'robots', content: ADMIN_ROBOTS_DIRECTIVE });
    expect(tags).toContainEqual({
      property: 'og:url',
      content: 'https://ops.andrew-k.us/analytics',
    });
  });

  it('supports split keybindings globally across admin TUI routes and renders DB shortcut hint', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          loader: (): AdminRootLoaderData => ({
            chrome: {
              pageTitle: 'admin.andrew-k.us // Solar Forge Ops',
              brandLabel: 'admin.andrew-k.us',
              shortcutHint: 'Ctrl+⇧} / ⌘D split · Ctrl+⇧{ / ⌘⇧D hsplit · Alt+⇧T tab',
              statusBadge: {
                source: 'passkey-gate',
                state: 'ready',
                label: 'isolated ops',
              },
            },
            terminal: ADMIN_OPS_TERMINAL_PROFILE,
          }),
          Component: AdminRoot,
          children: [
            {
              path: 'analytics',
              loader: (): AdminAnalyticsLoaderData => ADMIN_ANALYTICS_FIXTURE,
              Component: AdminAnalyticsRoute,
            },
          ],
        },
      ],
      { initialEntries: ['/analytics'] },
    );

    const { container } = render(<RouterProvider router={router} />);

    expect(await screen.findByText(/node-api-analytics/i)).toBeTruthy();
    expect(screen.getByText('Ctrl+⇧} / ⌘D split · Ctrl+⇧{ / ⌘⇧D hsplit · Alt+⇧T tab')).toBeTruthy();
    const workspaceEl = container.querySelector('[data-pane-count]') as HTMLElement;
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');

    // Ctrl+Shift+{ splits open an isolated admin ops terminal pane below /analytics
    fireEvent.keyDown(window, {
      key: '{',
      code: 'BracketLeft',
      ctrlKey: true,
      shiftKey: true,
    });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');

    const input = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'whoami' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(screen.getByText('admin@andrew-k.us (isolated ops shell)')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'W', ctrlKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');
  });

  it('renders AdminLoginRoute and sanitizes untrusted redirect targets', async () => {
    const loginUrl = new URL('http://localhost:4301/login?next=https://evil.example/phish');
    const safeResult = loginLoader({
      request: new Request(loginUrl),
      url: loginUrl,
      pattern: '/login',
      params: {},
      context: new RouterContextProvider(),
    });
    expect(safeResult.nextTarget).toBe('/');

    const router = createMemoryRouter(
      [
        {
          path: '/login',
          loader: () => ({ nextTarget: '/analytics' }),
          Component: AdminLoginRoute,
        },
      ],
      { initialEntries: ['/login'] },
    );

    render(<RouterProvider router={router} />);
    expect(await screen.findByRole('heading', { name: 'Admin Passkey Gate' })).toBeTruthy();
  });
});
