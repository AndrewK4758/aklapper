import {
  type PortalAgensiLoaderData,
  PortalCadenceContentSchema,
  type PortalCadenceLoaderData,
  type PortalMaintenanceLoaderData,
  type PortalRootLoaderData,
  type StreamResult,
} from '@aklapper/core';
import { buildRouteWorkspaceStorageKey } from '@aklapper/ui/workspace-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRoutesStub, Link } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PortalRoot, { ErrorBoundary, shouldRevalidate } from './root';
import { portalPaneStreamStore } from './workspace/portalPaneStreamStore';
import {
  parsePortalWorkspaceSnapshot,
  PORTAL_GLOBAL_STORAGE_KEY,
} from './workspace/portalWorkspaceSnapshot';
import { portalWorkspaceStore } from './workspace/portalWorkspaceStore';

const TEST_TERMINAL: NonNullable<PortalRootLoaderData['terminal']> = {
  slug: 'portal-home',
  bannerTitle: 'Solar Forge Terminal // tty1',
  bannerMeta: 'tty1 · interactive shell',
  osLabel: '⚡',
  directory: '~/projects/aklapper',
  vcsBranch: 'develop',
  vcsState: 'clean',
  contextLabel: 'guest@andrew-k.us',
  placeholder: 'type a command',
  quickCommands: ['status'],
  initialEntries: [],
  commands: [
    {
      name: 'status',
      description: 'status',
      kind: 'static',
      output: 'CLUSTER_STATUS_OK',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 1,
    },
  ],
};

const PORTAL_ROOT_FIXTURE: PortalRootLoaderData = {
  maintenanceMode: false,
  chrome: {
    pageTitle: 'andrew-k.us // Solar Forge Terminal',
    brandLabel: 'Andrew Klapper Portfolio',
    brandContactEmail: 'andrew@andrew-k.us',
    shortcutHint: 'Alt+⇧N tab',
    statusBadge: {
      source: 'gke-autopilot',
      state: 'idle',
      label: '0 pods',
    },
    footerText: 'Solar Forge',
    footerLinkLabel: 'agensi.io',
    footerLinkUrl: 'https://agensi.io',
    maintenanceModeDefault: false,
  },
  maintenance: null,
  terminal: TEST_TERMINAL,
};

const MAINTENANCE_FIXTURE: PortalMaintenanceLoaderData = {
  content: {
    windowTitle: 'tui :: changes in progress',
    statusBadge: {
      source: 'solar-forge-v2',
      state: 'scaling',
      label: 'CHANGES IN PROGRESS',
    },
    heading: 'Changes in Progress',
    lead: 'Scheduled maintenance.',
    progressPercent: 75,
    progressAriaLabel: 'Progress',
    metaLeft: 'mode: maintenance',
    metaRight: '75%',
  },
  terminal: TEST_TERMINAL,
  milestones: [],
};

const AGENSI_PAYLOAD: PortalAgensiLoaderData = {
  content: {
    windowTitle: 'tui :: agensi',
    statusBadge: { source: 'agensi', state: 'ready', label: 'LIVE' },
    description: 'Commercial AI skills.',
    searchPlaceholder: 'Filter skills...',
    emptyStateLabel: 'No matching skills.',
    outboundCtaLabel: 'Visit Agensi',
  },
  skills: [],
};

const CADENCE_PAYLOAD: PortalCadenceLoaderData = {
  content: PortalCadenceContentSchema.parse({
    windowTitle: 'CADENCE Builder',
    statusBadge: { source: 'cadence', state: 'idle', label: 'Idle' },
    description: 'Interactive sandbox builder.',
    iframeTitle: 'CADENCE Preview',
  }),
  presets: [],
};

