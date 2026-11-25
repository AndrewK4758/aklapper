import {
  createPublicAppError,
  type PortalMaintenanceLoaderData,
  type PortalRootLoaderData,
  type StreamResult,
} from '@aklapper/core';
import { usePaneNavigation, ViewportProvider } from '@aklapper/ui';
import { fireEvent, render, screen } from '@testing-library/react';
import { createRoutesStub, RouterContextProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { loadPortalRootDataWithPrerenderMock } = vi.hoisted(() => ({
  loadPortalRootDataWithPrerenderMock:
    vi.fn<(override?: boolean) => Promise<PortalRootLoaderData>>(),
}));

vi.mock('@aklapper/db', async importOriginal => {
  const actual = await importOriginal<typeof import('@aklapper/db')>();
  return {
    ...actual,
    loadPortalRootDataWithPrerender: loadPortalRootDataWithPrerenderMock,
  };
});

import PortalRoot, { ErrorBoundary, loader, meta } from './root';

const CHROME_FIXTURE: PortalRootLoaderData['chrome'] = {
  pageTitle: 'andrew-k.us // Solar Forge Terminal',
  brandLabel: 'Andrew Klapper Portfolio',
  brandContactEmail: 'andrew@andrew-k.us',
  shortcutHint: 'Ctrl+⇧} / Alt+⇧D split · Ctrl+⇧{ / Alt+⇧S hsplit · Alt+⇧N tab · Alt+T tui',
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

function makeRootLoaderArgs(
  url = 'https://andrew-k.us/',
  headers?: HeadersInit,
): Parameters<typeof loader>[0] {
  return {
    request: new Request(url, { headers }),
    params: {},
    context: new RouterContextProvider(),
    unstable_pattern: '/',
    url: new URL(url),
    pattern: '/',
  } as Parameters<typeof loader>[0];
}

describe('PortalRoot', () => {
  const originalMaintenanceEnv = process.env['PORTAL_MAINTENANCE_MODE'];

  afterEach(() => {
    if (originalMaintenanceEnv === undefined) {
      delete process.env['PORTAL_MAINTENANCE_MODE'];
    } else {
      process.env['PORTAL_MAINTENANCE_MODE'] = originalMaintenanceEnv;
    }
    vi.clearAllMocks();
  });

  it('returns deferred rootPayload synchronously and forwards tri-state maintenanceModeOverride', async () => {
    delete process.env['PORTAL_MAINTENANCE_MODE'];
    const pending = Promise.withResolvers<PortalRootLoaderData>();
    loadPortalRootDataWithPrerenderMock.mockReturnValueOnce(pending.promise);

    const result = loader(makeRootLoaderArgs());

    expect(result.maintenanceMode).toBe(false);
    expect(result.correlationId).toMatch(/\S+/);
    expect(loadPortalRootDataWithPrerenderMock).toHaveBeenCalledWith(undefined);
    expect(result.rootPayload).toBeInstanceOf(Promise);

    pending.resolve({
      maintenanceMode: false,
      chrome: CHROME_FIXTURE,
      maintenance: null,
    });
    const settled = await result.rootPayload;
    expect(settled).toEqual({
      ok: true,
      data: {
        maintenanceMode: false,
        chrome: CHROME_FIXTURE,
        maintenance: null,
      },
    });
  });

  it('streams loading status first and then renders Solar Forge portal chrome without admin leakage', async () => {
    const deferred = Promise.withResolvers<StreamResult<PortalRootLoaderData>>();
    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: () => ({
          runtimeSeo: { siteUrl: 'https://andrew-k.us' },
          correlationId: 'corr-root-ok',
          maintenanceMode: false,
          rootPayload: deferred.promise,
        }),
        Component: PortalRoot,
        ErrorBoundary,
        children: [{ index: true, Component: () => <div>Home Probe</div> }],
      },
    ]);

    render(<Stub initialEntries={['/']} />);

    const status = await screen.findByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('aria-busy')).toBe('true');

    deferred.resolve({
      ok: true,
      data: {
        maintenanceMode: false,
        chrome: CHROME_FIXTURE,
        maintenance: null,
      },
    });

    expect(await screen.findByText('Andrew Klapper Portfolio')).toBeTruthy();
    const contactLink = await screen.findByRole('link', { name: 'andrew@andrew-k.us' });
    expect(contactLink.getAttribute('href')).toBe('/contact');
    expect(
      screen.getByText('Ctrl+⇧} / Alt+⇧D split · Ctrl+⇧{ / Alt+⇧S hsplit · Alt+⇧N tab · Alt+T tui'),
    ).toBeTruthy();
    expect(screen.getByText('Home Probe')).toBeTruthy();
    expect(screen.queryByText('cadence-admin')).toBeNull();
    expect(screen.getByRole('link', { name: 'Sitemap' }).getAttribute('href')).toBe('/sitemap.xml');
    expect(screen.getByRole('main').getAttribute('data-terminal-viewport')).toBe('true');
  });

  it('switches streamed body to Changes in Progress when env is unset and DB maintenanceMode is active', async () => {
    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: () => ({
          runtimeSeo: { siteUrl: 'https://andrew-k.us' },
          correlationId: 'corr-db-maint',
          maintenanceMode: false,
          rootPayload: Promise.resolve<StreamResult<PortalRootLoaderData>>({
            ok: true,
            data: {
              maintenanceMode: true,
              chrome: { ...CHROME_FIXTURE, maintenanceModeDefault: true },
              maintenance: MAINTENANCE_FIXTURE,
            },
          }),
        }),
        Component: PortalRoot,
        children: [{ index: true, Component: () => <div>Should Not Render</div> }],
      },
    ]);

    render(<Stub initialEntries={['/']} />);

    expect(await screen.findByRole('heading', { name: 'Changes in Progress' })).toBeTruthy();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryByText('Should Not Render')).toBeNull();
    expect(
      screen
        .getByRole('progressbar', { name: 'Solar Forge v2 rebuild progress' })
        .getAttribute('aria-valuenow'),
    ).toBe('72');

    const input = screen.getByLabelText('Terminal command input');
    fireEvent.change(input, { target: { value: 'whoami' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(screen.getByText(/visitor@andrew-k\.us \(read-only maintenance tty1\)/)).toBeTruthy();
  });

  it('emits synchronous noindex meta and static offline maintenance fallback when PORTAL_MAINTENANCE_MODE=true and Postgres is offline', async () => {
    process.env['PORTAL_MAINTENANCE_MODE'] = 'true';
    loadPortalRootDataWithPrerenderMock.mockRejectedValueOnce(new Error('connection terminated'));

    const loaderData = loader(makeRootLoaderArgs());
    expect(loaderData.maintenanceMode).toBe(true);
    expect(loadPortalRootDataWithPrerenderMock).toHaveBeenCalledWith(true);

    const tags = meta({
      loaderData,
      matches: [
        {
          id: 'root',
          params: {},
          pathname: '/',
          meta: [],
          loaderData,
        },
      ],
      location: { pathname: '/', search: '', hash: '', state: null, key: 'r1' },
      params: {},
    });
    expect(tags).toContainEqual({ name: 'robots', content: 'noindex, nofollow' });

    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: () => loaderData,
        Component: PortalRoot,
      },
    ]);

    render(<Stub initialEntries={['/']} />);

    expect(await screen.findByTestId('offline-maintenance-fallback')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Changes in Progress' })).toBeTruthy();
    expect(screen.getByText(loaderData.correlationId)).toBeTruthy();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('renders correlated ErrorElement inside intact shell on root stream timeout', async () => {
    const timeoutError = createPublicAppError({
      code: 'ERR_STREAM_TIMEOUT',
      status: 504,
      message: 'Section took too long to load.',
      action: 'Retry loading or refresh.',
      correlationId: 'corr-root-504',
    });

    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: () => ({
          runtimeSeo: { siteUrl: 'https://andrew-k.us' },
          correlationId: 'corr-root-504',
          maintenanceMode: false,
          rootPayload: Promise.resolve<StreamResult<PortalRootLoaderData>>({
            ok: false,
            error: timeoutError,
          }),
        }),
        Component: PortalRoot,
      },
    ]);

    render(<Stub initialEntries={['/']} />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('ERR_STREAM_TIMEOUT');
    expect(alert.textContent).toContain('corr-root-504');
    expect(screen.getByRole('button', { name: /Retry/i })).toBeTruthy();
  });

  it('supports Ghostty split keybindings globally on portal TUI routes', async () => {
    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: () => ({
          runtimeSeo: { siteUrl: 'https://andrew-k.us' },
          correlationId: 'corr-pane',
          maintenanceMode: false,
          rootPayload: Promise.resolve<StreamResult<PortalRootLoaderData>>({
            ok: true,
            data: {
              maintenanceMode: false,
              chrome: CHROME_FIXTURE,
              maintenance: null,
              terminal: MAINTENANCE_FIXTURE.terminal,
            },
          }),
        }),
        Component: PortalRoot,
        children: [{ path: 'menu', Component: () => <div>TUI Menu Probe</div> }],
      },
    ]);

    const { container } = render(<Stub initialEntries={['/menu']} />);

    expect(await screen.findByText('TUI Menu Probe')).toBeTruthy();
    const workspaceEl = container.querySelector('[data-pane-count]') as HTMLElement;
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');

    fireEvent.keyDown(window, {
      key: '}',
      code: 'BracketRight',
      ctrlKey: true,
      shiftKey: true,
    });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');
    expect(container.querySelector('[data-pane-tty="tty2"]')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'W', code: 'KeyW', altKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');

    fireEvent.keyDown(window, { key: 'N', code: 'KeyN', altKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('2');
    fireEvent.keyDown(window, { key: 'W', code: 'KeyW', altKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('1');
  });

  it('contains unexpected route errors cleanly in exported ErrorBoundary', async () => {
    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        Component: () => {
          throw new Error('Internal crash at /srv/secret/file.ts:42');
        },
        ErrorBoundary,
      },
    ]);

    render(<Stub initialEntries={['/']} />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('ERR_INTERNAL');
    expect(alert.textContent).not.toContain('/srv/secret/file.ts');
  });

  it('detects initialViewport synchronously from Sec-CH-UA-Mobile and User-Agent headers', () => {
    loadPortalRootDataWithPrerenderMock.mockReturnValue(
      Promise.resolve({
        maintenanceMode: false,
        chrome: CHROME_FIXTURE,
        maintenance: null,
      }),
    );

    const mobileResult = loader(
      makeRootLoaderArgs('https://andrew-k.us/', { 'Sec-CH-UA-Mobile': '?1' }),
    );
    expect(mobileResult.initialViewport).toBe('mobile-portrait');

    const desktopResult = loader(
      makeRootLoaderArgs('https://andrew-k.us/', { 'Sec-CH-UA-Mobile': '?0' }),
    );
    expect(desktopResult.initialViewport).toBe('desktop');
  });

  it('resets PortalMobileWorkspaceHost in-pane TUI stack on dock route navigation and exitTui', async () => {
    function StackTriggerHome() {
      const paneNav = usePaneNavigation();
      return (
        <div>
          <span>Mobile Home Content</span>
          <button type='button' onClick={() => paneNav?.push('tui')}>
            Open Stacked TUI
          </button>
        </div>
      );
    }

    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: () => ({
          runtimeSeo: { siteUrl: 'https://andrew-k.us' },
          correlationId: 'corr-mobile-stack',
          initialViewport: 'mobile-portrait' as const,
          maintenanceMode: false,
          rootPayload: Promise.resolve<StreamResult<PortalRootLoaderData>>({
            ok: true,
            data: {
              maintenanceMode: false,
              chrome: CHROME_FIXTURE,
              maintenance: null,
              homeContent: {
                tuiTitle: 'Solar Forge Launcher',
                tuiBadge: { source: 'portal', state: 'ready', label: 'READY' },
                heading: 'Welcome Launcher',
                description: 'Pick a view',
                actions: [],
              },
            },
          }),
        }),
        Component: PortalRoot,
        ErrorBoundary,
        children: [
          { index: true, Component: StackTriggerHome },
          { path: 'menu', Component: () => <div>Menu Route Content</div> },
        ],
      },
    ]);

    render(
      <ViewportProvider mode='mobile-portrait'>
        <Stub initialEntries={['/']} />
      </ViewportProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Open Stacked TUI' }));
    expect(await screen.findByText('Welcome Launcher')).toBeTruthy();

    // Activating Back button in sticky TUI header pops stack and restores home content
    fireEvent.click(screen.getByRole('button', { name: 'Back to previous pane' }));
    expect(await screen.findByText('Mobile Home Content')).toBeTruthy();

    // Re-push stack, then navigate via bottom dock link -> resets stack and shows /menu
    fireEvent.click(screen.getByRole('button', { name: 'Open Stacked TUI' }));
    expect(await screen.findByText('Welcome Launcher')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Menu' }));
    expect(await screen.findByText('Menu Route Content')).toBeTruthy();
  });
});
