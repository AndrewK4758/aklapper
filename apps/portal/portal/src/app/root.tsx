import './theme.css';
import {
  buildCanonicalUrl,
  buildPortalJsonLd,
  buildRouteMetaTags,
  type DocumentSeoRuntimeConfig,
  isPortalNavigableRoutePath,
  type PortalRootLoaderData,
  type PortalRoutePath,
  readSeoRuntimeConfig,
  type StreamResult,
} from '@aklapper/core';
import { loadPortalRootDataWithPrerender } from '@aklapper/db';
import {
  deferStreamResult,
  getOrCreateCorrelationId,
  getRequestContext,
} from '@aklapper/node-runtime/ssr/stream';
import {
  detectServerViewportMode,
  DirectionProvider,
  DocumentBodyAnalytics,
  DocumentHeadTags,
  RouteErrorBoundaryView,
  type ServerViewportLayoutMode,
  SuspenseElement,
  Tooltip,
  useAnimatedFavicon,
  ViewportHtml,
  ViewportProvider,
} from '@aklapper/ui';
import type { ReactNode } from 'react';
import {
  href,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  type ShouldRevalidateFunctionArgs,
  useLocation,
  useNavigate,
  useRouteError,
  useRouteLoaderData,
} from 'react-router';

import type { Route } from './+types/root';
import { reportPortalPublicError } from './client-telemetry';
import { PortalRootShell } from './PortalRootShell';
import { useRuntimeStatusTelemetry } from './runtime-status';
import { DEFAULT_PORTAL_SITE_URL, PORTAL_SITE_NAME } from './seo';

import styles from './root.module.css';

type RegisteredPortalHrefPath = Exclude<Parameters<typeof href>[0], '/*' | '/api/*'>;
type AssertAssignable<TActual extends TExpected, TExpected> = TActual;
export type PortalRoutePathParityCheck = [
  AssertAssignable<PortalRoutePath, RegisteredPortalHrefPath>,
  AssertAssignable<RegisteredPortalHrefPath, PortalRoutePath>,
];

export interface PortalRootStreamData {
  readonly runtimeSeo: DocumentSeoRuntimeConfig;
  readonly correlationId: string;
  readonly initialViewport: ServerViewportLayoutMode;
  readonly isNotFound: boolean;
  readonly rootPayload: Promise<StreamResult<PortalRootLoaderData>> | null;
}

function normalizePathname(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

function resolveLoaderPathname(request: Request): string {
  const rawPathname = new URL(request.url).pathname;
  // React Router Single Fetch passes raw `.data` request paths into server loaders
  // (`/_.data` / `/_root.data` for `/` and `/<route>.data` for child routes).
  if (rawPathname === '/_.data' || rawPathname === '/_root.data') {
    return '/';
  }
  if (rawPathname.endsWith('/_.data')) {
    return normalizePathname(rawPathname.slice(0, -'/_.data'.length));
  }
  if (rawPathname.endsWith('.data')) {
    return normalizePathname(rawPathname.slice(0, -'.data'.length));
  }
  return normalizePathname(rawPathname);
}

export function isNavigablePath(pathname: string): boolean {
  return isPortalNavigableRoutePath(normalizePathname(pathname).toLowerCase());
}

export function loader({ request, context }: Route.LoaderArgs): PortalRootStreamData {
  const correlationId = getOrCreateCorrelationId(request, context);
  const initialViewport = detectServerViewportMode(request.headers);
  const runtimeSeo = readSeoRuntimeConfig({
    defaultSiteUrl: DEFAULT_PORTAL_SITE_URL,
    siteUrlEnvKey: 'PUBLIC_PORTAL_URL',
  });
  const pathname = resolveLoaderPathname(request);
  const isNotFound = !isNavigablePath(pathname);

  getRequestContext(context)?.logger.info(
    {
      seam_type: 'RULE_DIVERGENCE',
      event: 'portal.routing.unmatched_route_branch',
      branch: isNotFound ? 'not_found_zero_db_404' : 'navigable_route_stream',
      correlationId,
    },
    'Portal root route branch selected',
  );

  if (isNotFound) {
    return {
      runtimeSeo,
      correlationId,
      initialViewport,
      isNotFound: true,
      rootPayload: null,
    };
  }

  return {
    runtimeSeo,
    correlationId,
    initialViewport,
    isNotFound: false,
    rootPayload: deferStreamResult(loadPortalRootDataWithPrerender(), {
      request,
      context,
      source: 'portal.root.loader',
    }),
  };
}

export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formAction,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs): boolean {
  const currentPath = normalizePathname(currentUrl.pathname);
  const nextPath = normalizePathname(nextUrl.pathname);
  if (isNavigablePath(currentPath) !== isNavigablePath(nextPath)) {
    return true;
  }
  if (currentPath === nextPath && !formAction) {
    return defaultShouldRevalidate;
  }
  return false;
}

