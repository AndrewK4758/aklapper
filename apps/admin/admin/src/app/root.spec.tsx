import {
  type AdminRootLoaderData,
  createPublicAppError,
  isPublicAppError,
  type StreamResult,
} from '@aklapper/core';
import { Code, ConnectError } from '@aklapper/node-runtime/grpc';
import { requestContextKey } from '@aklapper/node-runtime/ssr/stream';
import { MOBILE_PORTRAIT_MEDIA_QUERY } from '@aklapper/ui';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRoutesStub, RouterContextProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

const grpcMocks = vi.hoisted(() => ({
  resolveAdminSessionViaGrpc: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getAdminChromeViaGrpc: vi.fn<(...args: unknown[]) => Promise<AdminRootLoaderData['chrome']>>(),
  getAdminWorkspaceBootstrapViaGrpc: vi.fn<(...args: unknown[]) => Promise<AdminRootLoaderData>>(),
}));

vi.mock('@aklapper/node-runtime/grpc', async importOriginal => {
  const actual = await importOriginal<typeof import('@aklapper/node-runtime/grpc')>();
  return {
    ...actual,
    resolveAdminSessionViaGrpc: (...args: unknown[]) =>
      grpcMocks.resolveAdminSessionViaGrpc(...args),
    getAdminChromeViaGrpc: (...args: unknown[]) => grpcMocks.getAdminChromeViaGrpc(...args),
    getAdminWorkspaceBootstrapViaGrpc: (...args: unknown[]) =>
      grpcMocks.getAdminWorkspaceBootstrapViaGrpc(...args),
  };
});

import { resetAdminRootBranchTelemetryForTest } from './AdminRootShell';
import {
  initAdminClientTelemetry,
  reportAdminLazyChunkError,
  resetAdminClientTelemetryForTest,
} from './client-telemetry';
import AdminRoot, { ErrorBoundary, loader, meta } from './root';

const ADMIN_ROOT_FIXTURE: AdminRootLoaderData = {
  chrome: {
    pageTitle: 'admin.andrew-k.us // Solar Forge Ops',
    brandLabel: 'admin.andrew-k.us :: cadence-admin',
    statusBadge: {
      source: 'cadence-admin',
      state: 'gate',
      label: 'Passkey Auth Required',
    },
  },
};

const ACTIVE_ADMIN_SESSION = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  role: 'admin' as const,
  handle: 'aklapper',
  expiresAt: '2026-12-01T00:00:00.000Z',
};

function makeAdminLoaderArgs(
  url = 'http://localhost:4301/',
  options?: { headers?: HeadersInit; context?: RouterContextProvider },
): Parameters<typeof loader>[0] {
  return {
    request: new Request(url, { headers: options?.headers }),
    params: {},
    context: options?.context ?? new RouterContextProvider(),
    unstable_pattern: '/',
    url: new URL(url),
    pattern: '/',
  } as Parameters<typeof loader>[0];
}

