import {
  CONTACT_FORM_DEFINITION,
  type ContactActionResult,
  type PortalAgensiLoaderData,
  type PortalContactLoaderData,
  type PortalHomeContent,
  type PortalHomeLoaderData,
  type PortalMenuLoaderData,
  type PortalRootLoaderData,
  type StreamResult,
  type TerminalProfileData,
} from '@aklapper/core';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  createMemoryRouter,
  type LoaderFunctionArgs,
  RouterProvider,
  useLoaderData,
  useMatches,
  useParams,
} from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { initPortalClientTelemetry, resetPortalClientTelemetryForTest } from './client-telemetry';
import { type PaneLoaderErrorEnvelope, type StreamLoaderEnvelope } from './pane-loader';
import { runPaneSafeLoader } from './pane-loader.server';
import { renderPortalPaneView } from './portalPaneViews';
import PortalRoot, { type PortalRootStreamData } from './root';
import PortalAgensiRoute from './routes/agensi';
import PortalGreeterRoute from './routes/home';
import PortalMenuRoute from './routes/menu';

function streamOk<T>(data: T, correlationId = 'corr-pane-test'): StreamLoaderEnvelope<T> {
  return {
    correlationId,
    payload: Promise.resolve<StreamResult<T>>({ ok: true, data }),
  };
}

function makeRootStreamData(data: PortalRootLoaderData): PortalRootStreamData {
  return {
    runtimeSeo: { siteUrl: 'https://andrew-k.us' },
    correlationId: 'corr-root-pane',
    maintenanceMode: data.maintenanceMode,
    rootPayload: Promise.resolve<StreamResult<PortalRootLoaderData>>({ ok: true, data }),
  };
}

function PortalRootBridge() {
  const loaderData = useLoaderData<PortalRootStreamData>();
  const params = useParams();
  const matches = useMatches();
  return (
    <PortalRoot
      loaderData={loaderData}
      params={params}
      matches={matches as never}
      actionData={undefined}
    />
  );
}

function PortalHomeBridge() {
  const loaderData = useLoaderData<StreamLoaderEnvelope<PortalHomeLoaderData>>();
  const params = useParams();
  const matches = useMatches();
  return (
    <PortalGreeterRoute
      loaderData={loaderData}
      params={params}
      matches={matches as never}
      actionData={undefined}
    />
  );
}

function PortalAgensiBridge() {
  const loaderData = useLoaderData<StreamLoaderEnvelope<PortalAgensiLoaderData>>();
  const params = useParams();
  const matches = useMatches();
  return (
    <PortalAgensiRoute
      loaderData={loaderData}
      params={params}
      matches={matches as never}
      actionData={undefined}
    />
  );
}

function PortalMenuBridge() {
  const loaderData = useLoaderData<StreamLoaderEnvelope<PortalMenuLoaderData>>();
  const params = useParams();
  const matches = useMatches();
  return (
    <PortalMenuRoute
      loaderData={loaderData}
      params={params}
      matches={matches as never}
      actionData={undefined}
    />
  );
}

const CHROME: PortalRootLoaderData['chrome'] = {
  pageTitle: 'andrew-k.us // Solar Forge Terminal',
  brandLabel: 'andrew-k.us',
  shortcutHint: 'Alt+T tui',
  statusBadge: { source: 'gke-autopilot', state: 'idle', label: '0 pods' },
  footerText: 'Solar Forge',
  footerLinkLabel: 'agensi.io',
  footerLinkUrl: 'https://agensi.io',
  maintenanceModeDefault: false,
};

const HOME_CONTENT: PortalHomeContent = {
  tuiTitle: 'tui :: launcher',
  tuiBadge: { source: 'portal', state: 'ready', label: 'READY' },
  heading: 'Portal Launcher',
  description: 'Choose a module.',
  actions: [
    { label: 'Launch Menu', to: '/menu', variant: 'primary' },
    { label: 'Contact', to: '/contact', variant: 'default' },
  ],
};

