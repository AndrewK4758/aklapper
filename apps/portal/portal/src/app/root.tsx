import './theme.css';
import {
  buildCanonicalUrl,
  buildPortalJsonLd,
  buildRouteMetaTags,
  type DocumentSeoRuntimeConfig,
  type PortalRootLoaderData,
  type PortalRoutePath,
  type PublicAppError,
  readSeoRuntimeConfig,
  type StreamResult,
} from '@aklapper/core';
import { loadPortalRootDataWithPrerender } from '@aklapper/db';
import { deferStreamResult, getOrCreateCorrelationId } from '@aklapper/node-runtime/ssr/stream';
import {
  Button,
  DirectionProvider,
  DocumentBodyAnalytics,
  DocumentHeadTags,
  NavigationMenu,
  OscStatusBadge,
  RouteErrorBoundaryView,
  Separator,
  SolarForgeEmblem,
  SuspenseElement,
  TerminalWorkspace,
  Tooltip,
  useAnimatedFavicon,
} from '@aklapper/ui';
import { type ReactNode, useMemo } from 'react';
import {
  href,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useNavigate,
  useRouteLoaderData,
} from 'react-router';

import { PortalChangesInProgressPage } from '#pages/changes-in-progress';
import { PortalLauncherTui } from '#pages/home';

import type { Route } from './+types/root';
import { reportPortalPublicError } from './client-telemetry';
import { type ClusterTelemetrySnapshot, useClusterTelemetry } from './cluster-stream';
import { isPortalPaneRoute, renderPortalPaneView } from './portalPaneViews';
import {
  DEFAULT_PORTAL_MAINTENANCE_DESCRIPTION,
  DEFAULT_PORTAL_SITE_URL,
  PORTAL_SITE_NAME,
} from './seo';
import { createPortalTerminalForms } from './terminalForms';

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
  readonly maintenanceMode: boolean;
  readonly rootPayload: Promise<StreamResult<PortalRootLoaderData>>;
}

