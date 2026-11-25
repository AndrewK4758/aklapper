import type {
  PortalMaintenanceLoaderData,
  PortalRootLoaderData,
  StreamResult,
} from '@aklapper/core';
import {
  buildRouteWorkspaceStorageKey,
  parseRouteWorkspaceSnapshot,
} from '@aklapper/ui/workspace-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRoutesStub, Link } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { portalRouteWorkspaceStore } from './PortalRootShell';
import PortalRoot, { ErrorBoundary, shouldRevalidate } from './root';

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

describe('Portal route workspace keep-alive and session persistence', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    portalRouteWorkspaceStore.resetForTest();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    portalRouteWorkspaceStore.resetForTest();
  });

  it('partitions workspaces per route and normalizes trailing slashes without clobbering sibling storage', async () => {
    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: () => ({
          runtimeSeo: { siteUrl: 'https://andrew-k.us' },
          correlationId: 'corr-portal-ka',
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

    // Create a second tab on "/"
    fireEvent.keyDown(window, { key: 'N', code: 'KeyN', altKey: true, shiftKey: true });

    const homeLayer = container.querySelector<HTMLElement>('[data-route-workspace="/"]');
    expect(
      homeLayer?.querySelector<HTMLElement>('[data-tab-count]')?.getAttribute('data-tab-count'),
    ).toBe('2');

    // Navigate to /agensi
    fireEvent.click(screen.getByRole('link', { name: 'Go Agensi' }));
    await screen.findByText('Agensi Route');

    const agensiLayer = container.querySelector<HTMLElement>('[data-route-workspace="/agensi"]');
    expect(
      agensiLayer?.querySelector<HTMLElement>('[data-tab-count]')?.getAttribute('data-tab-count'),
    ).toBe('1');
    expect(homeLayer?.hidden).toBe(true);
    expect(agensiLayer?.hidden).toBe(false);

    // Verify sessionStorage isolation
    const homeSaved = window.sessionStorage.getItem(buildRouteWorkspaceStorageKey('portal', '/'));
    expect(homeSaved).not.toBeNull();
    expect(parseRouteWorkspaceSnapshot(homeSaved as string)?.tabs.tabs).toHaveLength(2);

    // Navigate back to "/" and then to "/cadence/" (trailing slash normalizes to "/cadence")
    fireEvent.click(screen.getByRole('link', { name: 'Go Home' }));
    fireEvent.click(screen.getByRole('link', { name: 'Go Cadence Slash' }));
    await screen.findByText('Cadence Route');

    const cadenceLayer = container.querySelector<HTMLElement>('[data-route-workspace="/cadence"]');
    expect(cadenceLayer).not.toBeNull();
    expect(cadenceLayer?.hidden).toBe(false);
  });

  it('preserves unsaved form drafts on /contact across SPA route switches without remounting', async () => {
    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: () => ({
          runtimeSeo: { siteUrl: 'https://andrew-k.us' },
          correlationId: 'corr-portal-draft',
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
                <span>Home Body</span>
                <Link to='/contact'>Open Contact</Link>
              </div>
            ),
          },
          {
            path: 'contact',
            Component: () => (
              <div>
                <textarea aria-label='Contact draft' defaultValue='' />
                <Link to='/'>Back Home</Link>
              </div>
            ),
          },
        ],
      },
    ]);

    render(<Stub initialEntries={['/contact']} />);
    const draftBox = (await screen.findByLabelText('Contact draft')) as HTMLTextAreaElement;
    fireEvent.change(draftBox, { target: { value: 'Draft message body' } });
    expect(draftBox.value).toBe('Draft message body');

    fireEvent.click(screen.getByRole('link', { name: 'Back Home' }));
    await screen.findByText('Home Body');

    fireEvent.click(screen.getByRole('link', { name: 'Open Contact' }));
    await waitFor(() => {
      expect((screen.getByLabelText('Contact draft') as HTMLTextAreaElement).value).toBe(
        'Draft message body',
      );
    });
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

  it('maintenanceMode bypasses workspace caching without touching saved portal snapshots and emits policy telemetry', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const homeKey = buildRouteWorkspaceStorageKey('portal', '/');
    window.sessionStorage.setItem(homeKey, '{"sentinel":"keep"}');

    const Stub = createRoutesStub([
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

    await act(async () => {
      render(<Stub initialEntries={['/']} />);
    });

    await screen.findByText('Changes in Progress');
    expect(window.sessionStorage.getItem(homeKey)).toBe('{"sentinel":"keep"}');
    expect(
      debugSpy.mock.calls.some(call => String(call[0]).includes('"branch":"excluded-maintenance"')),
    ).toBe(true);
  });
});
