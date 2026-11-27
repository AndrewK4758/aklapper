import {
  type AskServiceStatus,
  type CadenceRunResult,
  CONTACT_FORM_DEFINITION,
  type ContactActionResult,
  type PortalAboutLoaderData,
  type PortalAgensiLoaderData,
  PortalAskContentSchema,
  type PortalAskLoaderData,
  PortalCadenceContentSchema,
  type PortalCadenceLoaderData,
  type PortalContactLoaderData,
  type PortalHomeContent,
  PortalHomeContentSchema,
  type PortalHomeLoaderData,
  type PortalRootLoaderData,
  type StreamResult,
  type TerminalProfileData,
} from '@aklapper/core';
import { getPrerenderPortalAboutData } from '@aklapper/core/prerender';
import { usePaneNavigation, ViewportProvider } from '@aklapper/ui';
import { act, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  createMemoryRouter,
  type LoaderFunctionArgs,
  RouterProvider,
  useLoaderData,
  useMatches,
  useParams,
} from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PortalCadenceActionResult } from '#pages/cadence';

import { readPersistedAskTurn } from '../pages/ask/askTurnRecovery';
import { resetCadenceAutoAttachRegistryForTest } from './cadence-stream';
import { initPortalClientTelemetry, resetPortalClientTelemetryForTest } from './client-telemetry';
import { type StreamLoaderEnvelope } from './pane-loader';
import { runPaneSafeLoader } from './pane-loader.server';
import { renderPortalPaneView } from './portalPaneViews';
import PortalRoot, { type PortalRootStreamData } from './root';
import PortalAboutRoute from './routes/about';
import PortalAgensiRoute from './routes/agensi';
import PortalCadenceRoute from './routes/cadence';
import PortalGreeterRoute from './routes/home';
import { portalPaneStreamStore } from './workspace/portalPaneStreamStore';
import {
  buildTypedPaneActionError,
  createTransportPublicError,
  type PaneLoadedEnvelope,
  type PaneStreamTransport,
} from './workspace/portalPaneTransport';
import type { PortalPaneRoute } from './workspace/portalWorkspaceSnapshot';
import { portalWorkspaceStore } from './workspace/portalWorkspaceStore';

function installTestPaneTransport(config: {
  readonly loaders?: Partial<
    Record<PortalPaneRoute, (request: Request, signal: AbortSignal) => unknown | Promise<unknown>>
  >;
  readonly actions?: Partial<
    Record<
      PortalPaneRoute,
      (request: Request, formData: FormData, signal?: AbortSignal) => unknown | Promise<unknown>
    >
  >;
}): void {
  const transport: PaneStreamTransport = {
    load: async <T = unknown,>(routePath: PortalPaneRoute, signal: AbortSignal) => {
      const loaderFn = config.loaders?.[routePath];
      if (!loaderFn) {
        throw new Error(`No test pane loader registered for ${routePath}`);
      }
      const request = new Request(`http://localhost${routePath}?pane=1`, { signal });
      const raw = await loaderFn(request, signal);
      if (raw && typeof raw === 'object' && 'correlationId' in raw && 'payload' in raw) {
        return raw as PaneLoadedEnvelope<T>;
      }
      const publicError = createTransportPublicError({
        error: new Error('Malformed test pane envelope'),
        status: 503,
      });
      return {
        correlationId: publicError.correlationId,
        payload: Promise.resolve<StreamResult<T>>({ ok: false, error: publicError }),
      };
    },
    submitAction: async <T = unknown,>(
      routePath: PortalPaneRoute,
      formData: FormData,
      signal?: AbortSignal,
    ) => {
      const actionFn = config.actions?.[routePath];
      if (!actionFn) {
        const publicError = createTransportPublicError({ status: 503 });
        return buildTypedPaneActionError(routePath, formData, publicError) as T;
      }
      try {
        const request = new Request(`http://localhost${routePath}`, {
          method: 'POST',
          body: formData,
          signal,
        });
        return (await actionFn(request, formData, signal)) as T;
      } catch (error) {
        const publicError = createTransportPublicError({ error });
        return buildTypedPaneActionError(routePath, formData, publicError) as T;
      }
    },
  };
  portalPaneStreamStore.setTransportForTest(transport);
}

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
    initialViewport: 'desktop',
    isNotFound: false,
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