describe('Portal global workspace persistence and exclusions', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    portalWorkspaceStore.resetForTest();
    portalPaneStreamStore.resetForTest();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    portalWorkspaceStore.resetForTest();
    portalPaneStreamStore.resetForTest();
  });

  it('persists one global desktop workspace across SPA route transitions with zero hidden route layers', async () => {
    const legacyPortalKey = buildRouteWorkspaceStorageKey('portal', '/');
    const adminKey = buildRouteWorkspaceStorageKey('admin', '/ops');
    window.sessionStorage.setItem(legacyPortalKey, '{"legacy":true}');
    window.sessionStorage.setItem(adminKey, '{"admin":"keep"}');

    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: () => ({
          runtimeSeo: { siteUrl: 'https://andrew-k.us' },
          correlationId: 'corr-portal-global',
          maintenanceMode: false,
          rootPayload: Promise.resolve<StreamResult<PortalRootLoaderData>>({
            ok: true,
            data: PORTAL_ROOT_FIXTURE,
          }),
        }),
        shouldRevalidate,
        Component: PortalRoot,
        ErrorBoundary,
        children: [
          {
            index: true,
            Component: () => (
              <div>
                <span>Home Route</span>
                <Link to='/agensi'>Go Agensi</Link>
                <Link to='/cadence/'>Go Cadence Slash</Link>
              </div>
            ),
          },
          {
            path: 'agensi',
            Component: () => (
              <div>
                <span>Agensi Route</span>
                <Link to='/cadence/'>Go Cadence Slash</Link>
                <Link to='/'>Go Home</Link>
              </div>
            ),
          },
          {
            path: 'cadence',
            Component: () => (
              <div>
                <span>Cadence Route</span>
                <Link to='/'>Go Home</Link>
              </div>
            ),
          },
        ],
      },
    ]);

    const { container } = render(<Stub initialEntries={['/']} />);
    await screen.findByText('Home Route');

    // Create a second tab and rename it to "ops"
    fireEvent.keyDown(window, { key: 'N', code: 'KeyN', altKey: true, shiftKey: true });
    expect(container.querySelector('[data-tab-count="2"]')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'F2', code: 'F2' });
    const renameInput = await screen.findByLabelText('Rename tab');
    fireEvent.change(renameInput, { target: { value: 'ops' } });
    fireEvent.keyDown(renameInput, { key: 'Enter', code: 'Enter' });
    expect(await screen.findByText('ops')).toBeTruthy();

    // Return to tab 1 and create a split pane
    fireEvent.click(screen.getByRole('tab', { name: /tty1/i }));
    fireEvent.keyDown(window, {
      key: '}',
      code: 'BracketRight',
      ctrlKey: true,
      shiftKey: true,
    });
    expect(container.querySelector('[data-pane-count="2"]')).toBeTruthy();

    // Navigate via SPA links: / -> /agensi -> /cadence/
    fireEvent.click(screen.getByRole('link', { name: 'Go Agensi' }));
    await screen.findByText('Agensi Route');

    expect(container.querySelectorAll('[data-route-workspace]')).toHaveLength(0);
    expect(container.querySelector('[data-tab-count="2"]')).toBeTruthy();
    expect(container.querySelector('[data-pane-count="2"]')).toBeTruthy();
    expect(screen.getByText('ops')).toBeTruthy();

    fireEvent.click(screen.getByRole('link', { name: 'Go Cadence Slash' }));
    await screen.findByText('Cadence Route');

    expect(container.querySelectorAll('[data-route-workspace]')).toHaveLength(0);
    expect(container.querySelector('[data-tab-count="2"]')).toBeTruthy();
    expect(container.querySelector('[data-pane-count="2"]')).toBeTruthy();

    // Persisted globally under v1:global; legacy portal per-route key pruned; admin key untouched
    const savedRaw = window.sessionStorage.getItem(PORTAL_GLOBAL_STORAGE_KEY);
    expect(savedRaw).not.toBeNull();
    const parsed = parsePortalWorkspaceSnapshot(savedRaw as string);
    expect(parsed?.tabs.tabs).toHaveLength(2);
    expect(parsed?.lastRouteKey).toBe('/cadence');
    expect(window.sessionStorage.getItem(legacyPortalKey)).toBeNull();
    expect(window.sessionStorage.getItem(adminKey)).toBe('{"admin":"keep"}');
  });

  it('auto-activates the pinned host tab and clears non-host zoom when navigating from a secondary tab', async () => {
    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: () => ({
          runtimeSeo: { siteUrl: 'https://andrew-k.us' },
          correlationId: 'corr-portal-focus',
          maintenanceMode: false,
          rootPayload: Promise.resolve<StreamResult<PortalRootLoaderData>>({
            ok: true,
            data: PORTAL_ROOT_FIXTURE,
          }),
        }),
        shouldRevalidate,
        Component: PortalRoot,
        ErrorBoundary,
        children: [
          {
            index: true,
            Component: () => <div>Home Body</div>,
          },
          {
            path: 'contact',
            Component: () => <div>Contact Primary View</div>,
          },
        ],
      },
    ]);

    const { container } = render(<Stub initialEntries={['/']} />);
    await screen.findByText('Home Body');

    // Open secondary Tab 2 (Tab 2 becomes active, marking tab-1 panel inactive)
    fireEvent.keyDown(window, { key: 'N', code: 'KeyN', altKey: true, shiftKey: true });
    expect(container.querySelector('[data-tab-count="2"]')).toBeTruthy();
    expect(
      container.querySelector('[data-tab-panel="tab-1"]')?.getAttribute('data-tab-active'),
    ).toBe('false');

    // Clicking header brand email link to /contact activates pinned host tab so /contact renders immediately
    fireEvent.click(screen.getByRole('link', { name: 'andrew@andrew-k.us' }));
    expect(await screen.findByText('Contact Primary View')).toBeTruthy();
    expect(
      container.querySelector('[data-tab-panel="tab-1"]')?.getAttribute('data-tab-active'),
    ).toBe('true');
    expect(container.querySelector('[data-tab-count="2"]')).toBeTruthy();
  });

  it('launches split and tab panes from the header Open Pane menu on non-root routes and dismisses on Escape without exiting route', async () => {
    portalPaneStreamStore.setTransportForTest({
      load: async routePath => {
        if (routePath === '/agensi') {
          return {
            correlationId: 'corr-agensi-menu',
            payload: Promise.resolve<StreamResult<PortalAgensiLoaderData>>({
              ok: true,
              data: AGENSI_PAYLOAD,
            }),
          } as never;
        }
        return {
          correlationId: 'corr-cadence-menu',
          payload: Promise.resolve<StreamResult<PortalCadenceLoaderData>>({
            ok: true,
            data: CADENCE_PAYLOAD,
          }),
        } as never;
      },
      submitAction: async () => ({ ok: true }) as never,
    });

    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: () => ({
          runtimeSeo: { siteUrl: 'https://andrew-k.us' },
          correlationId: 'corr-portal-menu',
          maintenanceMode: false,
          rootPayload: Promise.resolve<StreamResult<PortalRootLoaderData>>({
            ok: true,
            data: PORTAL_ROOT_FIXTURE,
          }),
        }),
        shouldRevalidate,
        Component: PortalRoot,
        ErrorBoundary,
        children: [
          { index: true, Component: () => <div>Home Probe</div> },
          { path: 'contact', Component: () => <div>Contact Primary Probe</div> },
        ],
      },
    ]);

    const { container } = render(<Stub initialEntries={['/contact']} />);
    expect(await screen.findByText('Contact Primary Probe')).toBeTruthy();

    // Open header menu -> Escape dismisses menu WITHOUT exiting /contact to /
    const menuTrigger = screen.getByRole('button', { name: 'Open Pane' });
    fireEvent.click(menuTrigger);
    expect(await screen.findByRole('menu')).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
    expect(screen.getByText('Contact Primary Probe')).toBeTruthy();

    // Launch /cadence in split while primary /contact remains visible
    fireEvent.click(menuTrigger);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'CADENCE (Split)' }));
    expect(await screen.findByText('Interactive sandbox builder.')).toBeTruthy();
    expect(screen.getByText('Contact Primary Probe')).toBeTruthy();
    expect(container.querySelector('[data-pane-count="2"]')).toBeTruthy();

    // Launch /agensi in a new tab
    fireEvent.click(menuTrigger);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Agensi (Tab)' }));
    expect(await screen.findByText('Commercial AI skills.')).toBeTruthy();
    expect(container.querySelector('[data-tab-count="2"]')).toBeTruthy();
  });

  it('shouldRevalidate returns false on routine child navigations/actions and defers on /changes-in-progress', () => {
    expect(
      shouldRevalidate({
        currentUrl: new URL('https://andrew-k.us/'),
        nextUrl: new URL('https://andrew-k.us/agensi'),
        defaultShouldRevalidate: true,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(false);

    expect(
      shouldRevalidate({
        currentUrl: new URL('https://andrew-k.us/contact'),
        nextUrl: new URL('https://andrew-k.us/contact'),
        formAction: '/contact',
        defaultShouldRevalidate: true,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(false);

    expect(
      shouldRevalidate({
        currentUrl: new URL('https://andrew-k.us/'),
        nextUrl: new URL('https://andrew-k.us/changes-in-progress'),
        defaultShouldRevalidate: true,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(true);
  });

  it('maintenanceMode and /changes-in-progress preserve saved v1:global snapshots unread and emit policy telemetry', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    window.sessionStorage.setItem(PORTAL_GLOBAL_STORAGE_KEY, '{"sentinel":"keep"}');

    const MaintenanceStub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: () => ({
          runtimeSeo: { siteUrl: 'https://andrew-k.us' },
          correlationId: 'corr-portal-maint',
          maintenanceMode: true,
          rootPayload: Promise.resolve<StreamResult<PortalRootLoaderData>>({
            ok: true,
            data: {
              ...PORTAL_ROOT_FIXTURE,
              maintenanceMode: true,
              maintenance: MAINTENANCE_FIXTURE,
            },
          }),
        }),
        Component: PortalRoot,
        ErrorBoundary,
        children: [{ index: true, Component: () => <div>unused</div> }],
      },
    ]);

    const first = render(<MaintenanceStub initialEntries={['/']} />);
    await screen.findByText('Changes in Progress');
    expect(window.sessionStorage.getItem(PORTAL_GLOBAL_STORAGE_KEY)).toBe('{"sentinel":"keep"}');
    expect(
      debugSpy.mock.calls.some(call => String(call[0]).includes('"branch":"excluded-maintenance"')),
    ).toBe(true);
    expect(screen.queryByRole('button', { name: 'Open Pane' })).toBeNull();
    first.unmount();

    const StandaloneStub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: () => ({
          runtimeSeo: { siteUrl: 'https://andrew-k.us' },
          correlationId: 'corr-portal-standalone',
          maintenanceMode: false,
          rootPayload: Promise.resolve<StreamResult<PortalRootLoaderData>>({
            ok: true,
            data: PORTAL_ROOT_FIXTURE,
          }),
        }),
        Component: PortalRoot,
        ErrorBoundary,
        children: [
          { path: 'changes-in-progress', Component: () => <div>Standalone Changes View</div> },
        ],
      },
    ]);

    await act(async () => {
      render(<StandaloneStub initialEntries={['/changes-in-progress']} />);
    });
    expect(await screen.findByText('Standalone Changes View')).toBeTruthy();
    expect(window.sessionStorage.getItem(PORTAL_GLOBAL_STORAGE_KEY)).toBe('{"sentinel":"keep"}');
    expect(
      debugSpy.mock.calls.some(call => String(call[0]).includes('"branch":"excluded-standalone"')),
    ).toBe(true);
  });
});