export function meta({ loaderData, location, error }: Route.MetaArgs) {
  const siteUrl = loaderData?.runtimeSeo?.siteUrl ?? DEFAULT_PORTAL_SITE_URL;
  const pathname = normalizePathname(location.pathname);
  const isNotFound = Boolean(loaderData?.isNotFound) || !isNavigablePath(pathname);
  const isErrorOrNotFound = Boolean(error) || isNotFound;

  return buildRouteMetaTags({
    title: isNotFound
      ? `Not Found // ${PORTAL_SITE_NAME}`
      : isErrorOrNotFound
        ? `Error // ${PORTAL_SITE_NAME}`
        : 'andrew-k.us // Solar Forge Terminal',
    description: isNotFound
      ? 'The requested page could not be found on andrew-k.us.'
      : isErrorOrNotFound
        ? 'An error occurred while loading andrew-k.us.'
        : 'Interactive Solar Forge portfolio terminal, CADENCE sandboxed artifact builder, and Cloud Run scale-to-zero Go microservices showcase by Andrew Klapper.',
    siteName: PORTAL_SITE_NAME,
    siteUrl,
    pathname,
    robots: isErrorOrNotFound ? 'noindex, nofollow' : 'index, follow',
  });
}

export function Layout({ children }: { children: ReactNode }) {
  const rootData = useRouteLoaderData<typeof loader>('root');
  const routeError = useRouteError();
  const location = useLocation();
  const pathname = normalizePathname(location.pathname);
  const siteUrl = rootData?.runtimeSeo?.siteUrl ?? DEFAULT_PORTAL_SITE_URL;
  const isErrorOrNotFound =
    Boolean(routeError) || Boolean(rootData?.isNotFound) || !isNavigablePath(pathname);
  const canonicalUrl = buildCanonicalUrl(siteUrl, pathname);

  return (
    <ViewportProvider initialMode={rootData?.initialViewport ?? 'desktop'}>
      <ViewportHtml lang='en' data-theme='solar-forge'>
        <head>
          <DocumentHeadTags
            applicationName='andrew-k.us // Solar Forge'
            canonicalUrl={canonicalUrl}
            robots={isErrorOrNotFound ? 'noindex, nofollow' : 'index, follow'}
            analyticsApp='portal'
            runtimeSeo={rootData?.runtimeSeo}
            jsonLd={isErrorOrNotFound ? undefined : buildPortalJsonLd(siteUrl)}
          />
          {rootData?.correlationId ? (
            <meta name='aklapper-correlation-id' content={rootData.correlationId} />
          ) : null}
          <Meta />
          <Links />
        </head>
        <body>
          <DocumentBodyAnalytics gtmId={rootData?.runtimeSeo?.gtmId} />
          {children}
          <ScrollRestoration />
          <Scripts />
        </body>
      </ViewportHtml>
    </ViewportProvider>
  );
}

interface PortalWorkspaceRootProps {
  readonly rootPayload: Promise<StreamResult<PortalRootLoaderData>>;
  readonly correlationId: string;
  readonly pathname: string;
  readonly locationKey: string;
}

function PortalWorkspaceRoot({
  rootPayload,
  correlationId,
  pathname,
  locationKey,
}: PortalWorkspaceRootProps) {
  const runtimeStatus = useRuntimeStatusTelemetry();
  const navigate = useNavigate();

  return (
    <SuspenseElement<PortalRootLoaderData>
      resolve={rootPayload}
      correlationId={correlationId}
      homeHref={href('/')}
      loadingLabel='Initializing Solar Forge workspace...'
      onStreamError={error => {
        reportPortalPublicError(error, { phase: 'stream' });
      }}
    >
      {data => (
        <PortalRootShell
          data={data}
          pathname={pathname}
          locationKey={locationKey}
          runtimeStatus={runtimeStatus}
          navigate={navigate}
        />
      )}
    </SuspenseElement>
  );
}

export default function PortalRoot({ loaderData }: Route.ComponentProps) {
  useAnimatedFavicon();
  const location = useLocation();
  const pathname = normalizePathname(location.pathname);

  if (loaderData.isNotFound || loaderData.rootPayload === null) {
    return (
      <DirectionProvider.Provider direction='ltr'>
        <Tooltip.Provider>
          <div className={styles.standaloneShell}>
            <main className={styles.standaloneMain}>
              <Outlet />
            </main>
          </div>
        </Tooltip.Provider>
      </DirectionProvider.Provider>
    );
  }

  return (
    <DirectionProvider.Provider direction='ltr'>
      <Tooltip.Provider>
        <PortalWorkspaceRoot
          rootPayload={loaderData.rootPayload}
          correlationId={loaderData.correlationId}
          pathname={pathname}
          locationKey={location.key}
        />
      </Tooltip.Provider>
    </DirectionProvider.Provider>
  );
}

export function ErrorBoundary({ error, loaderData }: Route.ErrorBoundaryProps) {
  return (
    <DirectionProvider.Provider direction='ltr'>
      <Tooltip.Provider>
        <div className={styles.standaloneShell}>
          <main className={styles.standaloneMain}>
            <RouteErrorBoundaryView
              error={error}
              correlationId={loaderData?.correlationId}
              homeHref={href('/')}
              onError={publicError => {
                if (publicError.status !== 404) {
                  reportPortalPublicError(publicError, { phase: 'boundary' });
                }
              }}
            />
          </main>
        </div>
      </Tooltip.Provider>
    </DirectionProvider.Provider>
  );
}
