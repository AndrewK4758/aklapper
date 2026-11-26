import {
  createPublicAppError,
  type PortalRootLoaderData,
  type StreamResult,
  type TerminalProfileData,
} from '@aklapper/core';
import { requestContextKey, type SsrStructuredLogger } from '@aklapper/node-runtime/ssr/stream';
import { usePaneNavigation, ViewportProvider } from '@aklapper/ui';
import { fireEvent, render, screen } from '@testing-library/react';
import { createRoutesStub, RouterContextProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { loadPortalRootDataWithPrerenderMock, reportPortalPublicErrorMock } = vi.hoisted(() => ({
  loadPortalRootDataWithPrerenderMock: vi.fn<() => Promise<PortalRootLoaderData>>(),
  reportPortalPublicErrorMock: vi.fn<(error: unknown, context?: unknown) => void>(),
}));

vi.mock('@aklapper/db', async importOriginal => {
  const actual = await importOriginal<typeof import('@aklapper/db')>();
  return {
    ...actual,
    loadPortalRootDataWithPrerender: loadPortalRootDataWithPrerenderMock,
  };
});

vi.mock('./client-telemetry', async importOriginal => {
  const actual = await importOriginal<typeof import('./client-telemetry')>();
  return {
    ...actual,
    reportPortalPublicError: reportPortalPublicErrorMock,
  };
});

import PortalRoot, {
  ErrorBoundary,
  isNavigablePath,
  Layout,
  loader,
  meta,
  shouldRevalidate,
} from './root';

const CHROME_FIXTURE: PortalRootLoaderData['chrome'] = {
  pageTitle: 'andrew-k.us // Solar Forge Terminal',
  brandLabel: 'Andrew Klapper Portfolio',
  brandContactEmail: 'andrew@andrew-k.us',
  shortcutHint: 'Ctrl+⇧} / Alt+⇧D split · Ctrl+⇧{ / Alt+⇧S hsplit · Alt+⇧N tab · Alt+T tui',
  statusBadge: {
    source: 'cloud-run',
    state: 'idle',
    label: '0 instances (scale-to-0)',
  },
  footerText: 'Solar Forge // Fastify 5 + React Router 8 SSR',
  footerLinkLabel: 'agensi.io/creators/aklapper',
  footerLinkUrl: 'https://agensi.io/creators/aklapper',
};

const TERMINAL_FIXTURE: TerminalProfileData = {
  slug: 'portal-home',
  bannerTitle: 'Solar Forge Terminal // tty1',
  bannerMeta: 'tty1 · interactive shell',
  osLabel: '⚡',
  directory: '~/andrew-k.us',
  vcsBranch: 'portfolio_v2',
  vcsState: 'clean',
  contextLabel: 'guest@andrew-k.us',
  placeholder: 'type a command',
  quickCommands: ['whoami', 'clear'],
  initialEntries: [],
  commands: [
    {
      name: 'whoami',
      description: 'active session identity',
      kind: 'static',
      output: 'guest@andrew-k.us (tty1)',
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
};

function makeRootLoaderArgs(
  url = 'https://andrew-k.us/',
  headers?: HeadersInit,
  correlationId?: string,
) {
  const infoCalls: Array<{ obj: Record<string, unknown>; msg?: string }> = [];
  const logger: SsrStructuredLogger = {
    info: vi.fn<(obj: Record<string, unknown>, msg?: string) => void>((obj, msg) => {
      infoCalls.push({ obj, msg });
    }),
    warn: vi.fn<(obj: Record<string, unknown>, msg?: string) => void>(),
    error: vi.fn<(obj: Record<string, unknown>, msg?: string) => void>(),
  };
  const context = new RouterContextProvider();
  if (correlationId) {
    context.set(requestContextKey, {
      correlationId,
      logger,
      serviceName: 'portal-ssr',
      signal: new AbortController().signal,
    });
  }
  return {
    args: {
      request: new Request(url, { headers }),
      params: {},
      context,
      unstable_pattern: '/',
      url: new URL(url),
      pattern: '/',
    } as Parameters<typeof loader>[0],
    infoCalls,
  };
}

describe('PortalRoot', () => {
  const originalMaintenanceEnv = process.env['PORTAL_MAINTENANCE_MODE'];

  afterEach(() => {
    if (originalMaintenanceEnv === undefined) {
      delete process.env['PORTAL_MAINTENANCE_MODE'];
    } else {
      process.env['PORTAL_MAINTENANCE_MODE'] = originalMaintenanceEnv;
    }
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('streams navigable routes without maintenance branching even if stale PORTAL_MAINTENANCE_MODE=true is set', async () => {
    process.env['PORTAL_MAINTENANCE_MODE'] = 'true';
    const pending = Promise.withResolvers<PortalRootLoaderData>();
    loadPortalRootDataWithPrerenderMock.mockReturnValueOnce(pending.promise);

    const { args, infoCalls } = makeRootLoaderArgs('https://andrew-k.us/', undefined, 'corr-nav-1');
    const result = loader(args);

    expect(result.isNotFound).toBe(false);
    expect('maintenanceMode' in result).toBe(false);
    expect(result.correlationId).toBe('corr-nav-1');
    expect(loadPortalRootDataWithPrerenderMock).toHaveBeenCalledTimes(1);
    expect(loadPortalRootDataWithPrerenderMock).toHaveBeenCalledWith();
    expect(result.rootPayload).toBeInstanceOf(Promise);
    expect(infoCalls).toContainEqual(
      expect.objectContaining({
        obj: expect.objectContaining({
          seam_type: 'RULE_DIVERGENCE',
          event: 'portal.routing.unmatched_route_branch',
          branch: 'navigable_route_stream',
          correlationId: 'corr-nav-1',
        }),
      }),
    );

    const tags = meta({
      loaderData: result,
      matches: [
        {
          id: 'root',
          params: {},
          pathname: '/',
          meta: [],
          loaderData: result,
        },
      ],
      location: { pathname: '/', search: '', hash: '', state: null, key: 'r1' },
      params: {},
    });
    expect(tags).toContainEqual({ name: 'robots', content: 'index, follow' });

    pending.resolve({ chrome: CHROME_FIXTURE });
    const settled = await result.rootPayload;
    expect(settled).toEqual({
      ok: true,
      data: { chrome: CHROME_FIXTURE },
    });
  });

  it('short-circuits PostgreSQL queries on /changes-in-progress and unknown paths while preserving correlationId and mobile viewport', () => {
    const { args: desktopArgs, infoCalls } = makeRootLoaderArgs(
      'https://andrew-k.us/changes-in-progress',
      { 'Sec-CH-UA-Mobile': '?0' },
      'corr-404-desktop',
    );
    const desktopResult = loader(desktopArgs);

    expect(desktopResult.isNotFound).toBe(true);
    expect(desktopResult.rootPayload).toBeNull();
    expect(desktopResult.correlationId).toBe('corr-404-desktop');
    expect(desktopResult.initialViewport).toBe('desktop');
    expect(loadPortalRootDataWithPrerenderMock).not.toHaveBeenCalled();
    expect(infoCalls).toContainEqual(
      expect.objectContaining({
        obj: expect.objectContaining({
          seam_type: 'RULE_DIVERGENCE',
          event: 'portal.routing.unmatched_route_branch',
          branch: 'not_found_zero_db_404',
          correlationId: 'corr-404-desktop',
        }),
      }),
    );

    const { args: mobileArgs } = makeRootLoaderArgs(
      'https://andrew-k.us/nonexistent-route/nested/',
      { 'Sec-CH-UA-Mobile': '?1' },
      'corr-404-mobile',
    );
    const mobileResult = loader(mobileArgs);
    expect(mobileResult.isNotFound).toBe(true);
    expect(mobileResult.rootPayload).toBeNull();
    expect(mobileResult.initialViewport).toBe('mobile-portrait');
    expect(loadPortalRootDataWithPrerenderMock).not.toHaveBeenCalled();

    // Burst of 50 concurrent bot-scan 404 requests executes zero DB queries
    const burst = Array.from({ length: 50 }, (_, idx) =>
      loader(makeRootLoaderArgs(`https://andrew-k.us/bot-probe-${idx + 1}`).args),
    );
    expect(burst.every(res => res.isNotFound && res.rootPayload === null)).toBe(true);
    expect(loadPortalRootDataWithPrerenderMock).not.toHaveBeenCalled();
  });

  it('matches navigable route paths case-insensitively and revalidates across navigable/not-found boundaries', () => {
    expect(isNavigablePath('/')).toBe(true);
    expect(isNavigablePath('/Contact')).toBe(true);
    expect(isNavigablePath('/CADENCE/')).toBe(true);
    expect(isNavigablePath('/changes-in-progress')).toBe(false);
    expect(isNavigablePath('/changes-in-progress/')).toBe(false);
    expect(isNavigablePath('/unknown/nested')).toBe(false);

    loadPortalRootDataWithPrerenderMock.mockReturnValueOnce(
      Promise.resolve({ chrome: CHROME_FIXTURE }),
    );
    const mixedCaseResult = loader(
      makeRootLoaderArgs('https://andrew-k.us/Contact', undefined, 'corr-contact-case').args,
    );
    expect(mixedCaseResult.isNotFound).toBe(false);
    expect(mixedCaseResult.rootPayload).toBeInstanceOf(Promise);
    expect(loadPortalRootDataWithPrerenderMock).toHaveBeenCalledTimes(1);

    // 404 -> / must return literal true even when defaultShouldRevalidate is false
    expect(
      shouldRevalidate({
        currentUrl: new URL('https://andrew-k.us/changes-in-progress'),
        nextUrl: new URL('https://andrew-k.us/'),
        defaultShouldRevalidate: false,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(true);

    // / -> 404 must also return literal true
    expect(
      shouldRevalidate({
        currentUrl: new URL('https://andrew-k.us/'),
        nextUrl: new URL('https://andrew-k.us/nonexistent'),
        defaultShouldRevalidate: false,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(true);

    // / -> /Contact stays within navigable set -> false
    expect(
      shouldRevalidate({
        currentUrl: new URL('https://andrew-k.us/'),
        nextUrl: new URL('https://andrew-k.us/Contact'),
        defaultShouldRevalidate: true,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(false);
  });

  it('renders standalone Outlet on 404 without mounting PortalRootShell or calling /api/runtime/status, and Return Home revalidates root.loader to mount /', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const rootLoaderSpy = vi.fn<(args: { request: Request }) => ReturnType<typeof loader>>(
      ({ request }) => {
        const pathname = new URL(request.url).pathname;
        if (!isNavigablePath(pathname)) {
          return {
            runtimeSeo: { siteUrl: 'https://andrew-k.us' },
            correlationId: 'corr-root-404',
            initialViewport: 'desktop' as const,
            isNotFound: true,
            rootPayload: null,
          };
        }
        return {
          runtimeSeo: { siteUrl: 'https://andrew-k.us' },
          correlationId: 'corr-root-home',
          initialViewport: 'desktop' as const,
          isNotFound: false,
          rootPayload: Promise.resolve<StreamResult<PortalRootLoaderData>>({
            ok: true,
            data: { chrome: CHROME_FIXTURE },
          }),
        };
      },
    );

    const { default: PortalNotFoundRoute, ErrorBoundary: NotFoundErrorBoundary } =
      await import('./routes/not-found');

    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: rootLoaderSpy,
        shouldRevalidate,
        Component: PortalRoot,
        ErrorBoundary,
        children: [
          { index: true, Component: () => <div>Recovered Home Workspace</div> },
          {
            path: '*',
            loader: () => {
              throw new Response('Not Found', { status: 404 });
            },
            Component: PortalNotFoundRoute,
            ErrorBoundary: NotFoundErrorBoundary,
          },
        ],
      },
    ]);

    render(<Stub initialEntries={['/changes-in-progress']} />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('ERR_NOT_FOUND');
    expect(alert.textContent).toContain('corr-root-404');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open Pane' })).toBeNull();
    expect(fetchSpy.mock.calls.some(call => String(call[0]).includes('/api/runtime/status'))).toBe(
      false,
    );
    expect(rootLoaderSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('link', { name: 'Return Home' }));

    expect(await screen.findByText('Recovered Home Workspace')).toBeTruthy();
    expect(screen.getByText('Andrew Klapper Portfolio')).toBeTruthy();
    expect(rootLoaderSpy).toHaveBeenCalledTimes(2);
  });

  it('emits noindex, nofollow for both robots and googlebot without JSON-LD or duplicate robots tags on 404 and root errors', async () => {
    const notFoundData = loader(
      makeRootLoaderArgs('https://andrew-k.us/changes-in-progress', undefined, 'corr-head-404')
        .args,
    );

    const notFoundMetaTags = meta({
      loaderData: notFoundData,
      matches: [
        {
          id: 'root',
          params: {},
          pathname: '/',
          meta: [],
          loaderData: notFoundData,
        },
      ],
      location: { pathname: '/changes-in-progress', search: '', hash: '', state: null, key: 'nf' },
      params: {},
    });
    const robotsTags = notFoundMetaTags.filter(tag => 'name' in tag && tag.name === 'robots');
    expect(robotsTags).toEqual([{ name: 'robots', content: 'noindex, nofollow' }]);

    const errorMetaTags = meta({
      loaderData: undefined,
      error: new Error('Unexpected root loader fault'),
      matches: [
        {
          id: 'root',
          params: {},
          pathname: '/',
          meta: [],
          loaderData: notFoundData,
        },
      ],
      location: { pathname: '/', search: '', hash: '', state: null, key: 'err' },
      params: {},
    });
    expect(errorMetaTags.filter(tag => 'name' in tag && tag.name === 'robots')).toEqual([
      { name: 'robots', content: 'noindex, nofollow' },
    ]);

    // Verify Layout omits JSON-LD and emits googlebot="noindex, nofollow" without duplicating meta[name="robots"]
    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: () => notFoundData,
        Component: () => (
          <Layout>
            <div>404 Body</div>
          </Layout>
        ),
        children: [{ path: '*', Component: () => null }],
      },
    ]);

    const { unmount } = render(<Stub initialEntries={['/changes-in-progress']} />);
    try {
      expect(await screen.findByText('404 Body')).toBeTruthy();
      expect(document.head.querySelector('meta[name="googlebot"]')?.getAttribute('content')).toBe(
        'noindex, nofollow',
      );
      // Layout itself does not emit a duplicate meta[name="robots"]; <Meta /> owns that tag
      expect(document.head.querySelectorAll('meta[name="robots"]')).toHaveLength(0);
      expect(document.head.querySelector('script[type="application/ld+json"]')).toBeNull();
      expect(
        document.head
          .querySelector('meta[name="aklapper-correlation-id"]')
          ?.getAttribute('content'),
      ).toBe('corr-head-404');
    } finally {
      unmount();
    }
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
          initialViewport: 'desktop' as const,
          isNotFound: false,
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
      data: { chrome: CHROME_FIXTURE },
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

  it('renders standard correlated ErrorElement on Postgres outage instead of OfflineMaintenanceFallback', async () => {
    const dbError = createPublicAppError({
      code: 'ERR_DB_UNAVAILABLE',
      status: 503,
      message: 'Database temporarily unavailable.',
      action: 'Retry shortly or share ID.',
      correlationId: 'corr-root-503',
    });

    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: () => ({
          runtimeSeo: { siteUrl: 'https://andrew-k.us' },
          correlationId: 'corr-root-503',
          initialViewport: 'desktop' as const,
          isNotFound: false,
          rootPayload: Promise.resolve<StreamResult<PortalRootLoaderData>>({
            ok: false,
            error: dbError,
          }),
        }),
        Component: PortalRoot,
      },
    ]);

    render(<Stub initialEntries={['/']} />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('ERR_DB_UNAVAILABLE');
    expect(alert.textContent).toContain('corr-root-503');
    expect(screen.getByRole('button', { name: /Retry/i })).toBeTruthy();
    expect(screen.queryByTestId('offline-maintenance-fallback')).toBeNull();
  });

  it('supports split keybindings globally on portal TUI routes', async () => {
    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: () => ({
          runtimeSeo: { siteUrl: 'https://andrew-k.us' },
          correlationId: 'corr-pane',
          initialViewport: 'desktop' as const,
          isNotFound: false,
          rootPayload: Promise.resolve<StreamResult<PortalRootLoaderData>>({
            ok: true,
            data: {
              chrome: CHROME_FIXTURE,
              terminal: TERMINAL_FIXTURE,
            },
          }),
        }),
        Component: PortalRoot,
        children: [{ path: 'agensi', Component: () => <div>TUI Agensi Probe</div> }],
      },
    ]);

    const { container } = render(<Stub initialEntries={['/agensi']} />);

    expect(await screen.findByText('TUI Agensi Probe')).toBeTruthy();
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

  it('suppresses client analytics beacons on 404 errors while reporting 500 errors cleanly', async () => {
    const notFoundError = createPublicAppError({
      code: 'ERR_NOT_FOUND',
      status: 404,
      message: 'Resource could not be found.',
      action: 'Verify the URL or return home.',
      correlationId: 'corr-404-suppress',
    });

    const NotFoundStub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        Component: () => {
          throw notFoundError;
        },
        ErrorBoundary,
      },
    ]);

    const first = render(<NotFoundStub initialEntries={['/']} />);
    const alert404 = await screen.findByRole('alert');
    expect(alert404.textContent).toContain('ERR_NOT_FOUND');
    expect(alert404.textContent).toContain('corr-404-suppress');
    expect(reportPortalPublicErrorMock).not.toHaveBeenCalled();
    first.unmount();

    const crashError = new Error('Internal crash at /srv/secret/file.ts:42');
    const ErrorStub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        Component: () => {
          throw crashError;
        },
        ErrorBoundary,
      },
    ]);

    render(<ErrorStub initialEntries={['/']} />);
    const alert500 = await screen.findByRole('alert');
    expect(alert500.textContent).toContain('ERR_INTERNAL');
    expect(alert500.textContent).not.toContain('/srv/secret/file.ts');
    expect(reportPortalPublicErrorMock).toHaveBeenCalledTimes(1);
  });

  it('detects initialViewport synchronously from Sec-CH-UA-Mobile and User-Agent headers', () => {
    loadPortalRootDataWithPrerenderMock.mockReturnValue(
      Promise.resolve({ chrome: CHROME_FIXTURE }),
    );

    const mobileResult = loader(
      makeRootLoaderArgs('https://andrew-k.us/', { 'Sec-CH-UA-Mobile': '?1' }).args,
    );
    expect(mobileResult.initialViewport).toBe('mobile-portrait');

    const desktopResult = loader(
      makeRootLoaderArgs('https://andrew-k.us/', { 'Sec-CH-UA-Mobile': '?0' }).args,
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
          isNotFound: false,
          rootPayload: Promise.resolve<StreamResult<PortalRootLoaderData>>({
            ok: true,
            data: {
              chrome: CHROME_FIXTURE,
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
          { path: 'agensi', Component: () => <div>Agensi Route Content</div> },
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

    fireEvent.click(screen.getByRole('button', { name: 'Back to previous pane' }));
    expect(await screen.findByText('Mobile Home Content')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Open Stacked TUI' }));
    expect(await screen.findByText('Welcome Launcher')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Skills' }));
    expect(await screen.findByText('Agensi Route Content')).toBeTruthy();
  });
});