function PortalAboutBridge() {
  const loaderData = useLoaderData<StreamLoaderEnvelope<PortalAboutLoaderData>>();
  const params = useParams();
  const matches = useMatches();
  return (
    <PortalAboutRoute
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

function PortalCadenceBridge() {
  const loaderData = useLoaderData<StreamLoaderEnvelope<PortalCadenceLoaderData>>();
  const params = useParams();
  const matches = useMatches();
  return (
    <PortalCadenceRoute
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
};

const HOME_CONTENT: PortalHomeContent = PortalHomeContentSchema.parse({
  tuiTitle: 'tui :: launcher',
  tuiBadge: { source: 'portal', state: 'ready', label: 'READY' },
  heading: 'Portal Launcher',
  description: 'Choose a module.',
  actions: [
    { label: 'Launch Menu', to: '/menu', variant: 'primary' },
    { label: 'Contact', to: '/contact', variant: 'default' },
  ],
});

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
    {
      name: 'cadence',
      description: 'open cadence builder',
      kind: 'navigate',
      output: 'opening /cadence ...',
      targetRoute: '/cadence',
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 4,
    },
    {
      name: 'chat',
      description: 'open chat with Andrew',
      kind: 'navigate',
      output: 'opening /chat ...',
      targetRoute: '/chat',
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 5,
    },
    {
      name: 'about',
      description: 'open about resume & services guide',
      kind: 'navigate',
      output: 'opening /about ...',
      targetRoute: '/about',
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 6,
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

describe('Portal in-pane route adapters & deep-links', () => {
  beforeAll(() => {
    configure({ asyncUtilTimeout: 5_000 });
  });

  afterAll(() => {
    configure({ asyncUtilTimeout: 1_000 });
  });

  beforeEach(() => {
    portalWorkspaceStore.resetForTest();
    portalPaneStreamStore.resetForTest();
    resetCadenceAutoAttachRegistryForTest();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    portalWorkspaceStore.resetForTest();
    portalPaneStreamStore.resetForTest();
    resetCadenceAutoAttachRegistryForTest();
    window.sessionStorage.clear();
  });
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

    installTestPaneTransport({
      loaders: {
        '/contact': () => streamOk(CONTACT_DATA),
      },
      actions: {
        '/contact': () => contactActionSpy(),
      },
    });

    const router = createMemoryRouter(
      [
        {
          id: 'root',
          path: '/',
          loader: () =>
            makeRootStreamData({
              chrome: CHROME,
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

    const { container } = render(<RouterProvider router={router} />);

    const input = (await screen.findByLabelText('Terminal command input')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'tui' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    // Shift+Click Contact in docked launcher -> opens /contact in a secondary split while keeping URL at /
    const pane1 = container.querySelector('[data-pane-id="pane-1"]') as HTMLElement;
    fireEvent.click(await within(pane1).findByRole('link', { name: 'Contact' }), {
      shiftKey: true,
    });
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
              chrome: CHROME,
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

    const loadAgensiSafe = (request: Request) =>
      runPaneSafeLoader<PortalAgensiLoaderData>(request, async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new Response('upstream unavailable', { status: 500 });
        }
        if (attempt === 2) {
          throw new Error('Failed query: select * from secret_table where token = $1');
        }
        return AGENSI_DATA;
      });

    installTestPaneTransport({
      loaders: {
        '/agensi': request => loadAgensiSafe(request),
      },
    });

    const router = createMemoryRouter(
      [
        {
          id: 'root',
          path: '/',
          loader: () =>
            makeRootStreamData({
              chrome: CHROME,
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
              loader: ({ request }: LoaderFunctionArgs) => loadAgensiSafe(request),
              Component: PortalAgensiBridge,
            },
          ],
        },
      ],
      { initialEntries: ['/'] },
    );

    const { container } = render(<RouterProvider router={router} />);

    const input = (await screen.findByLabelText('Terminal command input')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'agensi --split' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    // Attempt 1 (thrown HTTP 500 Response): PortalRoot + TerminalWorkspace remain mounted
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(container.querySelector('[data-pane-count="2"]')).toBeTruthy();
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
    expect(container.querySelector('[data-pane-count="2"]')).toBeTruthy();

    // Attempt 3: recovers cleanly
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Commercial AI skills.')).toBeTruthy();
    errorSpy.mockRestore();
  });

  it('handles browser Back/Forward re-entry from / to /agensi and /cadence -> /agensi -> Back without deadlocks or stale overlays', async () => {
    const CADENCE_DATA: PortalCadenceLoaderData = {
      content: PortalCadenceContentSchema.parse({
        windowTitle: 'CADENCE Builder',
        statusBadge: { source: 'cadence', state: 'idle', label: 'Idle' },
        description: 'Interactive sandbox builder.',
        iframeTitle: 'CADENCE Preview',
      }),
      presets: [],
    };
    const router = createMemoryRouter(
      [
        {
          id: 'root',
          path: '/',
          loader: () =>
            makeRootStreamData({
              chrome: CHROME,
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
              path: 'cadence',
              loader: () => streamOk(CADENCE_DATA),
              Component: PortalCadenceBridge,
            },
          ],
        },
      ],
      { initialEntries: ['/agensi'] },
    );

    const { container } = render(<RouterProvider router={router} />);

    const getActivePane1 = () => container.querySelector('[data-pane-id="pane-1"]') as HTMLElement;

    // Deep-link /agensi -> Exit TUI -> / -> Browser Back to /agensi -> Escape returns cleanly to /
    expect(await screen.findByText('Commercial AI skills.')).toBeTruthy();
    expect(getActivePane1().getAttribute('data-tui-depth')).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: 'Exit TUI' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
      expect(getActivePane1().getAttribute('data-tui-depth')).toBe('0');
    });

    await act(async () => {
      await router.navigate(-1);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/agensi');
      expect(getActivePane1().getAttribute('data-tui-depth')).toBe('1');
    });

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
      expect(getActivePane1().getAttribute('data-tui-depth')).toBe('0');
    });

    // Deep-link route switch: /cadence -> /agensi -> Browser Back to /cadence (no stale Agensi overlay)
    await act(async () => {
      await router.navigate('/cadence');
    });
    expect(await screen.findByText('Interactive sandbox builder.')).toBeTruthy();
    await waitFor(() => {
      expect(getActivePane1().getAttribute('data-tui-depth')).toBe('1');
    });

    await act(async () => {
      await router.navigate('/agensi');
    });
    expect(await screen.findByText('Commercial AI skills.')).toBeTruthy();

    await act(async () => {
      await router.navigate(-1);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/cadence');
      expect(getActivePane1().getAttribute('data-tui-depth')).toBe('1');
    });
    const activeCadencePane1 = getActivePane1();
    const shellLayer = activeCadencePane1.querySelector('[data-shell-layer="true"]') as HTMLElement;
    expect(shellLayer.hidden).toBe(false);
    expect(screen.getByText('Interactive sandbox builder.')).toBeTruthy();
    expect(activeCadencePane1.textContent).not.toContain('Commercial AI skills.');
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

  it('emits portal.pane_nav.fetcher_load_failed and client telemetry on malformed pane envelope and recovers on Retry', async () => {
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
    installTestPaneTransport({
      loaders: {
        '/agensi': () => {
          attempt += 1;
          if (attempt === 1) {
            return {
              malformed: true,
              secret: 'secret_sql_should_never_leak',
            };
          }
          return streamOk(AGENSI_DATA);
        },
      },
    });

    const router = createMemoryRouter(
      [
        {
          id: 'root',
          path: '/',
          loader: () =>
            makeRootStreamData({
              chrome: CHROME,
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
      { initialEntries: ['/'] },
    );

    render(<RouterProvider router={router} />);
    const input = (await screen.findByLabelText('Terminal command input')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'agensi --split' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('ERR_UPSTREAM_UNAVAILABLE');
    expect(alert.textContent).not.toContain('secret_sql_should_never_leak');
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

    installTestPaneTransport({
      loaders: {
        '/agensi': () => streamOk(fallbackPayload),
      },
    });

    const router = createMemoryRouter(
      [
        {
          id: 'root',
          path: '/',
          loader: () =>
            makeRootStreamData({
              chrome: CHROME,
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

    const { container } = render(<RouterProvider router={router} />);
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
    await waitFor(() => {
      expect(container.querySelectorAll('[data-route-workspace]')).toHaveLength(0);
      const primaryPane = container.querySelector('[data-pane-id="pane-1"]');
      expect(primaryPane?.querySelector('[data-testid="agensi-catalog-meta"]')).toBeTruthy();
    });
  });

  it('runs docked /cadence with Select Escape guard, live EventSource streaming, and gate approval without changing URL', async () => {
    const cadenceData: PortalCadenceLoaderData = {
      content: PortalCadenceContentSchema.parse({
        windowTitle: 'CADENCE Builder // portfolio-public',
        statusBadge: { source: 'svc-cadence-demo', state: 'idle', label: '0/1 replicas' },
        description: 'Build interactive artifacts inside pane.',
        iframeTitle: 'CADENCE Artifact Preview',
      }),
      presets: [
        {
          slug: 'solar-forge-starter',
          title: 'Solar Forge Starter',
          starterPrompt: 'Build a Solar Forge card.',
          expectedKind: 'diagnostic-card',
          starterArtifactHtml: '<html><body>Pane Starter HTML</body></html>',
          sortOrder: 1,
        },
        {
          slug: 'chord-pipeline-monitor',
          title: 'CHORD Pipeline Monitor',
          starterPrompt: 'Track CHORD pipeline turn latency.',
          expectedKind: 'pipeline-monitor',
          starterArtifactHtml: '<html><body>Pipeline Starter</body></html>',
          sortOrder: 2,
        },
      ],
      quota: { role: 'guest', turnsUsed: 0, maxTurns: 5, tokensUsed: 0, maxTokens: 20_000 },
      recentRuns: [],
    };

    const runId = '22222222-2222-4222-8222-222222222222';
    const pendingRun: CadenceRunResult = {
      runId,
      prompt: 'Track CHORD pipeline turn latency.',
      presetSlug: 'chord-pipeline-monitor',
      runStatus: 'pending',
      mode: 'fast',
      gateVerdict: 'pending',
      turns: [
        {
          phase: 'triage',
          agentName: 'chord-triage',
          status: 'pending',
          summary: 'Queued',
          latencyMs: 0,
        },
        {
          phase: 'spec',
          agentName: 'chord-spec',
          status: 'pending',
          summary: 'Queued',
          latencyMs: 0,
        },
        {
          phase: 'build',
          agentName: 'chord-builder',
          status: 'pending',
          summary: 'Queued',
          latencyMs: 0,
        },
        {
          phase: 'gate',
          agentName: 'chord-gate',
          status: 'pending',
          summary: 'Queued',
          latencyMs: 0,
        },
      ],
      artifactHtml: '',
    };

    const listeners = new Map<string, Array<(ev: Event) => void>>();
    const originalEventSource = globalThis.EventSource;
    class MockEventSource {
      addEventListener(type: string, cb: (ev: Event) => void) {
        const list = listeners.get(type) ?? [];
        list.push(cb);
        listeners.set(type, list);
      }
      close() {
        /* noop */
      }
      onerror: ((ev: Event) => void) | null = null;
    }
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;

    const cadenceActionSpy = vi.fn<
      ({ request }: { request: Request }) => Promise<PortalCadenceActionResult>
    >(async ({ request }) => {
      const fd = await request.formData();
      const intent = String(fd.get('intent') ?? 'run');
      if (intent === 'gate') {
        return {
          ok: true,
          intent: 'gate',
          run: {
            ...pendingRun,
            runStatus: 'ready',
            gateVerdict: 'approved',
            artifactHtml: '<html><body>Pane Tailored Result</body></html>',
          },
        };
      }
      return {
        ok: true,
        intent: 'run-init',
        run: pendingRun,
        quota: { role: 'guest', turnsUsed: 1, maxTurns: 5, tokensUsed: 800, maxTokens: 20_000 },
      };
    });

    installTestPaneTransport({
      loaders: {
        '/cadence': () => streamOk(cadenceData),
      },
      actions: {
        '/cadence': request => cadenceActionSpy({ request }),
      },
    });

    try {
      const router = createMemoryRouter(
        [
          {
            id: 'root',
            path: '/',
            loader: () =>
              makeRootStreamData({
                chrome: CHROME,
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
                path: 'cadence',
                loader: () => streamOk(cadenceData),
                action: cadenceActionSpy,
                Component: PortalCadenceBridge,
              },
            ],
          },
        ],
        { initialEntries: ['/'] },
      );

      const { container } = render(<RouterProvider router={router} />);
      const input = (await screen.findByLabelText('Terminal command input')) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'cadence --split' } });
      fireEvent.submit(input.closest('form') as HTMLFormElement);

      const selectTrigger = await screen.findByTestId('cadence-preset-select');
      const pane2 = container.querySelector('[data-pane-id="pane-2"]') as HTMLElement;
      expect(pane2.getAttribute('data-tui-depth')).toBe('1');

      // Opening Select popup and pressing Escape dismisses popup WITHOUT popping pane-2.
      fireEvent.click(selectTrigger);
      await screen.findByRole('listbox');
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBeNull();
      });
      expect(pane2.getAttribute('data-tui-depth')).toBe('1');
      expect(screen.getByTestId('cadence-prompt-input')).toBeTruthy();

      // Select pipeline monitor item & submit in fast mode.
      fireEvent.click(selectTrigger);
      const monitorOption = await screen.findByRole('option', { name: /CHORD Pipeline Monitor/i });
      fireEvent.pointerDown(monitorOption);
      fireEvent.click(monitorOption);
      fireEvent.click(screen.getByTestId('cadence-run-submit'));

      await waitFor(() => {
        expect(cadenceActionSpy).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect((listeners.get('complete') ?? []).length).toBeGreaterThan(0);
      });

      act(() => {
        for (const fn of listeners.get('phase') ?? []) {
          fn({
            data: JSON.stringify({
              runId,
              runStatus: 'running',
              progress: 25,
              turn: {
                phase: 'triage',
                agentName: 'chord-triage',
                status: 'completed',
                summary: 'Triaged in pane',
                latencyMs: 2,
              },
            }),
          } as unknown as Event);
        }
        for (const fn of listeners.get('complete') ?? []) {
          fn({
            data: JSON.stringify({
              run: {
                ...pendingRun,
                runStatus: 'ready',
                turns: pendingRun.turns.map(t => ({ ...t, status: 'completed', latencyMs: 3 })),
                artifactHtml: '<html><body>Pane Tailored Result</body></html>',
              },
              quota: {
                role: 'guest',
                turnsUsed: 1,
                maxTurns: 5,
                tokensUsed: 800,
                maxTokens: 20_000,
              },
            }),
          } as unknown as Event);
        }
      });

      expect(await screen.findByTestId('cadence-gate-approve')).toBeTruthy();
      expect(screen.getByTestId('cadence-quota-meter').textContent).toContain('1/5 turns');
      fireEvent.click(screen.getByTestId('cadence-gate-approve'));
      await waitFor(() => {
        expect(screen.getByTestId('cadence-gate-verdict').textContent).toContain('approved');
      });
      // Gate approval must retain updated 1/5 turns quota even without loader revalidation.
      expect(screen.getByTestId('cadence-quota-meter').textContent).toContain('1/5 turns');
      expect(router.state.location.pathname).toBe('/');

      // After Select selection & gate approval, closed Select popup must NOT block pane Escape exit.
      fireEvent.keyDown(window, { key: 'Escape' });
      await waitFor(() => {
        expect(pane2.getAttribute('data-tui-depth')).toBe('0');
      });
    } finally {
      globalThis.EventSource = originalEventSource;
    }
  });

  it('displays 429 error banner inside docked cadence pane after a prior streamed run completes without crashing workspace', async () => {
    const cadenceData: PortalCadenceLoaderData = {
      content: PortalCadenceContentSchema.parse({
        windowTitle: 'CADENCE Builder // portfolio-public',
        statusBadge: { source: 'svc-cadence-demo', state: 'idle', label: '0/1 replicas' },
        description: 'Build widgets cleanly.',
        iframeTitle: 'CADENCE Artifact Preview',
      }),
      presets: [
        {
          slug: 'solar-forge-starter',
          title: 'Solar Forge Starter',
          starterPrompt: 'Build a Solar Forge card.',
          expectedKind: 'diagnostic-card',
          starterArtifactHtml: '<html><body>Starter</body></html>',
          sortOrder: 1,
        },
      ],
      quota: { role: 'guest', turnsUsed: 4, maxTurns: 5, tokensUsed: 3200, maxTokens: 20_000 },
      recentRuns: [],
    };

    const runId = '33333333-3333-4333-8333-333333333333';
    const pendingRun: CadenceRunResult = {
      runId,
      prompt: 'Build a Solar Forge card.',
      presetSlug: 'solar-forge-starter',
      runStatus: 'pending',
      mode: 'fast',
      gateVerdict: 'pending',
      turns: [
        {
          phase: 'triage',
          agentName: 'chord-triage',
          status: 'pending',
          summary: 'Queued',
          latencyMs: 0,
        },
        {
          phase: 'spec',
          agentName: 'chord-spec',
          status: 'pending',
          summary: 'Queued',
          latencyMs: 0,
        },
        {
          phase: 'build',
          agentName: 'chord-builder',
          status: 'pending',
          summary: 'Queued',
          latencyMs: 0,
        },
        {
          phase: 'gate',
          agentName: 'chord-gate',
          status: 'pending',
          summary: 'Queued',
          latencyMs: 0,
        },
      ],
      artifactHtml: '',
    };

    const listeners = new Map<string, Array<(ev: Event) => void>>();
    const originalEventSource = globalThis.EventSource;
    class MockEventSource {
      addEventListener(type: string, cb: (ev: Event) => void) {
        const list = listeners.get(type) ?? [];
        list.push(cb);
        listeners.set(type, list);
      }
      close() {
        /* noop */
      }
      onerror: ((ev: Event) => void) | null = null;
    }
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;

    let calls = 0;
    const cadenceActionSpy = vi.fn<() => Promise<PortalCadenceActionResult>>(async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: true,
          intent: 'run-init',
          run: pendingRun,
          quota: { role: 'guest', turnsUsed: 5, maxTurns: 5, tokensUsed: 4000, maxTokens: 20_000 },
        };
      }
      return {
        ok: false,
        intent: 'run',
        error: 'Session or daily CADENCE guest quota exceeded.',
        code: 'ERR_RATE_LIMITED',
        quota: { role: 'guest', turnsUsed: 5, maxTurns: 5, tokensUsed: 4000, maxTokens: 20_000 },
      };
    });

    installTestPaneTransport({
      loaders: {
        '/cadence': () => streamOk(cadenceData),
      },
      actions: {
        '/cadence': () => cadenceActionSpy(),
      },
    });

    try {
      const router = createMemoryRouter(
        [
          {
            id: 'root',
            path: '/',
            loader: () =>
              makeRootStreamData({
                chrome: CHROME,
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
                path: 'cadence',
                loader: () => streamOk(cadenceData),
                action: cadenceActionSpy,
                Component: PortalCadenceBridge,
              },
            ],
          },
        ],
        { initialEntries: ['/'] },
      );

      render(<RouterProvider router={router} />);
      const input = (await screen.findByLabelText('Terminal command input')) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'cadence --split' } });
      fireEvent.submit(input.closest('form') as HTMLFormElement);

      fireEvent.click(await screen.findByTestId('cadence-run-submit'));
      await waitFor(() => {
        expect((listeners.get('complete') ?? []).length).toBeGreaterThan(0);
      });
      act(() => {
        for (const fn of listeners.get('complete') ?? []) {
          fn({
            data: JSON.stringify({
              run: {
                ...pendingRun,
                runStatus: 'ready',
                turns: pendingRun.turns.map(t => ({ ...t, status: 'completed', latencyMs: 2 })),
                artifactHtml: '<html><body>Completed 5th</body></html>',
              },
              quota: {
                role: 'guest',
                turnsUsed: 5,
                maxTurns: 5,
                tokensUsed: 4000,
                maxTokens: 20_000,
              },
            }),
          } as unknown as Event);
        }
      });

      fireEvent.click(screen.getByTestId('cadence-run-submit'));
      expect(await screen.findByTestId('cadence-error-banner')).toBeTruthy();
      expect(screen.getByTestId('cadence-error-banner').textContent).toContain('quota exceeded');
      expect(router.state.location.pathname).toBe('/');
    } finally {
      globalThis.EventSource = originalEventSource;
    }
  });

  it('recovers async running run in docked pane via EventSource and unblocks submit on SSE onerror', async () => {
    const runningRunId = '44444444-4444-4444-8444-444444444444';
    const runningRun: CadenceRunResult = {
      runId: runningRunId,
      prompt: 'Async reload recovery prompt',
      presetSlug: 'solar-forge-starter',
      runStatus: 'running',
      mode: 'fast',
      gateVerdict: 'pending',
      turns: [
        {
          phase: 'triage',
          agentName: 'chord-triage',
          status: 'completed',
          summary: 'Triaged',
          latencyMs: 2,
        },
        {
          phase: 'spec',
          agentName: 'chord-spec',
          status: 'running',
          summary: 'Running spec...',
          latencyMs: 0,
        },
        {
          phase: 'build',
          agentName: 'chord-builder',
          status: 'pending',
          summary: 'Queued',
          latencyMs: 0,
        },
        {
          phase: 'gate',
          agentName: 'chord-gate',
          status: 'pending',
          summary: 'Queued',
          latencyMs: 0,
        },
      ],
      artifactHtml: '',
    };

    const cadenceData: PortalCadenceLoaderData = {
      content: PortalCadenceContentSchema.parse({
        windowTitle: 'CADENCE Builder // portfolio-public',
        statusBadge: { source: 'svc-cadence-demo', state: 'idle', label: '0/1 replicas' },
        description: 'Async recovery check.',
        iframeTitle: 'CADENCE Artifact Preview',
      }),
      presets: [
        {
          slug: 'solar-forge-starter',
          title: 'Solar Forge Starter',
          starterPrompt: 'Build a Solar Forge card.',
          expectedKind: 'diagnostic-card',
          starterArtifactHtml: '<html><body>Starter</body></html>',
          sortOrder: 1,
        },
      ],
      quota: { role: 'guest', turnsUsed: 1, maxTurns: 5, tokensUsed: 800, maxTokens: 20_000 },
      recentRuns: [runningRun],
    };

    let createdUrl = '';
    let latestOnError: ((ev: Event) => void) | null = null;
    const originalEventSource = globalThis.EventSource;
    class MockEventSource {
      constructor(url: string) {
        createdUrl = url;
      }
      addEventListener() {
        /* registered cleanly */
      }
      close() {
        /* noop */
      }
      set onerror(cb: ((ev: Event) => void) | null) {
        latestOnError = cb;
      }
    }
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;

    installTestPaneTransport({
      loaders: {
        '/cadence': () => streamOk(cadenceData),
      },
    });

    try {
      const router = createMemoryRouter(
        [
          {
            id: 'root',
            path: '/',
            loader: () =>
              makeRootStreamData({
                chrome: CHROME,
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
                path: 'cadence',
                loader: () => streamOk(cadenceData),
                Component: PortalCadenceBridge,
              },
            ],
          },
        ],
        { initialEntries: ['/'] },
      );

      render(<RouterProvider router={router} />);
      const input = (await screen.findByLabelText('Terminal command input')) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'cadence --split' } });
      fireEvent.submit(input.closest('form') as HTMLFormElement);

      await waitFor(() => {
        expect(createdUrl).toContain(`/api/cadence/runs/${runningRunId}/stream`);
      });
      const submitBtn = (await screen.findByTestId('cadence-run-submit')) as HTMLButtonElement;
      expect(submitBtn.disabled).toBe(true);

      act(() => {
        latestOnError?.(new Event('error'));
      });

      expect(await screen.findByTestId('cadence-error-banner')).toBeTruthy();
      expect((screen.getByTestId('cadence-run-submit') as HTMLButtonElement).disabled).toBe(false);
      expect(screen.getByText(/CHORD stream interrupted/i)).toBeTruthy();
    } finally {
      globalThis.EventSource = originalEventSource;
    }
  });

  it('streams askStatusPayload into docked /chat?pane=1 and logs envelope_shape_mismatch when omitted', async () => {
    const askData: PortalAskLoaderData = {
      content: PortalAskContentSchema.parse({
        windowTitle: 'Chat with Andrew',
        statusBadge: { source: 'ai-ask', state: 'idle', label: 'idle' },
        description: 'Grounded docked Q&A.',
        abstentionNotice: 'Strict grounding enabled.',
        starterQuestions: ['What stack powers this site?'],
        jdPlaceholder: 'Paste JD...',
      }),
      quota: { role: 'guest', turnsUsed: 0, maxTurns: 10, tokensUsed: 0, maxTokens: 40_000 },
    };

    const askStatusDeferred = Promise.withResolvers<StreamResult<AskServiceStatus | undefined>>();
    installTestPaneTransport({
      loaders: {
        '/chat': () => ({
          correlationId: 'corr-ask-pane',
          payload: Promise.resolve<StreamResult<PortalAskLoaderData>>({
            ok: true,
            data: askData,
          }),
          askStatusPayload: askStatusDeferred.promise,
        }),
      },
    });
    const router = createMemoryRouter(
      [
        {
          id: 'root',
          path: '/',
          loader: () =>
            makeRootStreamData({
              chrome: CHROME,
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
              path: 'chat',
              loader: () => ({
                correlationId: 'corr-ask-pane',
                payload: Promise.resolve<StreamResult<PortalAskLoaderData>>({
                  ok: true,
                  data: askData,
                }),
                askStatusPayload: askStatusDeferred.promise,
              }),
              Component: () => <div>Chat SSR</div>,
            },
          ],
        },
      ],
      { initialEntries: ['/'] },
    );

    const first = render(<RouterProvider router={router} />);
    const input = (await screen.findByLabelText('Terminal command input')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'chat --split' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(await screen.findByTestId('ask-question-input')).toBeTruthy();
    expect(screen.getByText(/probing · ai-ask/i)).toBeTruthy();

    askStatusDeferred.resolve({
      ok: true,
      data: { status: 'ready', provider: 'vertex', pointsCount: 19 },
    });
    expect(await screen.findByText(/ready · 19 pts/i)).toBeTruthy();
    first.unmount();

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const mismatchRouter = createMemoryRouter(
      [
        {
          id: 'root',
          path: '/',
          loader: () =>
            makeRootStreamData({
              chrome: CHROME,
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
              path: 'chat',
              loader: () => streamOk(askData, 'corr-ask-mismatch'),
              Component: () => <div>Chat SSR</div>,
            },
          ],
        },
      ],
      { initialEntries: ['/'] },
    );

    portalWorkspaceStore.resetForTest();
    portalPaneStreamStore.resetForTest();
    installTestPaneTransport({
      loaders: {
        '/chat': () => streamOk(askData, 'corr-ask-mismatch'),
      },
    });
    window.sessionStorage.clear();
    render(<RouterProvider router={mismatchRouter} />);
    const input2 = (await screen.findByLabelText('Terminal command input')) as HTMLInputElement;
    fireEvent.change(input2, { target: { value: 'chat --split' } });
    fireEvent.submit(input2.closest('form') as HTMLFormElement);

    expect(await screen.findByTestId('ask-question-input')).toBeTruthy();
    expect(
      errorSpy.mock.calls.some(args =>
        String(args[0] ?? '').includes('portal.pane_nav.envelope_shape_mismatch'),
      ),
    ).toBe(true);
    errorSpy.mockRestore();
  });

  it('isolates secondary-pane HTTP 502/offline action faults without crashing PortalRoot or revalidating active primary /agensi', async () => {
    let agensiRouteLoads = 0;
    installTestPaneTransport({
      loaders: {
        '/contact': () => streamOk(CONTACT_DATA),
      },
      actions: {
        '/contact': async () => {
          throw new TypeError('Failed to fetch');
        },
      },
    });

    const router = createMemoryRouter(
      [
        {
          id: 'root',
          path: '/',
          loader: () =>
            makeRootStreamData({
              chrome: CHROME,
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
                agensiRouteLoads += 1;
                return streamOk(AGENSI_DATA);
              },
              Component: PortalAgensiBridge,
            },
          ],
        },
      ],
      { initialEntries: ['/agensi'] },
    );

    const { container } = render(<RouterProvider router={router} />);
    expect(await screen.findByText('Commercial AI skills.')).toBeTruthy();
    expect(agensiRouteLoads).toBe(1);

    // Open secondary /contact split via header Open Pane menu while /agensi is primary
    fireEvent.click(screen.getByRole('button', { name: 'Open Pane' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Contact (Split)' }));

    const nameInput = await screen.findByLabelText(/Name/i);
    const emailInput = screen.getByLabelText(/Email/i);
    const messageInput = screen.getByRole('textbox', { name: /Message/i });
    fireEvent.change(nameInput, { target: { value: 'Ada Lovelace' } });
    fireEvent.change(emailInput, { target: { value: 'ada@example.com' } });
    fireEvent.change(messageInput, {
      target: { value: 'Testing offline pane action resilience.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Transmit|Send|Submit/i }));

    // Wire-safe inline alert inside /contact split; primary /agensi and workspace stay untouched
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Unable to reach the server.');
    expect(screen.getByText('Commercial AI skills.')).toBeTruthy();
    expect(container.querySelector('[data-pane-count="2"]')).toBeTruthy();
    expect(agensiRouteLoads).toBe(1);
    expect(router.state.location.pathname).toBe('/agensi');
  });

  it('never aborts a sibling pane .data load on action submit and aborts/evicts when popping an in-pane view', async () => {
    const agensiDeferred = Promise.withResolvers<StreamResult<PortalAgensiLoaderData>>();
    let agensiSignal: AbortSignal | undefined;

    installTestPaneTransport({
      loaders: {
        '/agensi': (_request, signal) => {
          agensiSignal = signal;
          return {
            correlationId: 'corr-agensi-slow',
            payload: agensiDeferred.promise,
          };
        },
        '/contact': () => streamOk(CONTACT_DATA),
      },
      actions: {
        '/contact': async (): Promise<ContactActionResult> => ({
          ok: true,
          submission: {
            id: 'rcpt-202',
            name: 'Grace Hopper',
            email: 'grace@example.com',
            phone: null,
            attachmentName: null,
            attachmentSizeBytes: null,
            attachmentSha256: null,
            createdAt: '2026-11-25T19:00:00Z',
          },
        }),
      },
    });

    const router = createMemoryRouter(
      [
        {
          id: 'root',
          path: '/',
          loader: () =>
            makeRootStreamData({
              chrome: CHROME,
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
          ],
        },
      ],
      { initialEntries: ['/'] },
    );

    const { container } = render(<RouterProvider router={router} />);
    await screen.findByLabelText('Terminal command input');

    // Launch slow /agensi in split and /contact in another split
    fireEvent.click(screen.getByRole('button', { name: 'Open Pane' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Agensi (Split)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Pane' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Contact (Split)' }));

    // Submit /contact while /agensi is still streaming -> /agensi signal must NOT abort
    fireEvent.change(await screen.findByLabelText(/Name/i), { target: { value: 'Grace Hopper' } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'grace@example.com' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Message/i }), {
      target: { value: 'Sibling pane load must stay alive.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Transmit|Send|Submit/i }));
    await waitFor(() => {
      expect(agensiSignal?.aborted).toBe(false);
    });
    expect(await screen.findByTestId('contact-receipt')).toBeTruthy();

    // Resolving /agensi completes cleanly
    agensiDeferred.resolve({ ok: true, data: AGENSI_DATA });
    expect(await screen.findByText('Commercial AI skills.')).toBeTruthy();

    // Now test in-pane view pop/exit aborting an active fetch on pane-1
    let pane1Signal: AbortSignal | undefined;
    installTestPaneTransport({
      loaders: {
        '/agensi': (_request, signal) => {
          pane1Signal = signal;
          return {
            correlationId: 'corr-pane1-pop',
            payload: new Promise<StreamResult<PortalAgensiLoaderData>>(() => undefined),
          };
        },
      },
    });
    const pane1 = container.querySelector('[data-pane-id="pane-1"]') as HTMLElement;
    fireEvent.pointerDown(pane1);
    const input = await waitFor(() => {
      const el = pane1.querySelector('input[data-terminal-input="true"]');
      expect(el).toBeTruthy();
      return el as HTMLInputElement;
    });
    fireEvent.change(input, { target: { value: 'agensi --split' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    await waitFor(() => {
      expect(pane1Signal?.aborted).toBe(false);
    });
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(pane1Signal?.aborted).toBe(true);
    });
  });

  it('ignores Alt+M in PortalRootShell (disableMenuShortcut) without opening retired /menu view', async () => {
    const router = createMemoryRouter(
      [
        {
          id: 'root',
          path: '/',
          loader: () =>
            makeRootStreamData({
              chrome: CHROME,
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
          ],
        },
      ],
      { initialEntries: ['/'] },
    );

    render(<RouterProvider router={router} />);
    await screen.findByLabelText('Terminal command input');

    fireEvent.keyDown(window, { key: 'm', code: 'KeyM', altKey: true });
    expect(screen.queryByText(/Unregistered view/i)).toBeNull();
  });

  it('renders shared feature views in PortalMobileWorkspaceHost without desktop provider and evicts on pop', async () => {
    let mobileSignal: AbortSignal | undefined;
    installTestPaneTransport({
      loaders: {
        '/agensi': (_request, signal) => {
          mobileSignal = signal;
          return streamOk(AGENSI_DATA);
        },
      },
    });

    function MobileStackTrigger() {
      const paneNav = usePaneNavigation();
      return (
        <button type='button' onClick={() => paneNav?.push('/agensi')}>
          Open Mobile Agensi
        </button>
      );
    }

    const router = createMemoryRouter(
      [
        {
          id: 'root',
          path: '/',
          loader: () => ({
            ...makeRootStreamData({
              chrome: CHROME,
              terminal: TERMINAL,
              homeContent: HOME_CONTENT,
            }),
            initialViewport: 'mobile-portrait' as const,
          }),
          Component: PortalRootBridge,
          children: [
            {
              index: true,
              Component: MobileStackTrigger,
            },
          ],
        },
      ],
      { initialEntries: ['/'] },
    );

    render(
      <ViewportProvider mode='mobile-portrait'>
        <RouterProvider router={router} />
      </ViewportProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Open Mobile Agensi' }));

    expect(await screen.findByText('Commercial AI skills.')).toBeTruthy();
    expect(mobileSignal?.aborted).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Back to previous pane' }));
    await waitFor(() => {
      expect(mobileSignal?.aborted).toBe(true);
    });
  });

  it('preserves secondary-pane ChatPaneView JD Match persisted turn recovery when reload/unload aborts submitPortalPaneAction', async () => {
    const askData: PortalAskLoaderData = {
      content: PortalAskContentSchema.parse({
        windowTitle: 'Chat with Andrew',
        statusBadge: { source: 'ai-ask', state: 'idle', label: 'idle' },
        description: 'Grounded docked Q&A.',
        abstentionNotice: 'Strict grounding enabled.',
        starterQuestions: ['What stack powers this site?'],
        jdPlaceholder: 'Paste JD...',
      }),
      quota: { role: 'guest', turnsUsed: 0, maxTurns: 10, tokensUsed: 0, maxTokens: 40_000 },
    };

    const actionDeferred = Promise.withResolvers<unknown>();
    installTestPaneTransport({
      loaders: {
        '/chat': () => ({
          correlationId: 'corr-chat-unload',
          payload: Promise.resolve<StreamResult<PortalAskLoaderData>>({
            ok: true,
            data: askData,
          }),
          askStatusPayload: Promise.resolve<StreamResult<AskServiceStatus | undefined>>({
            ok: true,
            data: { status: 'ready', provider: 'vertex', pointsCount: 12 },
          }),
        }),
      },
      actions: {
        '/chat': () => actionDeferred.promise,
      },
    });

    const router = createMemoryRouter(
      [
        {
          id: 'root',
          path: '/',
          loader: () =>
            makeRootStreamData({
              chrome: CHROME,
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
          ],
        },
      ],
      { initialEntries: ['/'] },
    );

    render(<RouterProvider router={router} />);
    await screen.findByLabelText('Terminal command input');

    // Open secondary /chat split ("pane-2") via header Open Pane menu
    fireEvent.click(screen.getByRole('button', { name: 'Open Pane' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Chat (Split)' }));

    // Switch to JD Match tab and submit a delayed unary turn
    fireEvent.click(await screen.findByTestId('ask-tab-jd'));
    fireEvent.change(await screen.findByTestId('ask-jd-textarea'), {
      target: {
        value:
          'Staff Platform Engineer working on streaming SSR, Go microservices, and PostgreSQL 19.',
      },
    });
    fireEvent.click(screen.getByTestId('ask-jd-submit'));

    await waitFor(() => {
      expect(readPersistedAskTurn('pane:pane-2')).toMatchObject({
        mode: 'jd_match',
        ownerInstanceId: 'pane:pane-2',
      });
    });

    // Simulate browser reload/unload aborting the in-flight secondary pane POST action
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
      actionDeferred.reject(new DOMException('The operation was aborted.', 'AbortError'));
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Persisted turn recovery entry for pane:pane-2 MUST remain intact (never cleared by unload abort)
    expect(readPersistedAskTurn('pane:pane-2')).toMatchObject({
      mode: 'jd_match',
      ownerInstanceId: 'pane:pane-2',
    });
  });

  it('commits ok:true responses during a cancelled beforeunload window and displays external ERR_STREAM_ABORTED errors without wedging submit', async () => {
    const askData: PortalAskLoaderData = {
      content: PortalAskContentSchema.parse({
        windowTitle: 'Chat with Andrew',
        statusBadge: { source: 'ai-ask', state: 'idle', label: 'idle' },
        description: 'Grounded docked Q&A.',
        abstentionNotice: 'Strict grounding enabled.',
        starterQuestions: ['What stack powers this site?'],
        jdPlaceholder: 'Paste JD...',
      }),
      quota: { role: 'guest', turnsUsed: 0, maxTurns: 10, tokensUsed: 0, maxTokens: 40_000 },
    };

    const firstDeferred = Promise.withResolvers<unknown>();
    let actionCalls = 0;
    installTestPaneTransport({
      loaders: {
        '/chat': () => ({
          correlationId: 'corr-chat-cancelled-unload',
          payload: Promise.resolve<StreamResult<PortalAskLoaderData>>({
            ok: true,
            data: askData,
          }),
          askStatusPayload: Promise.resolve<StreamResult<AskServiceStatus | undefined>>({
            ok: true,
            data: { status: 'ready', provider: 'vertex', pointsCount: 12 },
          }),
        }),
      },
      actions: {
        '/chat': () => {
          actionCalls += 1;
          if (actionCalls === 1) {
            return firstDeferred.promise;
          }
          // Simulate an external proxy HTTP 499 ERR_STREAM_ABORTED (no local abort or unload)
          return Promise.resolve({
            ok: false,
            mode: 'jd_match',
            error: 'Upstream proxy terminated request early.',
            code: 'ERR_STREAM_ABORTED',
            action: 'Retry your JD Match request.',
            correlationId: 'corr-ext-499',
          });
        },
      },
    });

    const router = createMemoryRouter(
      [
        {
          id: 'root',
          path: '/',
          loader: () =>
            makeRootStreamData({
              chrome: CHROME,
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
          ],
        },
      ],
      { initialEntries: ['/'] },
    );

    render(<RouterProvider router={router} />);
    await screen.findByLabelText('Terminal command input');

    fireEvent.click(screen.getByRole('button', { name: 'Open Pane' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Chat (Split)' }));

    fireEvent.click(await screen.findByTestId('ask-tab-jd'));
    fireEvent.change(await screen.findByTestId('ask-jd-textarea'), {
      target: {
        value:
          'Staff Platform Engineer working on streaming SSR, Go microservices, and PostgreSQL 19.',
      },
    });
    fireEvent.click(screen.getByTestId('ask-jd-submit'));

    // Case (a): beforeunload fires and user stays on page while ok:true response arrives
    act(() => {
      window.dispatchEvent(new Event('beforeunload'));
      firstDeferred.resolve({
        ok: true,
        mode: 'jd_match',
        submittedText:
          'Staff Platform Engineer working on streaming SSR, Go microservices, and PostgreSQL 19.',
        response: {
          mode: 'jd_match',
          grounded: true,
          abstained: false,
          answer: 'Strong platform engineering match.',
          jdMatch: {
            overallScore: 92,
            verdict: 'Strong Fit',
            strengths: ['Streaming SSR & Go microservices'],
            gaps: [],
          },
          sources: [],
          provider: 'test-ai',
          model: 'test-model',
          tokensUsed: 120,
          latencyMs: 42,
        },
      });
    });

    expect(await screen.findByTestId('ask-jd-result')).toBeTruthy();
    const submitBtn = screen.getByTestId('ask-jd-submit') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);

    // Case (b): External ERR_STREAM_ABORTED without local abort/unload shows inline error and re-enables submit
    fireEvent.click(submitBtn);
    const errorBanner = await screen.findByTestId('ask-error-banner');
    expect(errorBanner.textContent).toContain('ERR_STREAM_ABORTED');
    expect((screen.getByTestId('ask-jd-submit') as HTMLButtonElement).disabled).toBe(false);
  });

  it('supports /about primary deep-link, Open Pane split/tab docking, Services Guide pane link isolation, and HTTP 503 Retry recovery', async () => {
    const aboutData = getPrerenderPortalAboutData();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let aboutFetchAttempts = 0;

    installTestPaneTransport({
      loaders: {
        '/about': request =>
          runPaneSafeLoader<PortalAboutLoaderData>(request, async () => {
            aboutFetchAttempts += 1;
            if (aboutFetchAttempts === 1) {
              throw new Response('upstream unavailable', { status: 503 });
            }
            return aboutData;
          }),
        '/agensi': () => streamOk(AGENSI_DATA),
      },
    });

    const router = createMemoryRouter(
      [
        {
          id: 'root',
          path: '/',
          loader: () =>
            makeRootStreamData({
              chrome: CHROME,
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
              path: 'about',
              loader: () => streamOk(aboutData),
              Component: PortalAboutBridge,
            },
            {
              path: 'agensi',
              loader: () => streamOk(AGENSI_DATA),
              Component: PortalAgensiBridge,
            },
          ],
        },
      ],
      { initialEntries: ['/about'] },
    );

    try {
      const { container } = render(<RouterProvider router={router} />);

      // 1. Primary /about route renders and clicking a Services Guide link updates the browser URL
      expect(await screen.findByRole('heading', { name: 'Andrew Klapper' })).toBeTruthy();
      expect(screen.getByRole('link', { name: 'About' }).getAttribute('aria-current')).toBe('page');
      fireEvent.click(screen.getByTestId('about-service-link-agensi'));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/agensi');
      });

      // 2. Return to "/" and open /about in secondary split via terminal command -> HTTP 503 isolated -> Retry recovers
      await act(async () => {
        await router.navigate('/');
      });
      const input = (await screen.findByLabelText('Terminal command input')) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'about --split' } });
      fireEvent.submit(input.closest('form') as HTMLFormElement);

      expect(await screen.findByRole('alert')).toBeTruthy();
      expect(container.querySelector('[data-pane-count="2"]')).toBeTruthy();
      expect(router.state.location.pathname).toBe('/');
      expect(
        errorSpy.mock.calls.some(args =>
          String(args[0]).includes('portal.pane_nav.fetcher_load_failed'),
        ),
      ).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(await screen.findByRole('heading', { name: 'Andrew Klapper' })).toBeTruthy();

      // 3. Clicking Agensi service link INSIDE secondary split pane navigates in-pane while browser URL stays "/"
      fireEvent.click(screen.getByTestId('about-service-link-agensi'));
      expect(await screen.findByText('Commercial AI skills.')).toBeTruthy();
      expect(router.state.location.pathname).toBe('/');

      // 4. Open Pane -> About (Tab) opens /about in a new tab while browser URL stays "/"
      fireEvent.click(screen.getByRole('button', { name: 'Open Pane' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'About (Tab)' }));
      expect(await screen.findByRole('heading', { name: 'Andrew Klapper' })).toBeTruthy();
      expect(container.querySelector('[data-tab-count="2"]')).toBeTruthy();
      expect(router.state.location.pathname).toBe('/');
    } finally {
      errorSpy.mockRestore();
    }
  });
});
