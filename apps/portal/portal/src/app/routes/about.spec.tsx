import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { PortalAboutLoaderData } from '@aklapper/core';
import { getPrerenderPortalAboutData } from '@aklapper/db';
import { requestContextKey, type SsrStructuredLogger } from '@aklapper/node-runtime/ssr/stream';
import { render, screen } from '@testing-library/react';
import { createRoutesStub, RouterContextProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { loadPortalAboutMock } = vi.hoisted(() => ({
  loadPortalAboutMock: vi.fn<() => Promise<PortalAboutLoaderData>>(),
}));

vi.mock('@aklapper/db', async importOriginal => {
  const actual = await importOriginal<typeof import('@aklapper/db')>();
  return {
    ...actual,
    loadPortalAboutDataWithPrerender: loadPortalAboutMock,
  };
});

import PortalAboutRoute, {
  ErrorBoundary as AboutErrorBoundary,
  loader as aboutLoader,
  meta as aboutMeta,
} from './about';

function makeContext(correlationId: string) {
  const errorCalls: Array<Record<string, unknown>> = [];
  const logger: SsrStructuredLogger = {
    info: vi.fn<(obj: Record<string, unknown>, msg?: string) => void>(),
    warn: vi.fn<(obj: Record<string, unknown>, msg?: string) => void>(),
    error: vi.fn<(obj: Record<string, unknown>, msg?: string) => void>(obj => {
      errorCalls.push(obj);
    }),
  };
  const context = new RouterContextProvider();
  context.set(requestContextKey, {
    correlationId,
    logger,
    serviceName: 'portal-ssr',
    signal: new AbortController().signal,
  });
  return { context, errorCalls };
}

describe('Portal /about streaming SSR route', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('returns deferred stream envelope synchronously with SEO metadata and sitemap entry', async () => {
    const pending = Promise.withResolvers<PortalAboutLoaderData>();
    loadPortalAboutMock.mockReturnValueOnce(pending.promise);
    const { context } = makeContext('corr-about-200');

    const loaderRes = aboutLoader({
      request: new Request('https://andrew-k.us/about'),
      params: {},
      context,
      url: new URL('https://andrew-k.us/about'),
      pattern: '/about',
    });

    expect(loaderRes.correlationId).toBe('corr-about-200');
    expect(loaderRes.payload).toBeInstanceOf(Promise);

    const tags = aboutMeta({
      loaderData: loaderRes,
      matches: [
        {
          id: 'root',
          params: {},
          pathname: '/',
          meta: [],
          loaderData: {
            runtimeSeo: { siteUrl: 'https://andrew-k.us' },
            correlationId: 'corr-root',
            initialViewport: 'desktop',
            isNotFound: false,
            rootPayload: Promise.withResolvers<never>().promise,
          },
        },
        { id: 'routes/about', params: {}, pathname: '/about', meta: [], loaderData: loaderRes },
      ],
      location: { pathname: '/about', search: '', hash: '', state: null, key: 'a1' },
      params: {},
    });

    expect(tags).toContainEqual({ title: 'About Andrew Klapper // andrew-k.us' });
    expect(tags).toContainEqual({ name: 'robots', content: 'index, follow' });
    expect(tags).toContainEqual({ property: 'og:url', content: 'https://andrew-k.us/about' });

    const sitemapXml = readFileSync(resolve(import.meta.dirname, '../../../public/sitemap.xml'), 'utf8');
    expect(sitemapXml).toContain('<loc>https://andrew-k.us/about</loc>');

    const Stub = createRoutesStub([
      {
        path: '/about',
        loader: () => loaderRes,
        Component: PortalAboutRoute,
        ErrorBoundary: AboutErrorBoundary,
      },
    ]);

    render(<Stub initialEntries={['/about']} />);
    expect(await screen.findByRole('status')).toBeTruthy();

    pending.resolve(getPrerenderPortalAboutData());
    expect(await screen.findByRole('heading', { name: 'Andrew Klapper' })).toBeTruthy();
    expect(screen.getByTestId('about-service-link-chat')).toBeTruthy();
  });

  it('classifies live database outages into wire-safe ERR_DB_UNAVAILABLE without leaking SQL', async () => {
    const drizzleErr = Object.assign(
      new Error('Failed query: SELECT * FROM career_dossiers WHERE secret = $1'),
      {
        name: 'DrizzleQueryError',
        cause: Object.assign(new Error('connect ECONNREFUSED 10.128.0.10:5432'), {
          code: 'ECONNREFUSED',
        }),
      },
    );
    loadPortalAboutMock.mockRejectedValueOnce(drizzleErr);
    const { context, errorCalls } = makeContext('corr-about-503');

    const loaderRes = aboutLoader({
      request: new Request('https://andrew-k.us/about'),
      params: {},
      context,
      url: new URL('https://andrew-k.us/about'),
      pattern: '/about',
    });

    const settled = await loaderRes.payload;
    expect(settled).toMatchObject({
      ok: false,
      error: {
        code: 'ERR_DB_UNAVAILABLE',
        status: 503,
        correlationId: 'corr-about-503',
      },
    });
    expect(errorCalls).toHaveLength(1);

    const Stub = createRoutesStub([
      {
        path: '/about',
        loader: () => loaderRes,
        Component: PortalAboutRoute,
        ErrorBoundary: AboutErrorBoundary,
      },
    ]);

    render(<Stub initialEntries={['/about']} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('ERR_DB_UNAVAILABLE');
    expect(alert.textContent).toContain('corr-about-503');
    expect(alert.textContent).not.toContain('career_dossiers');
    expect(alert.textContent).not.toContain('10.128.0.10');

    const BoundaryStub = createRoutesStub([
      {
        path: '/about',
        Component: () => {
          throw new Error('Unexpected render throw at /srv/app/about.tsx:42');
        },
        ErrorBoundary: AboutErrorBoundary,
      },
    ]);
    render(<BoundaryStub initialEntries={['/about']} />);
    const alerts = await screen.findAllByRole('alert');
    const boundaryText = alerts.map(el => el.textContent ?? '').join('\n');
    expect(boundaryText).toContain('ERR_INTERNAL');
    expect(boundaryText).not.toContain('/srv/app/about.tsx');
  });
});