const TERMINAL: TerminalProfileData = {
  slug: 'portal-home',
  bannerTitle: 'Solar Forge Terminal // tty1',
  bannerMeta: 'tty1',
  osLabel: '⚡',
  directory: '~/andrew-k.us',
  vcsBranch: 'portfolio_v2',
  vcsState: 'clean',
  contextLabel: 'guest@andrew-k.us',
  placeholder: 'type a command',
  quickCommands: ['tui'],
  initialEntries: [],
  commands: [
    {
      name: 'tui',
      description: 'open tui',
      kind: 'tui',
      output: 'opening TUI launcher ...',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 1,
    },
    {
      name: 'contact',
      description: 'open contact',
      kind: 'navigate',
      output: 'opening /contact ...',
      targetRoute: '/contact',
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 2,
    },
    {
      name: 'agensi',
      description: 'open agensi',
      kind: 'navigate',
      output: 'opening /agensi ...',
      targetRoute: '/agensi',
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 3,
    },
  ],
};

const CONTACT_DATA: PortalContactLoaderData = {
  content: {
    windowTitle: 'tui :: contact',
    statusBadge: { source: 'contact', state: 'idle', label: 'ready' },
    description: 'Send a transmission.',
    form: CONTACT_FORM_DEFINITION,
  },
};

