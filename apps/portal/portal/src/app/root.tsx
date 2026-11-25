import './theme.css';
import {
  buildCanonicalUrl,
  buildPortalJsonLd,
  buildRouteMetaTags,
  type DocumentSeoRuntimeConfig,
  type PortalRootLoaderData,
  type PortalRoutePath,
  readSeoRuntimeConfig,
  type StreamResult,
} from '@aklapper/core';
import { loadPortalRootDataWithPrerender } from '@aklapper/db';
import { deferStreamResult, getOrCreateCorrelationId } from '@aklapper/node-runtime/ssr/stream';
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
  useRouteLoaderData,
} from 'react-router';

import type { Route } from './+types/root';
import { reportPortalPublicError } from './client-telemetry';
import { OfflineMaintenanceFallback, PortalRootShell } from './PortalRootShell';
import { useRuntimeStatusTelemetry } from './runtime-status';
import {
  DEFAULT_PORTAL_MAINTENANCE_DESCRIPTION,
  DEFAULT_PORTAL_SITE_URL,
  PORTAL_SITE_NAME,
} from './seo';
import { portalWorkspaceStore } from './workspace/portalWorkspaceStore';

import styles from './root.module.css';

type RegisteredPortalHrefPath = Exclude<Parameters<typeof href>[0], '/*'>;
type AssertAssignable<TActual extends TExpected, TExpected> = TActual;
export type PortalRoutePathParityCheck = [
  AssertAssignable<PortalRoutePath, RegisteredPortalHrefPath>,
  AssertAssignable<RegisteredPortalHrefPath, PortalRoutePath>,
];

export interface PortalRootStreamData {
  readonly runtimeSeo: DocumentSeoRuntimeConfig;
  readonly correlationId: string;
  readonly initialViewport: ServerViewportLayoutMode;
  readonly maintenanceMode: boolean;
  readonly rootPayload: Promise<StreamResult<PortalRootLoaderData>>;
}

export function loader({ request, context }: Route.LoaderArgs): PortalRootStreamData {
  const envFlag = process.env['PORTAL_MAINTENANCE_MODE'];
  const maintenanceModeOverride =
    envFlag === 'true' ? true : envFlag === 'false' ? false : undefined;
  const correlationId = getOrCreateCorrelationId(request, context);
  const initialViewport = detectServerViewportMode(request.headers);
  const runtimeSeo = readSeoRuntimeConfig({
    defaultSiteUrl: DEFAULT_PORTAL_SITE_URL,
    siteUrlEnvKey: 'PUBLIC_PORTAL_URL',
  });

  return {
    runtimeSeo,
    correlationId,
    initialViewport,
    maintenanceMode: maintenanceModeOverride === true,
    rootPayload: deferStreamResult(loadPortalRootDataWithPrerender(maintenanceModeOverride), {
      request,
      context,
      source: 'portal.root.loader',
    }),
  };
}

function normalizePathname(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formAction,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs): boolean {
  const currentPath = normalizePathname(currentUrl.pathname);
  const nextPath = normalizePathname(nextUrl.pathname);
  if (currentPath === '/changes-in-progress' || nextPath === '/changes-in-progress') {
    return defaultShouldRevalidate;
  }
  if (currentPath === nextPath && !formAction) {
    return defaultShouldRevalidate;
  }
  return false;
}

export function meta({ loaderData, location }: Route.MetaArgs) {
  const siteUrl = loaderData?.runtimeSeo?.siteUrl ?? DEFAULT_PORTAL_SITE_URL;
  const pathname = normalizePathname(location.pathname);
  const isNoIndex = Boolean(loaderData?.maintenanceMode) || pathname === '/changes-in-progress';
  return buildRouteMetaTags({
    title: isNoIndex
      ? `Changes in Progress // ${PORTAL_SITE_NAME}`
      : 'andrew-k.us // Solar Forge Terminal',
    description: isNoIndex
      ? DEFAULT_PORTAL_MAINTENANCE_DESCRIPTION
      : 'Interactive Solar Forge portfolio terminal, CADENCE sandboxed artifact builder, and Cloud Run scale-to-zero Go microservices showcase by Andrew Klapper.',
    siteName: PORTAL_SITE_NAME,
    siteUrl,
    pathname,
    robots: isNoIndex ? 'noindex, nofollow' : 'index, follow',
  });
}

export function Layout({ children }: { children: ReactNode }) {
  const rootData = useRouteLoaderData<typeof loader>('root');
  const location = useLocation();
  const pathname = normalizePathname(location.pathname);
  const siteUrl = rootData?.runtimeSeo?.siteUrl ?? DEFAULT_PORTAL_SITE_URL;
  const isNoIndex = Boolean(rootData?.maintenanceMode) || pathname === '/changes-in-progress';
  const canonicalUrl = buildCanonicalUrl(siteUrl, pathname);

  return (
    <ViewportProvider initialMode={rootData?.initialViewport ?? 'desktop'}>
      <ViewportHtml lang='en' data-theme='solar-forge'>
        <head>
          <DocumentHeadTags
            applicationName='andrew-k.us // Solar Forge'
            canonicalUrl={canonicalUrl}
            robots={isNoIndex ? 'noindex, nofollow' : 'index, follow'}
            analyticsApp='portal'
            runtimeSeo={rootData?.runtimeSeo}
            jsonLd={isNoIndex ? undefined : buildPortalJsonLd(siteUrl)}
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

export default function PortalRoot({ loaderData }: Route.ComponentProps) {
  useAnimatedFavicon();
  const runtimeStatus = useRuntimeStatusTelemetry();
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = normalizePathname(location.pathname);

  if (pathname === '/changes-in-progress' && !loaderData.maintenanceMode) {
    portalWorkspaceStore.recordRoutePolicy(pathname, 'excluded-standalone');
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
        <SuspenseElement<PortalRootLoaderData>
          resolve={loaderData.rootPayload}
          correlationId={loaderData.correlationId}
          homeHref={href('/')}
          loadingLabel='Initializing Solar Forge workspace...'
          onStreamError={error => {
            reportPortalPublicError(error, { phase: 'stream' });
          }}
          errorElement={
            loaderData.maintenanceMode
              ? error => <OfflineMaintenanceFallback error={error} />
              : undefined
          }
        >
          {data => (
            <PortalRootShell
              data={data}
              pathname={pathname}
              locationKey={location.key}
              runtimeStatus={runtimeStatus}
              navigate={navigate}
            />
          )}
        </SuspenseElement>
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
                reportPortalPublicError(publicError, { phase: 'boundary' });
              }}
            />
          </main>
        </div>
      </Tooltip.Provider>
    </DirectionProvider.Provider>
  );
}