describe('AdminRoot', () => {
  afterEach(() => {
    vi.clearAllMocks();
    resetAdminRootBranchTelemetryForTest();
    resetAdminClientTelemetryForTest();
  });

  it('streams loading status first and renders isolated cadence-admin chrome once rootPayload resolves', async () => {
    const deferred = Promise.withResolvers<StreamResult<AdminRootLoaderData>>();
    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: () => ({
          runtimeSeo: { siteUrl: 'https://admin.andrew-k.us' },
          correlationId: 'corr-admin-ok',
          isLoginRoute: false,
          session: null,
          authMeta: { totpEnabled: false, passkeyCount: 0 },
          rootPayload: deferred.promise,
        }),
        Component: AdminRoot,
        ErrorBoundary,
        children: [{ index: true, Component: () => <div>Admin Probe</div> }],
      },
    ]);

    render(<Stub initialEntries={['/']} />);

    const status = await screen.findByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('aria-busy')).toBe('true');

    deferred.resolve({ ok: true, data: ADMIN_ROOT_FIXTURE });

    expect(await screen.findByText('admin.andrew-k.us :: cadence-admin')).toBeTruthy();
    expect(screen.getByText('Passkey Auth Required')).toBeTruthy();
    expect(screen.getByText('Admin Probe')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sign Out' })).toBeNull();
    expect(screen.queryByText('andrew-k.us')).toBeNull();
  });

  it('renders session handle, typed nav links, and Sign Out button when admin session is active', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ loggedOut: true }), { status: 200 }));

    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: () => ({
          runtimeSeo: { siteUrl: 'https://admin.andrew-k.us' },
          correlationId: 'corr-admin-session',
          isLoginRoute: false,
          session: ACTIVE_ADMIN_SESSION,
          authMeta: { totpEnabled: true, passkeyCount: 2 },
          rootPayload: Promise.resolve<StreamResult<AdminRootLoaderData>>({
            ok: true,
            data: ADMIN_ROOT_FIXTURE,
          }),
        }),
        Component: AdminRoot,
        ErrorBoundary,
        children: [{ index: true, Component: () => <div>Ops Ready</div> }],
      },
    ]);

    try {
      render(<Stub initialEntries={['/']} />);

      expect(await screen.findByText('aklapper@admin')).toBeTruthy();
      expect(screen.getByText('Passkey Verified')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Analytics' }).getAttribute('href')).toBe(
        '/analytics',
      );
      expect(screen.getByRole('link', { name: 'CMS' }).getAttribute('href')).toBe('/cms');

      fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
      });
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('redirects unauthenticated requests with HTTP 302 before calling gRPC bootstrap/chrome', async () => {
    grpcMocks.resolveAdminSessionViaGrpc.mockResolvedValueOnce({
      authenticated: false,
      session: null,
      totpEnabled: false,
      passkeyCount: 0,
    });

    const thrown = await loader(
      makeAdminLoaderArgs('http://localhost:4301/analytics?tab=vitals'),
    ).catch((err: unknown) => err);

    expect(thrown).toBeInstanceOf(Response);
    const response = thrown as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/login?next=%2Fanalytics%3Ftab%3Dvitals');
    expect(grpcMocks.getAdminChromeViaGrpc).not.toHaveBeenCalled();
    expect(grpcMocks.getAdminWorkspaceBootstrapViaGrpc).not.toHaveBeenCalled();
  });

  it('redirects authenticated admins away from /login to sanitized next target', async () => {
    grpcMocks.resolveAdminSessionViaGrpc.mockResolvedValueOnce({
      authenticated: true,
      session: ACTIVE_ADMIN_SESSION,
      totpEnabled: false,
      passkeyCount: 1,
    });

    const thrown = await loader(makeAdminLoaderArgs('http://localhost:4301/login?next=/ops')).catch(
      (err: unknown) => err,
    );

    expect(thrown).toBeInstanceOf(Response);
    const response = thrown as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/ops');
    expect(grpcMocks.getAdminChromeViaGrpc).not.toHaveBeenCalled();
    expect(grpcMocks.getAdminWorkspaceBootstrapViaGrpc).not.toHaveBeenCalled();
  });

  it('streams deferred chrome-only rootPayload via GetAdminChrome on /login and bootstrap on authenticated routes', async () => {
    grpcMocks.resolveAdminSessionViaGrpc.mockResolvedValueOnce({
      authenticated: false,
      session: null,
      totpEnabled: false,
      passkeyCount: 0,
    });
    const pendingChrome = Promise.withResolvers<AdminRootLoaderData['chrome']>();
    grpcMocks.getAdminChromeViaGrpc.mockReturnValueOnce(pendingChrome.promise);

    const result = await loader(makeAdminLoaderArgs('http://localhost:4301/login'));

    expect(result.session).toBeNull();
    expect(result.isLoginRoute).toBe(true);
    expect(result.rootPayload).toBeInstanceOf(Promise);
    expect(grpcMocks.getAdminWorkspaceBootstrapViaGrpc).not.toHaveBeenCalled();

    pendingChrome.resolve(ADMIN_ROOT_FIXTURE.chrome);
    const settled = await result.rootPayload;
    expect(settled).toEqual({
      ok: true,
      data: {
        ...ADMIN_ROOT_FIXTURE,
        terminal: undefined,
      },
    });

    const tags = meta({
      loaderData: result,
      matches: [
        {
          id: 'root',
          params: {},
          pathname: '/login',
          meta: [],
          loaderData: result,
        },
      ],
      location: { pathname: '/login', search: '', hash: '', state: null, key: 'r1' },
      params: {},
    });
    expect(tags).toContainEqual({ name: 'robots', content: 'noindex, nofollow, noarchive' });

    grpcMocks.resolveAdminSessionViaGrpc.mockResolvedValueOnce({
      authenticated: true,
      session: ACTIVE_ADMIN_SESSION,
      totpEnabled: true,
      passkeyCount: 1,
    });
    const fakeTerminal = { slug: 'admin-ops' } as AdminRootLoaderData['terminal'];
    grpcMocks.getAdminWorkspaceBootstrapViaGrpc.mockResolvedValueOnce({
      chrome: ADMIN_ROOT_FIXTURE.chrome,
      terminal: fakeTerminal,
    });
    const authResult = await loader(makeAdminLoaderArgs('http://localhost:4301/'));
    expect(await authResult.rootPayload).toEqual({
      ok: true,
      data: { chrome: ADMIN_ROOT_FIXTURE.chrome, terminal: fakeTerminal },
    });
    expect(grpcMocks.getAdminWorkspaceBootstrapViaGrpc).toHaveBeenCalledWith(
      ACTIVE_ADMIN_SESSION.sessionId,
      expect.any(Object),
    );
  });

  it('classifies upstream admin-api outages during session verification to HTTP 503 data error and renders via ErrorBoundary', async () => {
    type LogFn = (obj: Record<string, unknown>, msg?: string) => void;
    const logger = { info: vi.fn<LogFn>(), warn: vi.fn<LogFn>(), error: vi.fn<LogFn>() };
    const context = new RouterContextProvider();
    context.set(requestContextKey, {
      correlationId: 'corr-root-auth-503',
      logger,
      serviceName: 'admin-ssr',
      signal: new AbortController().signal,
    });
    grpcMocks.resolveAdminSessionViaGrpc.mockRejectedValueOnce(
      new ConnectError('dial tcp 127.0.0.1:8085: connection refused', Code.Unavailable),
    );

    const thrown = await loader(
      makeAdminLoaderArgs('http://localhost:4301/analytics', {
        headers: { cookie: `ak_admin_session=${ACTIVE_ADMIN_SESSION.sessionId}` },
        context,
      }),
    ).catch((err: unknown) => err);

    const dataError = thrown as {
      type?: string;
      data?: unknown;
      init?: { status?: number; headers?: Record<string, string> };
    };
    expect(dataError.type).toBe('DataWithResponseInit');
    expect(dataError.init?.status).toBe(503);
    expect(dataError.init?.headers?.['X-Correlation-Id']).toBe('corr-root-auth-503');
    expect(isPublicAppError(dataError.data)).toBe(true);
    expect(dataError.data).toEqual(
      expect.objectContaining({
        code: 'ERR_UPSTREAM_UNAVAILABLE',
        correlationId: 'corr-root-auth-503',
      }),
    );
    expect(logger.error).toHaveBeenCalled();

    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: () => {
          throw thrown;
        },
        Component: AdminRoot,
        ErrorBoundary,
      },
    ]);

    render(<Stub initialEntries={['/']} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('ERR_UPSTREAM_UNAVAILABLE');
    expect(alert.textContent).toContain('corr-root-auth-503');
    expect(alert.textContent).not.toContain('connection refused');
  });

  it('renders correlated ErrorElement inside intact shell on root stream timeout without portal leakage', async () => {
    const timeoutError = createPublicAppError({
      code: 'ERR_STREAM_TIMEOUT',
      status: 504,
      message: 'Section took too long to load.',
      action: 'Retry loading or refresh.',
      correlationId: 'corr-admin-504',
    });

    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: () => ({
          runtimeSeo: { siteUrl: 'https://admin.andrew-k.us' },
          correlationId: 'corr-admin-504',
          isLoginRoute: false,
          session: ACTIVE_ADMIN_SESSION,
          authMeta: { totpEnabled: false, passkeyCount: 1 },
          rootPayload: Promise.resolve<StreamResult<AdminRootLoaderData>>({
            ok: false,
            error: timeoutError,
          }),
        }),
        Component: AdminRoot,
        ErrorBoundary,
      },
    ]);

    render(<Stub initialEntries={['/']} />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('ERR_STREAM_TIMEOUT');
    expect(alert.textContent).toContain('corr-admin-504');
    expect(screen.getByRole('button', { name: /Retry/i })).toBeTruthy();
    expect(screen.queryByText('andrew-k.us')).toBeNull();
  });

  it('contains unexpected route render errors cleanly in exported ErrorBoundary', async () => {
    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        Component: () => {
          throw new Error('Crash at /srv/admin/internal.ts:99');
        },
        ErrorBoundary,
      },
    ]);

    render(<Stub initialEntries={['/']} />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('ERR_INTERNAL');
    expect(alert.textContent).not.toContain('/srv/admin/internal.ts');
  });

  it('emits deduplicated admin.root.workspace_mount_branch for login-outlet-only and lazy-terminal-workspace without PII', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    try {
      const LoginStub = createRoutesStub([
        {
          id: 'root',
          path: '/login',
          loader: () => ({
            runtimeSeo: { siteUrl: 'https://admin.andrew-k.us' },
            correlationId: 'corr-admin-login-branch',
            isLoginRoute: true,
            session: null,
            authMeta: { totpEnabled: false, passkeyCount: 0 },
            rootPayload: Promise.resolve<StreamResult<AdminRootLoaderData>>({
              ok: true,
              data: ADMIN_ROOT_FIXTURE,
            }),
          }),
          Component: AdminRoot,
          ErrorBoundary,
          children: [{ index: true, Component: () => <div>Login Outlet</div> }],
        },
      ]);

      const { unmount } = render(<LoginStub initialEntries={['/login']} />);
      expect(await screen.findByText('Login Outlet')).toBeTruthy();

      const loginEvents = debugSpy.mock.calls
        .map(call => String(call[0]))
        .filter(line => line.includes('admin.root.workspace_mount_branch'));
      expect(loginEvents).toHaveLength(1);
      expect(JSON.parse(loginEvents[0])).toEqual({
        event: 'admin.root.workspace_mount_branch',
        seamType: 'RULE_DIVERGENCE',
        branch: 'login-outlet-only',
        pathname: '/login',
      });
      unmount();

      debugSpy.mockClear();
      const WorkspaceStub = createRoutesStub([
        {
          id: 'root',
          path: '/',
          loader: () => ({
            runtimeSeo: { siteUrl: 'https://admin.andrew-k.us' },
            correlationId: 'corr-admin-ws-branch',
            isLoginRoute: false,
            session: ACTIVE_ADMIN_SESSION,
            authMeta: { totpEnabled: true, passkeyCount: 1 },
            rootPayload: Promise.resolve<StreamResult<AdminRootLoaderData>>({
              ok: true,
              data: {
                ...ADMIN_ROOT_FIXTURE,
                terminal: {
                  slug: 'admin-ops',
                  bannerTitle: 'Admin Ops',
                  bannerMeta: 'cadence-admin',
                  osLabel: 'linux',
                  directory: '~',
                  vcsBranch: 'main',
                  vcsState: 'clean',
                  contextLabel: 'admin',
                  placeholder: 'Type a command...',
                  quickCommands: [],
                  initialEntries: [],
                  commands: [],
                },
              },
            }),
          }),
          Component: AdminRoot,
          ErrorBoundary,
          children: [{ index: true, Component: () => <div>Workspace Outlet</div> }],
        },
      ]);

      render(<WorkspaceStub initialEntries={['/']} />);
      expect(await screen.findByText('admin.andrew-k.us :: cadence-admin')).toBeTruthy();

      const wsEvents = debugSpy.mock.calls
        .map(call => String(call[0]))
        .filter(line => line.includes('admin.root.workspace_mount_branch'));
      expect(wsEvents).toHaveLength(1);
      expect(JSON.parse(wsEvents[0])).toEqual({
        event: 'admin.root.workspace_mount_branch',
        seamType: 'RULE_DIVERGENCE',
        branch: 'lazy-terminal-workspace',
        pathname: '/',
      });
      expect(wsEvents[0]).not.toContain('aklapper');
      expect(wsEvents[0]).not.toContain(ACTIVE_ADMIN_SESSION.sessionId);
    } finally {
      debugSpy.mockRestore();
    }
  });

  it('mounts MobileAppShell on authenticated handheld viewports, omits it on /login, and guards unexpected unauthenticated non-login handheld renders', async () => {
    const originalMatchMedia = window.matchMedia;
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ loggedOut: true }), { status: 200 }));

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn<(query: string) => MediaQueryList>((query: string): MediaQueryList => ({
        matches: query === MOBILE_PORTRAIT_MEDIA_QUERY,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      })),
    });

    try {
      // 1. Authenticated handheld route -> mobile-app-shell branch
      const AuthHandheldStub = createRoutesStub([
        {
          id: 'root',
          path: '/cms',
          loader: () => ({
            runtimeSeo: { siteUrl: 'https://admin.andrew-k.us' },
            correlationId: 'corr-admin-mobile-auth',
            isLoginRoute: false,
            session: ACTIVE_ADMIN_SESSION,
            authMeta: { totpEnabled: true, passkeyCount: 1 },
            rootPayload: Promise.resolve<StreamResult<AdminRootLoaderData>>({
              ok: true,
              data: ADMIN_ROOT_FIXTURE,
            }),
          }),
          Component: AdminRoot,
          ErrorBoundary,
          children: [{ index: true, Component: () => <div>CMS Mobile View</div> }],
        },
      ]);

      const { unmount: unmountAuth } = render(<AuthHandheldStub initialEntries={['/cms']} />);
      expect(await screen.findByText('CMS Mobile View')).toBeTruthy();
      expect(document.querySelector('[data-mobile-tui-dock="true"]')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'CMS' }).getAttribute('aria-current')).toBe('page');
      expect(
        debugSpy.mock.calls.some(
          call =>
            String(call[0]).includes('admin.root.workspace_mount_branch') &&
            String(call[0]).includes('"branch":"mobile-tui-workspace"'),
        ),
      ).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'Open workspace menu' }));
      expect(screen.getByRole('link', { name: 'Quotas' }).getAttribute('href')).toBe('/quotas');
      fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
      });
      unmountAuth();

      // 2. Unauthenticated /login on handheld -> login-outlet-only, zero UNSOUND_CONDITION
      debugSpy.mockClear();
      warnSpy.mockClear();
      resetAdminRootBranchTelemetryForTest();

      const LoginHandheldStub = createRoutesStub([
        {
          id: 'root',
          path: '/login',
          loader: () => ({
            runtimeSeo: { siteUrl: 'https://admin.andrew-k.us' },
            correlationId: 'corr-admin-mobile-login',
            isLoginRoute: true,
            session: null,
            authMeta: { totpEnabled: false, passkeyCount: 0 },
            rootPayload: Promise.resolve<StreamResult<AdminRootLoaderData>>({
              ok: true,
              data: ADMIN_ROOT_FIXTURE,
            }),
          }),
          Component: AdminRoot,
          ErrorBoundary,
          children: [{ index: true, Component: () => <div>Mobile Login Form</div> }],
        },
      ]);

      const { unmount: unmountLogin } = render(<LoginHandheldStub initialEntries={['/login']} />);
      expect(await screen.findByText('Mobile Login Form')).toBeTruthy();
      expect(document.querySelector('[data-mobile-tui-dock="true"]')).toBeNull();
      expect(
        debugSpy.mock.calls.some(
          call =>
            String(call[0]).includes('admin.root.workspace_mount_branch') &&
            String(call[0]).includes('"branch":"login-outlet-only"'),
        ),
      ).toBe(true);
      expect(
        warnSpy.mock.calls.some(call =>
          String(call[0]).includes('admin.root.unauth_mobile_shell_blocked'),
        ),
      ).toBe(false);
      unmountLogin();

      // 3. Unexpected unauthenticated non-login handheld render -> UNSOUND_CONDITION + login-outlet-only
      debugSpy.mockClear();
      warnSpy.mockClear();
      resetAdminRootBranchTelemetryForTest();

      const UnauthNonLoginStub = createRoutesStub([
        {
          id: 'root',
          path: '/cms',
          loader: () => ({
            runtimeSeo: { siteUrl: 'https://admin.andrew-k.us' },
            correlationId: 'corr-admin-mobile-unauth-guard',
            isLoginRoute: false,
            session: null,
            authMeta: { totpEnabled: false, passkeyCount: 0 },
            rootPayload: Promise.resolve<StreamResult<AdminRootLoaderData>>({
              ok: true,
              data: ADMIN_ROOT_FIXTURE,
            }),
          }),
          Component: AdminRoot,
          ErrorBoundary,
          children: [{ index: true, Component: () => <div>Guarded Outlet</div> }],
        },
      ]);

      render(<UnauthNonLoginStub initialEntries={['/cms']} />);
      expect(await screen.findByText('Guarded Outlet')).toBeTruthy();
      expect(document.querySelector('[data-mobile-tui-dock="true"]')).toBeNull();
      expect(
        warnSpy.mock.calls.some(call => {
          const raw = String(call[0]);
          return (
            raw.includes('admin.root.unauth_mobile_shell_blocked') &&
            raw.includes('"seamType":"UNSOUND_CONDITION"')
          );
        }),
      ).toBe(true);
      expect(
        debugSpy.mock.calls.some(
          call =>
            String(call[0]).includes('admin.root.workspace_mount_branch') &&
            String(call[0]).includes('"branch":"login-outlet-only"'),
        ),
      ).toBe(true);
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
      debugSpy.mockRestore();
      warnSpy.mockRestore();
      fetchSpy.mockRestore();
    }
  });

  it('reports ui.lazy_chunk.load_failed via reportAdminLazyChunkError', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const track = vi.fn<(...args: unknown[]) => void>();
    initAdminClientTelemetry({
      enabled: true,
      sessionId: 'test-admin-session',
      track,
      startWebVitals: () => {},
      flush: () => {},
    });

    try {
      const decision = reportAdminLazyChunkError(
        '@aklapper/ui/sandboxed-artifact-frame',
        '/ops',
        new TypeError('Failed to fetch dynamically imported module'),
      );
      expect(decision).toBe('emit');
      expect(errorSpy).toHaveBeenCalledWith(
        JSON.stringify({
          event: 'ui.lazy_chunk.load_failed',
          module: '@aklapper/ui/sandboxed-artifact-frame',
          pathname: '/ops',
        }),
      );
      expect(track).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
