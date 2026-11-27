import {
  type AdminAnalyticsBreakdownsData,
  type AdminAnalyticsSummaryData,
  type AdminOverviewLoaderData,
  type AdminRootLoaderData,
  createPublicAppError,
  isPublicAppError,
  type QdrantHealthStatus,
  type StreamResult,
} from '@aklapper/core';
import { ADMIN_OPS_TERMINAL_PROFILE, closeSharedDb } from '@aklapper/db';
import { INTERNAL_AUTH_HEADER, verifyInternalAuthToken } from '@aklapper/node-runtime/http';
import { requestContextKey } from '@aklapper/node-runtime/ssr/stream';
import { fireEvent, render, screen } from '@testing-library/react';
import { createRoutesStub, RouterContextProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  resolveAdminSessionFromRequest: vi.fn<(request: Request) => Promise<unknown>>(),
}));

const dbSpies = vi.hoisted(() => ({
  listContactSubmissions: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock('@aklapper/db', async importOriginal => {
  const actual = await importOriginal<typeof import('@aklapper/db')>();
  return {
    ...actual,
    listContactSubmissions: (...args: unknown[]) => {
      dbSpies.listContactSubmissions(...args);
      return (actual.listContactSubmissions as (...a: unknown[]) => Promise<unknown>)(...args);
    },
  };
});

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
import { loader as opsRuntimeStatusLoader } from './api.ops.runtime.status';
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

  afterEach(async () => {
    await closeSharedDb();
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
        loader: () => ({
          correlationId: 'corr-analytics',
          summaryPayload: Promise.resolve({
            ok: true as const,
            data: {
              content: ADMIN_ANALYTICS_FIXTURE.content,
              window: ADMIN_ANALYTICS_FIXTURE.window,
              totalSessions: ADMIN_ANALYTICS_FIXTURE.totalSessions,
              totalEvents: ADMIN_ANALYTICS_FIXTURE.totalEvents,
              summary: ADMIN_ANALYTICS_FIXTURE.summary,
              cwv: ADMIN_ANALYTICS_FIXTURE.cwv,
              aiMetrics: ADMIN_ANALYTICS_FIXTURE.aiMetrics,
            },
          }),
          breakdownsPayload: Promise.resolve({
            ok: true as const,
            data: {
              topPaths: ADMIN_ANALYTICS_FIXTURE.topPaths,
              topReferrers: ADMIN_ANALYTICS_FIXTURE.topReferrers,
              geoBreakdown: ADMIN_ANALYTICS_FIXTURE.geoBreakdown,
              agensiConversions: ADMIN_ANALYTICS_FIXTURE.agensiConversions,
            },
          }),
        }),
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
        loader: () => ({
          correlationId: 'corr-cms',
          payload: Promise.resolve({ ok: true as const, data: ADMIN_CMS_FIXTURE }),
          qdrantPayload: Promise.resolve({ ok: true as const, data: QDRANT_FIXTURE }),
        }),
        Component: AdminCmsRoute,
      },
      {
        path: '/ops',
        loader: () => ({
          correlationId: 'corr-ops',
          payload: Promise.resolve({
            ok: true as const,
            data: {
              sandboxRuns: ADMIN_OPS_FIXTURE.sandboxRuns,
            },
          }),
          qdrantStatusPayload: Promise.resolve({
            ok: true as const,
            data: ADMIN_OPS_FIXTURE.qdrantStatus,
          }),
        }),
        Component: AdminOpsRoute,
      },
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
    expect(await screen.findByRole('tab', { name: 'Site Content' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Terminal' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Re-Index Qdrant Corpus' })).toBeTruthy();
    expect(screen.queryByText(/Maintenance Mode Default/i)).toBeNull();
    expect(screen.queryByLabelText('Maintenance Mode')).toBeNull();
    expect(screen.queryByText(/Rebuild Progress/i)).toBeNull();

    const terminalTab = screen.getByRole('tab', { name: 'Terminal' });
    fireEvent.click(terminalTab);
    expect(await screen.findByText('Terminal Profiles')).toBeTruthy();
    expect(screen.queryByText(/Roadmap Milestones/i)).toBeNull();
    const kindOptions = Array.from(document.querySelectorAll('select[name="kind"] option')).map(
      opt => opt.getAttribute('value'),
    );
    expect(kindOptions).not.toContain('roadmap');

    const agensiTab = screen.getByRole('tab', { name: /Agensi & Presets/i });
    expect(agensiTab).toBeTruthy();
    fireEvent.click(agensiTab);
    expect(await screen.findByRole('button', { name: 'Sync Agensi Catalog' })).toBeTruthy();
    expect(screen.getByText('cadence-governed-agentic-sdlc-framework')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save Agensi Skill' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'New Skill' })).toBeNull();
    r4.unmount();

    render(<Stub initialEntries={['/ops']} />);
    expect(await screen.findByText('Cloud Run / Docker Runtime Health')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Refresh Health' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Wake/i })).toBeNull();
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
        opsRuntimeStatusLoader(
          makeArgs(
            'http://localhost:4301/api/ops/runtime/status',
            '/api/ops/runtime/status',
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

    await closeSharedDb();
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
                shortcutHint: 'Ctrl+⇧} / Alt+⇧D split · Ctrl+⇧{ / Alt+⇧S hsplit · Alt+⇧N tab',
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
              qdrantPayload: Promise.resolve({ ok: true as const, data: QDRANT_FIXTURE }),
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
    expect(
      screen.getByText('Ctrl+⇧} / Alt+⇧D split · Ctrl+⇧{ / Alt+⇧S hsplit · Alt+⇧N tab'),
    ).toBeTruthy();

    const workspaceEl = container.querySelector('[data-pane-count]') as HTMLElement;
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');
    fireEvent.keyDown(window, { key: '{', code: 'BracketLeft', ctrlKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');

    const input = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'whoami' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(screen.getByText('admin@andrew-k.us (isolated ops shell)')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'W', code: 'KeyW', altKey: true, shiftKey: true });
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

      const Stub = createRoutesStub([
        {
          path: '/ops',
          loader: () => ({
            correlationId: 'corr-ops-multi',
            payload: Promise.resolve({
              ok: true as const,
              data: {
                sandboxRuns: ADMIN_OPS_FIXTURE.sandboxRuns,
              },
            }),
            qdrantStatusPayload: Promise.resolve({
              ok: true as const,
              data: status,
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

  it('probes direct Qdrant Cloud with api-key header, skips GCP OIDC JWTs, and logs BOUNDARY_FAULT on 401/404', async () => {
    const origAiAsk = process.env['AI_ASK_URL'];
    const origQdrantUrl = process.env['QDRANT_URL'];
    const origQdrantKey = process.env['QDRANT_API_KEY'];
    const requests: Array<{ url: string; apiKey: string | null; authorization: string | null }> =
      [];
    let failWithAuthError = false;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const headers = new Headers(init?.headers);
      requests.push({
        url,
        apiKey: headers.get('api-key'),
        authorization: headers.get('authorization'),
      });
      if (failWithAuthError) {
        return new Response('unauthorized', { status: 401 });
      }
      return Response.json({ result: { status: 'green', points_count: 14 } });
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      delete process.env['AI_ASK_URL'];
      process.env['QDRANT_URL'] = 'https://cluster.example.qdrant.io';
      process.env['QDRANT_API_KEY'] = 'qdrant-cloud-secret';

      const okStatus = await fetchQdrantStatus();
      expect(okStatus.online).toBe(true);
      expect(okStatus.collection).toBe('portfolio_docs');
      expect(okStatus.pointsCount).toBe(14);
      expect(requests[0]).toEqual({
        url: 'https://cluster.example.qdrant.io/collections/portfolio_docs',
        apiKey: 'qdrant-cloud-secret',
        authorization: null,
      });

      failWithAuthError = true;
      const failedStatus = await fetchQdrantStatus();
      expect(failedStatus.online).toBe(false);
      expect(failedStatus.status).toBe('error');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('admin.qdrant_probe.auth_or_collection'),
      );
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('BOUNDARY_FAULT'));
    } finally {
      fetchSpy.mockRestore();
      warnSpy.mockRestore();
      if (origAiAsk === undefined) delete process.env['AI_ASK_URL'];
      else process.env['AI_ASK_URL'] = origAiAsk;
      if (origQdrantUrl === undefined) delete process.env['QDRANT_URL'];
      else process.env['QDRANT_URL'] = origQdrantUrl;
      if (origQdrantKey === undefined) delete process.env['QDRANT_API_KEY'];
      else process.env['QDRANT_API_KEY'] = origQdrantKey;
    }
  });

  it('signs X-Internal-Auth admin token when probing AI_ASK_URL /v1/ask/status', async () => {
    const origAiAsk = process.env['AI_ASK_URL'];
    const origQdrantUrl = process.env['QDRANT_URL'];
    const origSecret = process.env['INTERNAL_AUTH_SECRET'];
    let capturedInternalAuth: string | null = null;
    let capturedUrl = '';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      capturedUrl =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      capturedInternalAuth = new Headers(init?.headers).get(INTERNAL_AUTH_HEADER);
      return Response.json({
        status: 'ready',
        provider: 'vertex',
        pgConnected: true,
        collection: { name: 'portfolio_docs', status: 'green', pointsCount: 9 },
      });
    });

    try {
      delete process.env['QDRANT_URL'];
      process.env['AI_ASK_URL'] = 'http://127.0.0.1:8083';
      process.env['INTERNAL_AUTH_SECRET'] = 'admin-ops-test-secret';

      const status = await fetchQdrantStatus();
      expect(status.online).toBe(true);
      expect(status.pointsCount).toBe(9);
      expect(capturedUrl).toBe('http://127.0.0.1:8083/v1/ask/status');
      const claims = verifyInternalAuthToken(capturedInternalAuth, 'admin-ops-test-secret');
      expect(claims?.role).toBe('admin');
      expect(claims?.sub).toBe('admin-console-status');
    } finally {
      fetchSpy.mockRestore();
      if (origAiAsk === undefined) delete process.env['AI_ASK_URL'];
      else process.env['AI_ASK_URL'] = origAiAsk;
      if (origQdrantUrl === undefined) delete process.env['QDRANT_URL'];
      else process.env['QDRANT_URL'] = origQdrantUrl;
      if (origSecret === undefined) delete process.env['INTERNAL_AUTH_SECRET'];
      else process.env['INTERNAL_AUTH_SECRET'] = origSecret;
    }
  });

  it('paints primary /cms, /ops, and /analytics controls while secondary slots stream or fail independently', async () => {
    const qdrantCmsDeferred = Promise.withResolvers<StreamResult<QdrantHealthStatus>>();
    const qdrantOpsErr = createPublicAppError({
      code: 'ERR_UPSTREAM_UNAVAILABLE',
      status: 503,
      message: 'Upstream service unreachable.',
      action: 'Retry shortly or go home.',
      correlationId: 'corr-ops-qdrant-503',
    });
    const breakdownsDeferred = Promise.withResolvers<StreamResult<AdminAnalyticsBreakdownsData>>();

    const summaryData: AdminAnalyticsSummaryData = {
      content: ADMIN_ANALYTICS_FIXTURE.content,
      window: ADMIN_ANALYTICS_FIXTURE.window,
      totalSessions: ADMIN_ANALYTICS_FIXTURE.totalSessions,
      totalEvents: ADMIN_ANALYTICS_FIXTURE.totalEvents,
      summary: ADMIN_ANALYTICS_FIXTURE.summary,
      cwv: ADMIN_ANALYTICS_FIXTURE.cwv,
      aiMetrics: ADMIN_ANALYTICS_FIXTURE.aiMetrics,
    };

    const Stub = createRoutesStub([
      {
        path: '/cms',
        loader: () => ({
          correlationId: 'corr-cms-split',
          payload: Promise.resolve({ ok: true as const, data: ADMIN_CMS_FIXTURE }),
          qdrantPayload: qdrantCmsDeferred.promise,
        }),
        Component: AdminCmsRoute,
      },
      {
        path: '/ops',
        loader: () => ({
          correlationId: 'corr-ops-qdrant-503',
          payload: Promise.resolve({
            ok: true as const,
            data: {
              sandboxRuns: ADMIN_OPS_FIXTURE.sandboxRuns,
            },
          }),
          qdrantStatusPayload: Promise.resolve<StreamResult<QdrantHealthStatus>>({
            ok: false,
            error: qdrantOpsErr,
          }),
        }),
        Component: AdminOpsRoute,
      },
      {
        path: '/analytics',
        loader: () => ({
          correlationId: 'corr-analytics-split',
          summaryPayload: Promise.resolve<StreamResult<AdminAnalyticsSummaryData>>({
            ok: true,
            data: summaryData,
          }),
          breakdownsPayload: breakdownsDeferred.promise,
        }),
        Component: AdminAnalyticsRoute,
      },
    ]);

    const cmsView = render(<Stub initialEntries={['/cms']} />);
    expect(await screen.findByText('Qdrant Corpus Index')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Re-Index Qdrant Corpus' })).toBeTruthy();
    expect(screen.getByText(/Checking Qdrant/i)).toBeTruthy();
    qdrantCmsDeferred.resolve({
      ok: true,
      data: { ...QDRANT_FIXTURE, online: true, pointsCount: 42 },
    });
    expect(
      await screen.findByText(new RegExp(`${QDRANT_FIXTURE.collection}: 42 pts`, 'i')),
    ).toBeTruthy();
    cmsView.unmount();

    const opsView = render(<Stub initialEntries={['/ops']} />);
    expect(await screen.findByText('Cloud Run / Docker Runtime Health')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Re-Index portfolio_docs' })).toBeTruthy();
    const opsAlert = await screen.findByRole('alert');
    expect(opsAlert.textContent).toContain('corr-ops-qdrant-503');
    opsView.unmount();

    const analyticsView = render(<Stub initialEntries={['/analytics']} />);
    expect(await screen.findByText('AI / CADENCE Gate & Abstention Metrics')).toBeTruthy();
    expect(screen.getByText('150 / 150')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Loading analytics breakdowns');
    breakdownsDeferred.resolve({
      ok: true,
      data: {
        topPaths: ADMIN_ANALYTICS_FIXTURE.topPaths,
        topReferrers: ADMIN_ANALYTICS_FIXTURE.topReferrers,
        geoBreakdown: ADMIN_ANALYTICS_FIXTURE.geoBreakdown,
        agensiConversions: ADMIN_ANALYTICS_FIXTURE.agensiConversions,
      },
    });
    expect(await screen.findByText(/node-api-analytics/i)).toBeTruthy();
    analyticsView.unmount();
  });

  it('parses all 7 analytics URL filters, emits UNSOUND_CONDITION on clamped params, and forwards selectedId on /inbox', async () => {
    const origPrerender = process.env['IS_RR_BUILD_REQUEST'];
    const origDbUrl = process.env['DATABASE_URL'];
    try {
      await closeSharedDb();
      delete process.env['DATABASE_URL'];
      process.env['IS_RR_BUILD_REQUEST'] = 'yes';
      authMocks.resolveAdminSessionFromRequest.mockResolvedValue(AUTH_STATUS);

      const logger = { info: vi.fn<LogFn>(), warn: vi.fn<LogFn>(), error: vi.fn<LogFn>() };
      const context = new RouterContextProvider();
      context.set(requestContextKey, {
        correlationId: 'corr-filter-clamp',
        logger,
        serviceName: 'admin-ssr',
        signal: new AbortController().signal,
      });

      const clampedStream = await analyticsLoader(
        makeArgs(
          'http://localhost:4301/analytics?window=999y&bots=invalid&identified=nope&country=US&source=linkedin.com',
          '/analytics',
          {},
          context,
        ) as never,
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          seam_type: 'UNSOUND_CONDITION',
          event: 'admin.analytics.invalid_filter_clamped',
          correlationId: 'corr-filter-clamp',
          clampedFields: expect.arrayContaining(['window', 'bots', 'identified']),
        }),
        expect.any(String),
      );
      expect(clampedStream.filter).toEqual({
        window: '7d',
        bots: 'exclude',
        identified: 'all',
        country: 'US',
        source: 'linkedin.com',
      });
      const [resolvedSummary, resolvedBreakdowns] = await Promise.all([
        clampedStream.summaryPayload,
        clampedStream.breakdownsPayload,
      ]);
      expect(resolvedSummary).toMatchObject({
        ok: true,
        data: { filters: clampedStream.filter },
      });
      expect(resolvedBreakdowns.ok).toBe(true);

      const validStream = await analyticsLoader(
        makeArgs(
          'http://localhost:4301/analytics?window=30d&bots=include&identified=true&path=/about&campaign=fall26',
          '/analytics',
          {},
          context,
        ) as never,
      );
      expect(validStream.filter).toEqual({
        window: '30d',
        bots: 'include',
        identified: 'true',
        path: '/about',
        campaign: 'fall26',
      });
      await Promise.all([validStream.summaryPayload, validStream.breakdownsPayload]);

      // Verify /inbox loader forwards ?selected=<uuid> into listContactSubmissions
      const targetUuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const origUrlForInbox = origDbUrl;
      if (origUrlForInbox) {
        process.env['DATABASE_URL'] = origUrlForInbox;
      } else {
        process.env['DATABASE_URL'] = 'postgres://postgres:postgres@127.0.0.1:1/unused';
      }
      const inboxStream = await inboxLoader(
        makeArgs(
          `http://localhost:4301/inbox?q=ada&page=2&selected=${targetUuid}`,
          '/inbox',
          {},
          context,
        ) as never,
      );
      await inboxStream.payload;
      expect(dbSpies.listContactSubmissions).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: 'ada',
          page: 2,
          pageSize: 20,
          selectedId: targetUuid,
        }),
      );
    } finally {
      await closeSharedDb();
      if (origPrerender === undefined) delete process.env['IS_RR_BUILD_REQUEST'];
      else process.env['IS_RR_BUILD_REQUEST'] = origPrerender;
      if (origDbUrl === undefined) delete process.env['DATABASE_URL'];
      else process.env['DATABASE_URL'] = origDbUrl;
    }
  });
});
