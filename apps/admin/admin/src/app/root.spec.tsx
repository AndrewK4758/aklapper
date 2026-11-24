import {
  type AdminRootLoaderData,
  createPublicAppError,
  isPublicAppError,
  type StreamResult,
} from '@aklapper/core';
import { requestContextKey } from '@aklapper/node-runtime/ssr/stream';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRoutesStub, RouterContextProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  resolveAdminSessionFromRequest: vi.fn<(request: Request) => Promise<unknown>>(),
}));

const dbMocks = vi.hoisted(() => ({
  loadAdminRootDataWithPrerender: vi.fn<() => Promise<AdminRootLoaderData>>(),
}));

vi.mock('@aklapper/db/auth', () => authMocks);
vi.mock('@aklapper/db', async importOriginal => {
  const actual = await importOriginal<typeof import('@aklapper/db')>();
  return {
    ...actual,
    loadAdminRootDataWithPrerender: dbMocks.loadAdminRootDataWithPrerender,
  };
});

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
    expect(screen.queryByText('andrew-k.us :: tty1')).toBeNull();
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

  it('redirects unauthenticated requests with HTTP 302 before calling loadAdminRootDataWithPrerender', async () => {
    authMocks.resolveAdminSessionFromRequest.mockResolvedValueOnce({
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
    expect(dbMocks.loadAdminRootDataWithPrerender).not.toHaveBeenCalled();
  });

  it('redirects authenticated admins away from /login to sanitized next target', async () => {
    authMocks.resolveAdminSessionFromRequest.mockResolvedValueOnce({
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
    expect(dbMocks.loadAdminRootDataWithPrerender).not.toHaveBeenCalled();
  });

  it('streams deferred rootPayload after auth succeeds and omits terminal on /login', async () => {
    authMocks.resolveAdminSessionFromRequest.mockResolvedValueOnce({
      authenticated: false,
      session: null,
      totpEnabled: false,
      passkeyCount: 0,
    });
    const pending = Promise.withResolvers<AdminRootLoaderData>();
    dbMocks.loadAdminRootDataWithPrerender.mockReturnValueOnce(pending.promise);

    const result = await loader(makeAdminLoaderArgs('http://localhost:4301/login'));

    expect(result.session).toBeNull();
    expect(result.isLoginRoute).toBe(true);
    expect(result.rootPayload).toBeInstanceOf(Promise);

    pending.resolve({
      ...ADMIN_ROOT_FIXTURE,
      terminal: { slug: 'admin-ops' } as AdminRootLoaderData['terminal'],
    });
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
  });

  it('classifies DB outages during session verification to HTTP 503 data error and renders via ErrorBoundary', async () => {
    type LogFn = (obj: Record<string, unknown>, msg?: string) => void;
    const logger = { info: vi.fn<LogFn>(), warn: vi.fn<LogFn>(), error: vi.fn<LogFn>() };
    const context = new RouterContextProvider();
    context.set(requestContextKey, {
      correlationId: 'corr-root-auth-503',
      logger,
      serviceName: 'admin-ssr',
      signal: new AbortController().signal,
    });
    authMocks.resolveAdminSessionFromRequest.mockRejectedValueOnce(
      new Error('connection terminated unexpectedly'),
    );

    const thrown = await loader(
      makeAdminLoaderArgs('http://localhost:4301/analytics', {
        headers: { cookie: 'ak_admin_session=active-token' },
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
        code: 'ERR_DB_UNAVAILABLE',
        correlationId: 'corr-root-auth-503',
      }),
    );
    expect(logger.error).toHaveBeenCalledTimes(1);

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
    expect(alert.textContent).toContain('ERR_DB_UNAVAILABLE');
    expect(alert.textContent).toContain('corr-root-auth-503');
    expect(alert.textContent).not.toContain('connection terminated');
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
    expect(screen.queryByText('andrew-k.us :: tty1')).toBeNull();
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
});
