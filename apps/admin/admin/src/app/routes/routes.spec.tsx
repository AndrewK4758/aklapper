import {
  type AdminOpsLoaderData,
  type AdminOverviewLoaderData,
  type AdminRootLoaderData,
  createPublicAppError,
  isPublicAppError,
  type StreamResult,
} from '@aklapper/core';
import { ADMIN_OPS_TERMINAL_PROFILE } from '@aklapper/db';
import { requestContextKey } from '@aklapper/node-runtime/ssr/stream';
import { fireEvent, render, screen } from '@testing-library/react';
import { createRoutesStub, RouterContextProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  resolveAdminSessionFromRequest: vi.fn<(request: Request) => Promise<unknown>>(),
}));

vi.mock('@aklapper/db/auth', () => authMocks);

import {
  fetchQdrantStatus,
  QDRANT_REINDEX_TIMEOUT_MS,
  triggerQdrantReindex,
} from '../admin-ops.server';
import AdminRoot from '../root';
import { ADMIN_ROBOTS_DIRECTIVE, buildAdminPageMeta } from '../seo';
import {
  ADMIN_ANALYTICS_FIXTURE,
  ADMIN_CMS_FIXTURE,
  ADMIN_INBOX_FIXTURE,
  ADMIN_OPS_FIXTURE,
  ADMIN_OVERVIEW_FIXTURE,
  ADMIN_QUOTAS_FIXTURE,
  AUTH_STATUS,
  QDRANT_FIXTURE,
  UNAUTH_STATUS,
} from './admin-test-fixtures';
import AdminAnalyticsRoute, {
  ErrorBoundary as AnalyticsErrorBoundary,
  loader as analyticsLoader,
  meta as analyticsMeta,
} from './analytics';
import { loader as opsStreamLoader } from './api.ops.cluster.stream';
import AdminCmsRoute, { ErrorBoundary as CmsErrorBoundary, loader as cmsLoader } from './cms';
import AdminHomeRoute, { loader as homeLoader, meta as homeMeta } from './home';
import AdminInboxRoute, { loader as inboxLoader } from './inbox';
import { loader as attachmentLoader } from './inbox.$id.attachment';
import AdminLoginRoute, { loader as loginLoader } from './login';
import AdminOpsRoute, { loader as opsLoader } from './ops';
import AdminQuotasRoute, { loader as quotasLoader } from './quotas';

type LogFn = (obj: Record<string, unknown>, msg?: string) => void;

function makeArgs(
  urlStr: string,
  pattern: string,
  params: Record<string, string> = {},
  context = new RouterContextProvider(),
) {
  return {
    request: new Request(urlStr),
    url: new URL(urlStr),
    pattern,
    unstable_pattern: pattern,
    params,
    context,
  };
}