const AGENSI_DATA: PortalAgensiLoaderData = {
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

const MENU_DATA: PortalMenuLoaderData = {
  content: {
    heading: 'Launch Menu',
    description: 'Select a module.',
    localTargetLabel: 'local',
  },
  items: [
    {
      slug: 'agensi',
      title: 'Agensi',
      description: 'AI storefront',
      keyShortcut: '1',
      targetK8sDeploy: null,
      adminOnly: false,
      namespace: 'portfolio-public',
      sortOrder: 1,
      enabled: true,
    },
  ],
};

describe('Portal in-pane route adapters & deep-links', () => {
  it('submits in-pane /contact form explicitly to /contact while keeping URL at /', async () => {
    const contactActionSpy = vi.fn<() => Promise<ContactActionResult>>(async () => ({
      ok: true,
      submission: {
        id: 'rcpt-101',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        phone: null,
        attachmentName: null,
        attachmentSizeBytes: null,
        attachmentSha256: null,
        createdAt: '2026-11-24T19:00:00Z',
      },
    }));

    const router = createMemoryRouter(
      [
        {
          id: 'root',
          path: '/',
          loader: () =>
            makeRootStreamData({
              maintenanceMode: false,
              chrome: CHROME,
              maintenance: null,
              terminal: TERMINAL,
              homeContent: HOME_CONTENT,
            }),
          Component: PortalRootBridge,
          children: [
            {
              index: true,
              loader: () =>
                streamOk<PortalHomeLoaderData>({
                  content: HOME_CONTENT,
                  terminal: TERMINAL,
                  contactForm: CONTACT_FORM_DEFINITION,
                }),
              Component: PortalHomeBridge,
            },
            {
              path: 'menu',
              loader: () => streamOk(MENU_DATA),
              Component: () => <div>Menu SSR</div>,
            },
            {
              path: 'contact',
              loader: () => streamOk(CONTACT_DATA),
              action: contactActionSpy,
              Component: () => <div>Contact SSR</div>,
            },
          ],
        },
      ],
      { initialEntries: ['/'] },
    );

    render(<RouterProvider router={router} />);

    const input = (await screen.findByLabelText('Terminal command input')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'tui' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    // Click Contact in docked launcher -> loads /contact in-pane via useFetcher
    fireEvent.click(await screen.findByRole('link', { name: 'Contact' }));
    const nameInput = await screen.findByLabelText(/Name/i);
    const emailInput = screen.getByLabelText(/Email/i);
    const messageInput = screen.getByRole('textbox', { name: /Message/i });

    fireEvent.change(nameInput, { target: { value: 'Ada Lovelace' } });
    fireEvent.change(emailInput, { target: { value: 'ada@example.com' } });
    fireEvent.change(messageInput, { target: { value: 'Hello from an in-pane contact test!' } });

    const submitButton = screen.getByRole('button', { name: /Transmit|Send|Submit/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(contactActionSpy).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByTestId('contact-receipt')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
  });

  it('seeds pane-1 on direct /agensi deep-link and returns to / on Exit TUI', async () => {
    const router = createMemoryRouter(
      [
        {
          id: 'root',
          path: '/',
          loader: () =>
            makeRootStreamData({
              maintenanceMode: false,
              chrome: CHROME,
              maintenance: null,
              terminal: TERMINAL,
              homeContent: HOME_CONTENT,
            }),
          Component: PortalRootBridge,
          children: [
            {
              index: true,
              loader: () =>
                streamOk<PortalHomeLoaderData>({
                  content: HOME_CONTENT,
                  terminal: TERMINAL,
                  contactForm: CONTACT_FORM_DEFINITION,
                }),
              Component: PortalHomeBridge,
            },
            {
              path: 'agensi',
              loader: () => streamOk(AGENSI_DATA),
              Component: PortalAgensiBridge,
            },
          ],
        },
      ],
      { initialEntries: ['/agensi'] },
    );

    render(<RouterProvider router={router} />);

    expect(await screen.findByText('Commercial AI skills.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Exit TUI' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });

  it('isolates thrown HTTP 500 Response and Error in in-pane loader without crashing PortalRoot and recovers on Retry', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let attempt = 0;

    const router = createMemoryRouter(
      [
        {
          id: 'root',
          path: '/',
          loader: () =>
            makeRootStreamData({
              maintenanceMode: false,
              chrome: CHROME,
              maintenance: null,
              terminal: TERMINAL,
              homeContent: HOME_CONTENT,
            }),
          Component: PortalRootBridge,
          children: [
            {
              index: true,
              loader: () =>
                streamOk<PortalHomeLoaderData>({
                  content: HOME_CONTENT,
                  terminal: TERMINAL,
                  contactForm: CONTACT_FORM_DEFINITION,
                }),
              Component: PortalHomeBridge,
            },
            {
              path: 'agensi',
              loader: ({ request }: LoaderFunctionArgs) =>
                runPaneSafeLoader<PortalAgensiLoaderData>(request, async () => {
                  attempt += 1;
                  if (attempt === 1) {
                    throw new Response('upstream unavailable', { status: 500 });
                  }
                  if (attempt === 2) {
                    throw new Error('Failed query: select * from secret_table where token = $1');
                  }
                  return AGENSI_DATA;
                }),
              Component: PortalAgensiBridge,
            },
          ],
        },
      ],
      { initialEntries: ['/'] },
    );

    const { container } = render(<RouterProvider router={router} />);

    const input = (await screen.findByLabelText('Terminal command input')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'agensi' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    // Attempt 1 (thrown HTTP 500 Response): PortalRoot + TerminalWorkspace remain mounted
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(container.querySelector('[data-pane-count="1"]')).toBeTruthy();
    expect(
      errorSpy.mock.calls.some(args =>
        String(args[0]).includes('portal.pane_nav.fetcher_load_failed'),
      ),
    ).toBe(true);

    // Attempt 2 (thrown SQL Error): isolated inside pane without leaking SQL internals over the wire
    errorSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => {
      expect(attempt).toBe(2);
    });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toContain('secret_table');
    expect(alert.textContent).not.toContain('select *');
    const clientFetcherErrorLogs = errorSpy.mock.calls
      .map(args => String(args[0]))
      .filter(msg => msg.includes('portal.pane_nav.fetcher_load_failed'));
    expect(clientFetcherErrorLogs.length).toBeGreaterThan(0);
    for (const msg of clientFetcherErrorLogs) {
      expect(msg).not.toContain('secret_table');
      expect(msg).not.toContain('select *');
    }
    expect(container.querySelector('[data-pane-count="1"]')).toBeTruthy();

    // Attempt 3: recovers cleanly
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Commercial AI skills.')).toBeTruthy();
    errorSpy.mockRestore();
  });

  it('handles browser Back/Forward re-entry from / to /agensi and /menu -> /agensi -> Back without deadlocks or stale overlays', async () => {
    const router = createMemoryRouter(
      [
        {
          id: 'root',
          path: '/',
          loader: () =>
            makeRootStreamData({
              maintenanceMode: false,
              chrome: CHROME,
              maintenance: null,
              terminal: TERMINAL,
              homeContent: HOME_CONTENT,
            }),
          Component: PortalRootBridge,
          children: [
            {
              index: true,
              loader: () =>
                streamOk<PortalHomeLoaderData>({
                  content: HOME_CONTENT,
                  terminal: TERMINAL,
                  contactForm: CONTACT_FORM_DEFINITION,
                }),
              Component: PortalHomeBridge,
            },
            {
              path: 'agensi',
              loader: () => streamOk(AGENSI_DATA),
              Component: PortalAgensiBridge,
            },
            {
              path: 'menu',
              loader: () => streamOk(MENU_DATA),
              Component: PortalMenuBridge,
            },
          ],
        },
      ],
      { initialEntries: ['/agensi'] },
    );

    const { container } = render(<RouterProvider router={router} />);

    // Deep-link /agensi -> Exit TUI -> / -> Browser Back to /agensi -> Escape returns cleanly to /
    expect(await screen.findByText('Commercial AI skills.')).toBeTruthy();
    const pane1 = container.querySelector('[data-pane-id="pane-1"]') as HTMLElement;
    expect(pane1.getAttribute('data-tui-depth')).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: 'Exit TUI' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
      expect(pane1.getAttribute('data-tui-depth')).toBe('0');
    });

    await act(async () => {
      await router.navigate(-1);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/agensi');
      expect(pane1.getAttribute('data-tui-depth')).toBe('1');
    });

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
      expect(pane1.getAttribute('data-tui-depth')).toBe('0');
    });

    // Deep-link route switch: /menu -> /agensi -> Browser Back to /menu (no stale Agensi overlay)
    await act(async () => {
      await router.navigate('/menu');
    });
    expect(await screen.findByRole('heading', { name: 'Launch Menu' })).toBeTruthy();
    await waitFor(() => {
      expect(pane1.getAttribute('data-tui-depth')).toBe('1');
    });

    await act(async () => {
      await router.navigate('/agensi');
    });
    expect(await screen.findByText('Commercial AI skills.')).toBeTruthy();

    await act(async () => {
      await router.navigate(-1);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/menu');
      expect(pane1.getAttribute('data-tui-depth')).toBe('1');
    });
    const shellLayer = pane1.querySelector('[data-shell-layer="true"]') as HTMLElement;
    expect(shellLayer.hidden).toBe(false);
    expect(screen.getByRole('heading', { name: 'Launch Menu' })).toBeTruthy();
    expect(screen.queryByText('Commercial AI skills.')).toBeNull();
  });

  it('emits portal.pane_nav.unknown_view_id once per unregistered view and exits cleanly', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const exitTui = vi.fn<() => void>();
    const ctx = {
      paneId: 'pane-9',
      ttyNumber: 9,
      isSinglePane: true,
      isActive: true,
      isInitialPrimaryDeepLink: false,
      stack: ['/missing-view'],
      viewId: '/missing-view',
      push: vi.fn<(viewId: string) => void>(),
      pop: vi.fn<() => void>(),
      exitTui,
      openInSplit: vi.fn<(viewId: string) => void>(),
      openInTab: vi.fn<(viewId: string) => void>(),
    };

    const { rerender } = render(<>{renderPortalPaneView({ ctx })}</>);
    expect(screen.getByText('Unregistered view: /missing-view')).toBeTruthy();
    rerender(<>{renderPortalPaneView({ ctx })}</>);

    const unknownLogs = warnSpy.mock.calls
      .map(args => String(args[0] ?? ''))
      .filter(msg => msg.includes('portal.pane_nav.unknown_view_id'));
    expect(unknownLogs).toHaveLength(1);
    expect(JSON.parse(unknownLogs[0]!)).toEqual({
      event: 'portal.pane_nav.unknown_view_id',
      viewId: '/missing-view',
      paneId: 'pane-9',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Return to Terminal' }));
    expect(exitTui).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('emits portal.pane_nav.fetcher_load_failed and client telemetry on PaneStatusFallback error envelope and recovers on Retry', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const track = vi.fn<() => void>();
    const flush = vi.fn<() => void>();
    initPortalClientTelemetry({
      enabled: true,
      sessionId: 'pane-test-session',
      track,
      startWebVitals: vi.fn<() => void>(),
      flush,
    });

    let attempt = 0;
    const router = createMemoryRouter(
      [
        {
          id: 'root',
          path: '/',
          loader: () =>
            makeRootStreamData({
              maintenanceMode: false,
              chrome: CHROME,
              maintenance: null,
              terminal: TERMINAL,
              homeContent: HOME_CONTENT,
            }),
          Component: PortalRootBridge,
          children: [
            {
              index: true,
              loader: () =>
                streamOk<PortalHomeLoaderData>({
                  content: HOME_CONTENT,
                  terminal: TERMINAL,
                  contactForm: CONTACT_FORM_DEFINITION,
                }),
              Component: PortalHomeBridge,
            },
            {
              path: 'agensi',
              loader: () => {
                attempt += 1;
                if (attempt === 1) {
                  const errEnv: PaneLoaderErrorEnvelope = {
                    __paneLoaderError: true,
                    message: 'secret_sql_should_never_leak',
                  };
                  return errEnv;
                }
                return streamOk(AGENSI_DATA);
              },
              Component: PortalAgensiBridge,
            },
          ],
        },
      ],
      { initialEntries: ['/'] },
    );

    render(<RouterProvider router={router} />);
    const input = (await screen.findByLabelText('Terminal command input')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'agensi' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(
      await screen.findByText(/Unable to load Agensi Storefront\. Check your connection/i),
    ).toBeTruthy();
    const failedLogs = errorSpy.mock.calls
      .map(args => String(args[0] ?? ''))
      .filter(msg => msg.includes('portal.pane_nav.fetcher_load_failed'));
    expect(failedLogs).toHaveLength(1);
    expect(failedLogs[0]).not.toContain('secret_sql_should_never_leak');
    expect(track).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Commercial AI skills.')).toBeTruthy();

    resetPortalClientTelemetryForTest();
    errorSpy.mockRestore();
  });

  it('forwards catalogMeta parity cleanly across direct /agensi SSR and in-pane /agensi?pane=1', async () => {
    const fallbackPayload: PortalAgensiLoaderData = {
      ...AGENSI_DATA,
      content: {
        ...AGENSI_DATA.content,
        statusBadge: {
          source: 'agensi-catalog',
          state: 'idle',
          label: 'catalog · cached fallback',
        },
      },
      skills: [
        {
          slug: 'cadence-governed-agentic-sdlc-framework',
          name: 'CADENCE: Governed Agentic SDLC Framework',
          summary: 'Governed SDLC framework.',
          tags: ['sdlc'],
          url: 'https://agensi.io/skills/cadence-governed-agentic-sdlc-framework',
          sortOrder: 1,
          creatorHandle: 'aklapper',
          isPublished: true,
          source: 'agensi_api',
        },
      ],
      catalogMeta: {
        mode: 'cached_fallback',
        creatorHandle: 'aklapper',
        syncedAt: '2026-11-24T12:00:00.000Z',
      },
    };

    const router = createMemoryRouter(
      [
        {
          id: 'root',
          path: '/',
          loader: () =>
            makeRootStreamData({
              maintenanceMode: false,
              chrome: CHROME,
              maintenance: null,
              terminal: TERMINAL,
              homeContent: HOME_CONTENT,
            }),
          Component: PortalRootBridge,
          children: [
            {
              index: true,
              loader: () =>
                streamOk<PortalHomeLoaderData>({
                  content: HOME_CONTENT,
                  terminal: TERMINAL,
                  contactForm: CONTACT_FORM_DEFINITION,
                }),
              Component: PortalHomeBridge,
            },
            {
              path: 'agensi',
              loader: () => streamOk(fallbackPayload),
              Component: PortalAgensiBridge,
            },
          ],
        },
      ],
      { initialEntries: ['/'] },
    );

    render(<RouterProvider router={router} />);
    const input = (await screen.findByLabelText('Terminal command input')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'agensi' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    const paneMeta = await screen.findByTestId('agensi-catalog-meta');
    expect(paneMeta.textContent).toContain('aklapper');
    expect(paneMeta.textContent).toContain('cached fallback');
    expect(screen.getByText(/catalog · cached fallback/)).toBeTruthy();

    await act(async () => {
      await router.navigate('/agensi');
    });
    expect(await screen.findByTestId('agensi-catalog-meta')).toBeTruthy();
  });
});