export function loader({ request, context }: Route.LoaderArgs): PortalRootStreamData {
  const envFlag = process.env['PORTAL_MAINTENANCE_MODE'];
  const maintenanceModeOverride =
    envFlag === 'true' ? true : envFlag === 'false' ? false : undefined;
  const correlationId = getOrCreateCorrelationId(request, context);
  const runtimeSeo = readSeoRuntimeConfig({
    defaultSiteUrl: DEFAULT_PORTAL_SITE_URL,
    siteUrlEnvKey: 'PUBLIC_PORTAL_URL',
  });

  return {
    runtimeSeo,
    correlationId,
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

function getPortalPaneTitle(pathname: string): string {
  return pathname === '/' ? 'tty1' : `tui :: ${pathname}`;
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
      : 'Interactive Solar Forge portfolio terminal, CADENCE sandboxed artifact builder, and GKE Autopilot scale-from-zero microservices showcase by Andrew Klapper.',
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
    <html lang='en' data-theme='solar-forge'>
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
    </html>
  );
}

function OfflineMaintenanceFallback({ error }: { readonly error: PublicAppError }) {
  return (
    <div className={styles.standaloneShell} data-testid='offline-maintenance-fallback'>
      <main className={styles.standaloneMain}>
        <section className={styles.offlineMaintenance} aria-label='Scheduled Maintenance'>
          <div className={styles.offlineMaintenanceCard}>
            <div className={styles.offlineMaintenanceHeader}>
              <SolarForgeEmblem size={20} />
              <h1>Changes in Progress</h1>
            </div>
            <p className={styles.offlineMaintenanceLead}>
              andrew-k.us is currently undergoing scheduled maintenance. Please check back shortly.
            </p>
            <p className={styles.offlineMaintenanceRef}>
              Reference ID: <code>{error.correlationId}</code>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

interface PortalRootShellProps {
  readonly data: PortalRootLoaderData;
  readonly pathname: string;
  readonly cluster: ClusterTelemetrySnapshot;
  readonly navigate: (to: string) => void | Promise<void>;
}

function PortalRootShell({ data, pathname, cluster, navigate }: PortalRootShellProps) {
  const terminalForms = useMemo(
    () => createPortalTerminalForms(data.contactForm, navigate),
    [data.contactForm, navigate],
  );

  if (data.maintenanceMode && data.maintenance) {
    return (
      <div className={styles.standaloneShell}>
        <main className={styles.standaloneMain}>
          <PortalChangesInProgressPage data={data.maintenance} />
        </main>
      </div>
    );
  }

  const { chrome, terminal, homeContent } = data;
  const isTerminalViewport = pathname === '/';
  const isPortalPaneDeepLink = isPortalPaneRoute(pathname);
  const initialPrimaryTuiStack = isPortalPaneDeepLink ? [pathname] : undefined;
  const hasGlobalWorkspace = Boolean(terminal);
  const headerBadgeState = cluster.connected ? cluster.summaryState : chrome.statusBadge.state;
  const headerBadgeLabel =
    cluster.connected && cluster.summaryLabel ? cluster.summaryLabel : chrome.statusBadge.label;

  return (
    <div
      className={styles.shell}
      data-terminal-viewport={isTerminalViewport ? 'true' : 'false'}
      data-pane-workspace={hasGlobalWorkspace ? 'true' : 'false'}
    >
      <div className={styles.barWrap}>
        <header className={styles.bar}>
          <NavigationMenu.Root>
            <NavigationMenu.List className={styles.brandGroup}>
              <NavigationMenu.Item>
                <NavigationMenu.Link render={<Link to={href('/')} />} className={styles.brand}>
                  <SolarForgeEmblem size={18} />
                  <span>{chrome.brandLabel}</span>
                </NavigationMenu.Link>
              </NavigationMenu.Item>
              {chrome.brandContactEmail ? (
                <>
                  <li aria-hidden='true' className={styles.brandSeparator}>
                    ::
                  </li>
                  <NavigationMenu.Item>
                    <NavigationMenu.Link
                      render={<Link to={href('/contact')} />}
                      className={styles.brandEmail}
                    >
                      {chrome.brandContactEmail}
                    </NavigationMenu.Link>
                  </NavigationMenu.Item>
                </>
              ) : null}
            </NavigationMenu.List>
          </NavigationMenu.Root>
          <div className={styles.barMeta}>
            {(hasGlobalWorkspace || isTerminalViewport) && chrome.shortcutHint ? (
              <span className={styles.shortcutHint}>{chrome.shortcutHint}</span>
            ) : null}
            <OscStatusBadge
              source={chrome.statusBadge.source}
              state={headerBadgeState}
              label={headerBadgeLabel}
            />
          </div>
        </header>
        <Separator.Root className={styles.barDivider} />
      </div>
      <main
        className={styles.main}
        data-terminal-viewport={isTerminalViewport ? 'true' : 'false'}
        data-pane-workspace={hasGlobalWorkspace ? 'true' : 'false'}
      >
        {terminal ? (
          <TerminalWorkspace
            terminal={terminal}
            terminalForms={terminalForms}
            navigate={to => {
              void navigate(to);
            }}
            initialPrimaryTuiStack={initialPrimaryTuiStack}
            onPrimaryPaneReturnToShell={() => {
              if (pathname !== '/') {
                void navigate(href('/'));
              }
            }}
            canHandleInPaneRoute={to => to === 'tui' || isPortalPaneRoute(to)}
            renderPaneView={ctx =>
              renderPortalPaneView({
                ctx,
                homeContent,
                deployments: cluster.deployments,
              })
            }
            renderTui={
              homeContent
                ? ({ ttyNumber, isSinglePane, closeTui }) => (
                    <PortalLauncherTui
                      content={homeContent}
                      ttyNumber={ttyNumber}
                      isSinglePane={isSinglePane}
                      onClose={closeTui}
                    />
                  )
                : undefined
            }
            primaryPane={{
              title: getPortalPaneTitle(pathname),
              content: <Outlet />,
              flush: isTerminalViewport || isPortalPaneDeepLink,
              embeddedTerminal: isTerminalViewport,
            }}
          />
        ) : (
          <Outlet />
        )}
      </main>
      <div className={styles.footerWrap}>
        <Separator.Root />
        <footer className={styles.footer}>
          <span>{chrome.footerText}</span>
          <div className={styles.footerLinks}>
            <Button.Link
              href='/sitemap.xml'
              variant='ghost'
              size='xs'
              className={styles.footerLink}
            >
              <Button.Label>Sitemap</Button.Label>
            </Button.Link>
            <Button.Link
              href={chrome.footerLinkUrl}
              target='_blank'
              rel='noreferrer'
              variant='ghost'
              size='xs'
              className={styles.footerLink}
            >
              <Button.Label>{chrome.footerLinkLabel}</Button.Label>
            </Button.Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function PortalRoot({ loaderData }: Route.ComponentProps) {
  useAnimatedFavicon();
  const cluster = useClusterTelemetry();
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = normalizePathname(location.pathname);

  if (pathname === '/changes-in-progress' && !loaderData.maintenanceMode) {
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
              cluster={cluster}
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
