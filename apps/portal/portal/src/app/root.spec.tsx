import type { PortalMaintenanceLoaderData, PortalRootLoaderData } from '@aklapper/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import PortalRoot from './root';

const CHROME_FIXTURE: PortalRootLoaderData['chrome'] = {
  pageTitle: 'andrew-k.us // Solar Forge Terminal',
  brandLabel: 'andrew-k.us :: tty1',
  statusBadge: {
    source: 'gke-autopilot',
    state: 'idle',
    label: '0 pods (scale-to-0)',
  },
  footerText: 'Solar Forge // Fastify 5 + React Router 8 SSR',
  footerLinkLabel: 'agensi.io/creators/aklapper',
  footerLinkUrl: 'https://agensi.io/creators/aklapper',
  maintenanceModeDefault: false,
};

const MAINTENANCE_FIXTURE: PortalMaintenanceLoaderData = {
  content: {
    windowTitle: 'tui :: andrew-k.us // changes in progress',
    statusBadge: {
      source: 'solar-forge-v2',
      state: 'scaling',
      label: 'CHANGES IN PROGRESS',
    },
    heading: 'Changes in Progress',
    lead: 'andrew-k.us is being rebuilt into the Solar Forge v2 interactive terminal and TUI platform.',
    progressPercent: 72,
    progressAriaLabel: 'Solar Forge v2 rebuild progress',
    metaLeft: 'mode: maintenance (no navigation)',
    metaRight: 'progress: 72% · drag titlebar or type below',
  },
  terminal: {
    slug: 'portal-maintenance',
    bannerTitle: 'Solar Forge Terminal // andrew-k.us (maintenance)',
    bannerMeta: 'tty1 · type "help" or press Tab',
    osLabel: '⚡',
    directory: '~/andrew-k.us',
    vcsBranch: 'portfolio_v2 !wip',
    vcsState: 'modified',
    contextLabel: 'visitor@andrew-k.us',
    placeholder: 'type a command',
    quickCommands: ['whoami', 'clear'],
    initialEntries: [
      {
        command: 'status',
        output: 'andrew-k.us :: Solar Forge v2 rebuild is actively underway.',
        status: 'ok',
        durationLabel: '8ms',
        timestamp: '00:00:00',
        sortOrder: 0,
      },
    ],
    commands: [
      {
        name: 'whoami',
        description: 'active session identity',
        kind: 'static',
        output: 'visitor@andrew-k.us (read-only maintenance tty1)',
        targetRoute: null,
        allowedRoutes: [],
        errorTemplate: null,
        sortOrder: 1,
      },
      {
        name: 'clear',
        description: 'clear terminal',
        kind: 'clear',
        output: '',
        targetRoute: null,
        allowedRoutes: [],
        errorTemplate: null,
        sortOrder: 2,
      },
    ],
  },
  milestones: [
    {
      slug: 'solar-forge-theme',
      status: 'done',
      label: 'Solar Forge 4-layer CSS variable theme & animated reticle emblem',
      sortOrder: 1,
      enabled: true,
    },
  ],
};

describe('PortalRoot', () => {
  it('renders the Solar Forge portal chrome from loader data without admin leakage', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          loader: (): PortalRootLoaderData => ({
            maintenanceMode: false,
            chrome: CHROME_FIXTURE,
            maintenance: null,
          }),
          Component: PortalRoot,
          children: [{ index: true, Component: () => <div>Home Probe</div> }],
        },
      ],
      { initialEntries: ['/'] },
    );

    render(<RouterProvider router={router} />);

    expect(await screen.findByText('andrew-k.us :: tty1')).toBeTruthy();
    expect(screen.getByText('Home Probe')).toBeTruthy();
    expect(screen.queryByText('cadence-admin')).toBeNull();
    const sitemapLink = screen.getByRole('link', { name: 'Sitemap' });
    expect(sitemapLink.getAttribute('href')).toBe('/sitemap.xml');
    const main = screen.getByRole('main');
    expect(main.getAttribute('data-terminal-viewport')).toBe('true');
  });

  it('renders Changes in Progress from loader data with zero navigation links in maintenance mode', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          loader: (): PortalRootLoaderData => ({
            maintenanceMode: true,
            chrome: CHROME_FIXTURE,
            maintenance: MAINTENANCE_FIXTURE,
          }),
          Component: PortalRoot,
          children: [{ index: true, Component: () => <div>Should Not Render</div> }],
        },
      ],
      { initialEntries: ['/'] },
    );

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: 'Changes in Progress' })).toBeTruthy();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryByText('Should Not Render')).toBeNull();
    const progressbar = screen.getByRole('progressbar', {
      name: 'Solar Forge v2 rebuild progress',
    });
    expect(progressbar.getAttribute('aria-valuenow')).toBe('72');

    const input = screen.getByLabelText('Terminal command input');
    fireEvent.change(input, { target: { value: 'whoami' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(screen.getByText(/visitor@andrew-k\.us \(read-only maintenance tty1\)/)).toBeTruthy();
  });

  it('supports Ghostty split keybindings globally on portal TUI routes', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          loader: (): PortalRootLoaderData => ({
            maintenanceMode: false,
            chrome: CHROME_FIXTURE,
            maintenance: null,
            terminal: MAINTENANCE_FIXTURE.terminal,
          }),
          Component: PortalRoot,
          children: [{ path: 'menu', Component: () => <div>TUI Menu Probe</div> }],
        },
      ],
      { initialEntries: ['/menu'] },
    );

    const { container } = render(<RouterProvider router={router} />);

    expect(await screen.findByText('TUI Menu Probe')).toBeTruthy();
    const workspaceEl = container.querySelector('[data-pane-count]') as HTMLElement;
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');

    // Split open a separate terminal pane right alongside the TUI route via Ctrl+Shift+}
    fireEvent.keyDown(window, {
      key: '}',
      code: 'BracketRight',
      ctrlKey: true,
      shiftKey: true,
    });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');
    expect(screen.getByText('TUI Menu Probe')).toBeTruthy();
    expect(container.querySelector('[data-pane-tty="tty2"]')).toBeTruthy();

    // Split the active terminal pane down via Ctrl+Shift+{
    fireEvent.keyDown(window, {
      key: '{',
      code: 'BracketLeft',
      ctrlKey: true,
      shiftKey: true,
    });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('3');
    expect(container.querySelector('[data-pane-tty="tty3"]')).toBeTruthy();

    // Close spawned split panes cleanly
    fireEvent.keyDown(window, { key: 'W', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: 'W', ctrlKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');

    // Open a new terminal tab via Alt+Shift+T from /menu TUI route, switch back via Alt+1, then close it
    fireEvent.keyDown(window, { key: 'T', code: 'KeyT', altKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('2');
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-2');
    fireEvent.keyDown(window, { key: '1', code: 'Digit1', altKey: true });
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-1');
    expect(screen.getByText('TUI Menu Probe')).toBeTruthy();
    fireEvent.keyDown(window, { key: '2', code: 'Digit2', altKey: true });
    fireEvent.keyDown(window, { key: 'W', code: 'KeyW', altKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('1');
  });
});
