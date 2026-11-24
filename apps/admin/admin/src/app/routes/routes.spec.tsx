import type {
  AdminAnalyticsLoaderData,
  AdminHomeLoaderData,
  AdminRootLoaderData,
} from '@aklapper/core';
import { ADMIN_OPS_TERMINAL_PROFILE } from '@aklapper/db';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import AdminRoot from '../root';
import { ADMIN_ROBOTS_DIRECTIVE, buildAdminPageMeta } from '../seo';
import AdminAnalyticsRoute from './analytics';
import AdminHomeRoute from './home';

const ADMIN_HOME_FIXTURE: AdminHomeLoaderData = {
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
};

const ADMIN_ANALYTICS_FIXTURE: AdminAnalyticsLoaderData = {
  content: {
    windowTitle: 'First-Party Visitor Analytics // Postgres 19',
    description: 'Telemetry ingested via node-api-analytics.',
  },
  summary: {
    totalSessions: 42,
    totalEvents: 150,
  },
};

describe('Admin routes & SEO', () => {
  it('renders AdminHomeRoute with both public and admin registry entries', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          loader: (): AdminHomeLoaderData => ADMIN_HOME_FIXTURE,
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

  it('renders AdminAnalyticsRoute with dynamic meter cap and summary counts', async () => {
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

  it('supports Ghostty split keybindings globally across admin TUI routes', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          loader: (): AdminRootLoaderData => ({
            chrome: {
              pageTitle: 'admin.andrew-k.us // Solar Forge Ops',
              brandLabel: 'admin.andrew-k.us',
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
    const workspaceEl = container.querySelector('[data-pane-count]') as HTMLElement;
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');

    // Ghostty Ctrl+Shift+{ splits open an isolated admin ops terminal pane below /analytics
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
});