describe('Admin streaming routes, auth guards & SEO', () => {
  const originalDatabaseUrl = process.env['DATABASE_URL'];

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env['DATABASE_URL'];
    } else {
      process.env['DATABASE_URL'] = originalDatabaseUrl;
    }
    vi.clearAllMocks();
  });

  it('streams AdminHomeRoute loading state and then renders overview content', async () => {
    const deferred = Promise.withResolvers<StreamResult<AdminOverviewLoaderData>>();
    const Stub = createRoutesStub([
      {
        path: '/',
        loader: () => ({ correlationId: 'corr-home', payload: deferred.promise }),
        Component: AdminHomeRoute,
      },
    ]);

    render(<Stub initialEntries={['/']} />);
    expect(await screen.findByRole('status')).toBeTruthy();

    deferred.resolve({ ok: true, data: ADMIN_OVERVIEW_FIXTURE });
    expect(await screen.findByRole('heading', { name: 'Admin Operations Console' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Telemetry View' }).getAttribute('href')).toBe(
      '/analytics',
    );
    expect(screen.getByText(/CADENCE Builder/)).toBeTruthy();
  });

  it('streams AdminAnalyticsRoute, AdminInboxRoute, AdminQuotasRoute, AdminCmsRoute, and AdminOpsRoute', async () => {
    const okLoader =
      <T,>(correlationId: string, data: T) =>
      () => ({
        correlationId,
        payload: Promise.resolve<StreamResult<T>>({ ok: true, data }),
      });
    const Stub = createRoutesStub([
      {
        path: '/analytics',
        loader: okLoader('corr-analytics', ADMIN_ANALYTICS_FIXTURE),
        Component: AdminAnalyticsRoute,
      },
      {
        path: '/inbox',
        loader: okLoader('corr-inbox', ADMIN_INBOX_FIXTURE),
        Component: AdminInboxRoute,
      },
      {
        path: '/quotas',
        loader: okLoader('corr-quotas', ADMIN_QUOTAS_FIXTURE),
        Component: AdminQuotasRoute,
      },
      {
        path: '/cms',
        loader: okLoader('corr-cms', { cms: ADMIN_CMS_FIXTURE, qdrant: QDRANT_FIXTURE }),
        Component: AdminCmsRoute,
      },
      { path: '/ops', loader: okLoader('corr-ops', ADMIN_OPS_FIXTURE), Component: AdminOpsRoute },
    ]);

    const r1 = render(<Stub initialEntries={['/analytics']} />);
    expect(await screen.findByText(/node-api-analytics/i)).toBeTruthy();
    expect(screen.getByText('150 / 150')).toBeTruthy();
    r1.unmount();

    const r2 = render(<Stub initialEntries={['/inbox']} />);
    expect(await screen.findByText('SHA-256 Verified')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Download spec.txt' }).getAttribute('href')).toBe(
      '/inbox/11111111-1111-4111-8111-111111111111/attachment',
    );
    r2.unmount();

    const r3 = render(<Stub initialEntries={['/quotas']} />);
    expect(await screen.findByText('Role Policy: guest')).toBeTruthy();
    expect(screen.getByText('session:demo-1')).toBeTruthy();
    r3.unmount();

    const r4 = render(<Stub initialEntries={['/cms']} />);
    expect(await screen.findByText(/Maintenance Mode Default/i)).toBeTruthy();
    const agensiTab = screen.getByRole('tab', { name: /Agensi & Presets/i });
    expect(agensiTab).toBeTruthy();
    fireEvent.click(agensiTab);
    expect(screen.getByRole('button', { name: 'Sync Agensi Catalog' })).toBeTruthy();
    expect(screen.getByText('cadence-governed-agentic-sdlc-framework')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save Agensi Skill' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'New Skill' })).toBeNull();
    r4.unmount();

    render(<Stub initialEntries={['/ops']} />);
    expect(await screen.findByText('Namespace: cadence-admin')).toBeTruthy();
  });

  it('rejects unauthenticated direct loader calls with HTTP 401 across all 6 protected child routes and 2 resource routes', async () => {
    authMocks.resolveAdminSessionFromRequest.mockResolvedValue(UNAUTH_STATUS);

    const protectedCalls = [
      () => homeLoader(makeArgs('http://localhost:4301/', '/') as never),
      () => analyticsLoader(makeArgs('http://localhost:4301/analytics', '/analytics') as never),
      () => cmsLoader(makeArgs('http://localhost:4301/cms', '/cms') as never),
      () => inboxLoader(makeArgs('http://localhost:4301/inbox', '/inbox') as never),
      () => quotasLoader(makeArgs('http://localhost:4301/quotas', '/quotas') as never),
      () => opsLoader(makeArgs('http://localhost:4301/ops', '/ops') as never),
      () =>
        attachmentLoader(
          makeArgs('http://localhost:4301/inbox/sub-1/attachment', '/inbox/:id/attachment', {
            id: 'sub-1',
          }) as never,
        ),
      () =>
        opsStreamLoader(
          makeArgs(
            'http://localhost:4301/api/ops/cluster/stream',
            '/api/ops/cluster/stream',
          ) as never,
        ),
    ];

    for (const invoke of protectedCalls) {
      const thrown = await invoke().catch((err: unknown) => err);
      expect(thrown).toBeInstanceOf(Response);
      expect((thrown as Response).status).toBe(401);
    }
  });

  it('classifies auth DB outages to HTTP 503 and settles missing DATABASE_URL lazily into StreamResult failure', async () => {
    const logger = { info: vi.fn<LogFn>(), warn: vi.fn<LogFn>(), error: vi.fn<LogFn>() };
    const context = new RouterContextProvider();
    context.set(requestContextKey, {
      correlationId: 'corr-child-503',
      logger,
      serviceName: 'admin-ssr',
      signal: new AbortController().signal,
    });
    authMocks.resolveAdminSessionFromRequest.mockRejectedValueOnce(
      new Error('connection terminated'),
    );

    const cmsThrown = await cmsLoader(
      makeArgs('http://localhost:4301/cms', '/cms', {}, context) as never,
    ).catch((err: unknown) => err);
    const dataErr = cmsThrown as { data?: unknown; init?: { status?: number } };
    expect(dataErr.init?.status).toBe(503);
    expect(isPublicAppError(dataErr.data)).toBe(true);

    authMocks.resolveAdminSessionFromRequest.mockRejectedValueOnce(
      new Error('connection terminated'),
    );
    const attThrown = await attachmentLoader(
      makeArgs(
        'http://localhost:4301/inbox/sub-1/attachment',
        '/inbox/:id/attachment',
        { id: 'sub-1' },
        context,
      ) as never,
    ).catch((err: unknown) => err);
    expect(attThrown).toBeInstanceOf(Response);
    expect((attThrown as Response).status).toBe(503);
    expect((attThrown as Response).headers.get('X-Correlation-Id')).toBe('corr-child-503');

    delete process.env['DATABASE_URL'];
    authMocks.resolveAdminSessionFromRequest.mockResolvedValueOnce(AUTH_STATUS);
    const deferredResult = await cmsLoader(
      makeArgs('http://localhost:4301/cms', '/cms', {}, context) as never,
    );
    const settled = await deferredResult.payload;
    expect(settled).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({
          code: 'ERR_DB_UNAVAILABLE',
          correlationId: 'corr-child-503',
        }),
      }),
    );
  });

  it('renders ErrorElement on settled StreamResult error and isolates render crash in child ErrorBoundary', async () => {
    const dbErr = createPublicAppError({
      code: 'ERR_DB_UNAVAILABLE',
      status: 503,
      message: 'Database temporarily unavailable.',
      action: 'Retry shortly or share ID.',
      correlationId: 'corr-cms-stream-503',
    });

    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: () => ({
          runtimeSeo: { siteUrl: 'https://admin.andrew-k.us' },
          correlationId: 'corr-root',
          isLoginRoute: false,
          session: AUTH_STATUS.session,
          authMeta: { totpEnabled: true, passkeyCount: 1 },
          rootPayload: Promise.resolve<StreamResult<AdminRootLoaderData>>({
            ok: true,
            data: {
              chrome: {
                pageTitle: 'admin.andrew-k.us // Solar Forge Ops',
                brandLabel: 'admin.andrew-k.us',
                shortcutHint: 'Ctrl+⇧} / ⌘D split · Ctrl+⇧{ / ⌘⇧D hsplit · Alt+⇧T tab',
                statusBadge: { source: 'passkey-gate', state: 'ready', label: 'isolated ops' },
              },
              terminal: ADMIN_OPS_TERMINAL_PROFILE,
            },
          }),
        }),
        Component: AdminRoot,
        children: [
          {
            path: 'cms',
            loader: () => ({
              correlationId: 'corr-cms-stream-503',
              payload: Promise.resolve({ ok: false as const, error: dbErr }),
            }),
            Component: AdminCmsRoute,
            ErrorBoundary: CmsErrorBoundary,
          },
          {
            path: 'analytics',
            Component: () => {
              throw new Error('Child analytics render crash');
            },
            ErrorBoundary: AnalyticsErrorBoundary,
          },
        ],
      },
    ]);

    const first = render(<Stub initialEntries={['/cms']} />);
    const cmsAlert = await screen.findByRole('alert');
    expect(cmsAlert.textContent).toContain('ERR_DB_UNAVAILABLE');
    expect(cmsAlert.textContent).toContain('corr-cms-stream-503');
    first.unmount();

    const { container } = render(<Stub initialEntries={['/analytics']} />);
    const boundaryAlert = await screen.findByRole('alert');
    expect(boundaryAlert.textContent).toContain('ERR_INTERNAL');
    expect(screen.getByText('admin.andrew-k.us')).toBeTruthy();
    expect(screen.getByText('Ctrl+⇧} / ⌘D split · Ctrl+⇧{ / ⌘⇧D hsplit · Alt+⇧T tab')).toBeTruthy();

    const workspaceEl = container.querySelector('[data-pane-count]') as HTMLElement;
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');
    fireEvent.keyDown(window, { key: '{', code: 'BracketLeft', ctrlKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');

    const input = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'whoami' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(screen.getByText('admin@andrew-k.us (isolated ops shell)')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'W', ctrlKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');
  });

  it('computes synchronous meta tags without awaiting loader payloads and sanitizes AdminLoginRoute nextTarget', async () => {
    const matches = [
      {
        id: 'root',
        params: {},
        pathname: '/',
        meta: [],
        loaderData: { runtimeSeo: { siteUrl: 'https://ops.andrew-k.us' } },
      },
    ];
    const tags = buildAdminPageMeta({
      matches,
      pathname: '/analytics',
      title: 'Analytics Telemetry // admin.andrew-k.us',
      description: 'First-party analytics.',
    });
    expect(tags).toContainEqual({ name: 'robots', content: ADMIN_ROBOTS_DIRECTIVE });
    expect(tags).toContainEqual({
      property: 'og:url',
      content: 'https://ops.andrew-k.us/analytics',
    });

    const homeTags = homeMeta({
      matches,
      location: { pathname: '/', search: '', hash: '', state: null, key: 'h1' },
      params: {},
      loaderData: undefined,
    } as never);
    const analyticsTags = analyticsMeta({
      matches,
      location: { pathname: '/analytics', search: '', hash: '', state: null, key: 'a1' },
      params: {},
      loaderData: undefined,
    } as never);
    expect(homeTags).toContainEqual({ name: 'robots', content: ADMIN_ROBOTS_DIRECTIVE });
    expect(analyticsTags).toContainEqual({ name: 'robots', content: ADMIN_ROBOTS_DIRECTIVE });

    const safeResult = loginLoader(
      makeArgs('http://localhost:4301/login?next=https://evil.example/phish', '/login') as never,
    );
    expect(safeResult.nextTarget).toBe('/');

    const Stub = createRoutesStub([
      {
        path: '/login',
        loader: () => ({ nextTarget: '/analytics', correlationId: 'corr-login' }),
        Component: AdminLoginRoute,
      },
    ]);
    render(<Stub initialEntries={['/login']} />);
    expect(await screen.findByRole('heading', { name: 'Admin Passkey Gate' })).toBeTruthy();
  });

  it('forwards api-key on direct Qdrant probe, honors 90s reindex timeout, and renders multi-collection breakdown', async () => {
    const prevAiAsk = process.env['AI_ASK_URL'];
    const prevQdrantUrl = process.env['QDRANT_URL'];
    const prevQdrantKey = process.env['QDRANT_API_KEY'];

    const seenHeaders: Array<string | null> = [];
    const seenUrls: string[] = [];
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    let reindexHasSignal = false;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      seenUrls.push(url);
      seenHeaders.push(new Headers(init?.headers).get('api-key'));
      if (url.endsWith('/collections/portfolio_docs')) {
        return Response.json({ result: { status: 'green', points_count: 11 } });
      }
      if (url.endsWith('/collections/cadence_patterns')) {
        return Response.json({ result: { status: 'green', points_count: 8 } });
      }
      if (url.endsWith('/v1/ask/reindex')) {
        reindexHasSignal = Boolean(init?.signal);
        return Response.json({ indexed: 11, collection: 'portfolio_docs', provider: 'local' });
      }
      return new Response('not found', { status: 404 });
    });

    try {
      delete process.env['AI_ASK_URL'];
      process.env['QDRANT_URL'] = 'http://qdrant.local:6333';
      process.env['QDRANT_API_KEY'] = 'qdrant-secret-api-key';

      const status = await fetchQdrantStatus();
      expect(status.online).toBe(true);
      expect(status.pointsCount).toBe(11);
      expect(status.collections).toEqual([
        { name: 'portfolio_docs', online: true, status: 'green', pointsCount: 11 },
        { name: 'cadence_patterns', online: true, status: 'green', pointsCount: 8 },
      ]);
      expect(seenUrls).toEqual([
        'http://qdrant.local:6333/collections/portfolio_docs',
        'http://qdrant.local:6333/collections/cadence_patterns',
      ]);
      expect(seenHeaders).toEqual(['qdrant-secret-api-key', 'qdrant-secret-api-key']);

      process.env['AI_ASK_URL'] = 'http://ai-ask.local:8083';
      const reindex = await triggerQdrantReindex();
      expect(reindexHasSignal).toBe(true);
      expect(timeoutSpy).toHaveBeenCalledWith(QDRANT_REINDEX_TIMEOUT_MS);
      expect(reindex).toEqual({
        ok: true,
        indexed: 11,
        collection: 'portfolio_docs',
        message: 'Re-indexed 11 documents into portfolio_docs.',
      });

      const multiOpsData: AdminOpsLoaderData = {
        ...ADMIN_OPS_FIXTURE,
        qdrantStatus: status,
      };
      const Stub = createRoutesStub([
        {
          path: '/ops',
          loader: () => ({
            correlationId: 'corr-ops-multi',
            payload: Promise.resolve<StreamResult<AdminOpsLoaderData>>({
              ok: true,
              data: multiOpsData,
            }),
          }),
          Component: AdminOpsRoute,
        },
      ]);
      render(<Stub initialEntries={['/ops']} />);
      expect(await screen.findByText('8 pts (green)')).toBeTruthy();
      expect(screen.getByText('11 pts (green)')).toBeTruthy();
    } finally {
      timeoutSpy.mockRestore();
      fetchSpy.mockRestore();
      if (prevAiAsk === undefined) delete process.env['AI_ASK_URL'];
      else process.env['AI_ASK_URL'] = prevAiAsk;
      if (prevQdrantUrl === undefined) delete process.env['QDRANT_URL'];
      else process.env['QDRANT_URL'] = prevQdrantUrl;
      if (prevQdrantKey === undefined) delete process.env['QDRANT_API_KEY'];
      else process.env['QDRANT_API_KEY'] = prevQdrantKey;
    }
  });
});
