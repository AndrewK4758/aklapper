import type { PortalRootLoaderData, PublicAppError } from '@aklapper/core';
import {
  Button,
  LazyChunkBoundary,
  lazyWithRetry,
  NavigationMenu,
  OscStatusBadge,
  RouteWorkspaceHost,
  Separator,
  SolarForgeEmblem,
  TerminalWorkspace,
  useViewportLayoutMode,
} from '@aklapper/ui';
import { createRouteWorkspaceStore } from '@aklapper/ui/workspace-storage';
import { useMemo } from 'react';
import { href, Link, Outlet, useOutlet } from 'react-router';

import { PortalLauncherTui } from '#pages/home';

import { reportPortalClientError } from './client-telemetry';
import type { ClusterTelemetrySnapshot } from './cluster-stream';
import { PortalMobileWorkspaceHost } from './PortalMobileWorkspaceHost';
import { isPortalPaneRoute, renderPortalPaneView } from './portalPaneViews';
import { createPortalTerminalForms } from './terminalForms';

import styles from './root.module.css';

const LazyPortalChangesInProgressPage = lazyWithRetry(() =>
  import('#pages/changes-in-progress').then(mod => ({
    default: mod.PortalChangesInProgressPage,
  })),
);

export const portalRouteWorkspaceStore = createRouteWorkspaceStore({
  namespace: 'portal',
});

function getPortalPaneTitle(pathname: string): string {
  return pathname === '/' ? 'tty1' : `tui :: ${pathname}`;
}

export function OfflineMaintenanceFallback({ error }: { readonly error: PublicAppError }) {
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

export interface PortalRootShellProps {
  readonly data: PortalRootLoaderData;
  readonly pathname: string;
  readonly cluster: ClusterTelemetrySnapshot;
  readonly navigate: (to: string) => void | Promise<void>;
}

export function PortalRootShell({ data, pathname, cluster, navigate }: PortalRootShellProps) {
  const outlet = useOutlet();
  const layoutMode = useViewportLayoutMode();
  const terminalForms = useMemo(
    () => createPortalTerminalForms(data.contactForm, navigate),
    [data.contactForm, navigate],
  );

  if (data.maintenanceMode && data.maintenance) {
    portalRouteWorkspaceStore.recordRoutePolicy(pathname, 'excluded-maintenance');
    return (
      <div className={styles.standaloneShell}>
        <main className={styles.standaloneMain}>
          <LazyChunkBoundary
            loadingLabel='Loading maintenance status...'
            errorTitle='Unable to load maintenance view'
            onChunkError={error => {
              console.error(
                JSON.stringify({
                  event: 'ui.lazy_chunk.load_failed',
                  routePath: '/changes-in-progress',
                }),
              );
              reportPortalClientError(error, {
                phase: 'boundary',
                pathname: '/changes-in-progress',
                errorCode: 'ERR_UPSTREAM_UNAVAILABLE',
              });
            }}
          >
            <LazyPortalChangesInProgressPage data={data.maintenance} />
          </LazyChunkBoundary>
        </main>
      </div>
    );
  }

  const { chrome, terminal, homeContent } = data;
  const isTerminalViewport = pathname === '/';
  const hasGlobalWorkspace = layoutMode === 'desktop' && Boolean(terminal);
  if (hasGlobalWorkspace) {
    portalRouteWorkspaceStore.recordRoutePolicy(pathname, 'cached-workspace');
  }
  const headerBadgeState = cluster.connected ? cluster.summaryState : chrome.statusBadge.state;
  const headerBadgeLabel =
    cluster.connected && cluster.summaryLabel ? cluster.summaryLabel : chrome.statusBadge.label;

  if (layoutMode !== 'desktop') {
    return (
      <PortalMobileWorkspaceHost
        layoutMode={layoutMode}
        data={data}
        pathname={pathname}
        cluster={cluster}
        navigate={navigate}
      />
    );
  }

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
                <NavigationMenu.Link
                  render={<Link to={href('/')} prefetch='intent' />}
                  className={styles.brand}
                >
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
                      render={<Link to={href('/contact')} prefetch='intent' />}
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
          <RouteWorkspaceHost
            activeRouteKey={pathname}
            outlet={outlet}
            renderWorkspace={({ routeKey, outlet: layerOutlet, isActive }) => {
              const layerIsTerminalViewport = routeKey === '/';
              const layerIsPortalPaneDeepLink = isPortalPaneRoute(routeKey);
              const layerInitialPrimaryTuiStack = layerIsPortalPaneDeepLink
                ? [routeKey]
                : undefined;
              return (
                <TerminalWorkspace
                  terminal={terminal}
                  terminalForms={terminalForms}
                  isActive={isActive}
                  routeKey={routeKey}
                  workspaceStore={portalRouteWorkspaceStore}
                  navigate={to => {
                    void navigate(to);
                  }}
                  initialPrimaryTuiStack={layerInitialPrimaryTuiStack}
                  onPrimaryPaneReturnToShell={() => {
                    if (routeKey !== '/') {
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
                    title: getPortalPaneTitle(routeKey),
                    content: layerOutlet,
                    flush: layerIsTerminalViewport || layerIsPortalPaneDeepLink,
                    embeddedTerminal: layerIsTerminalViewport,
                  }}
                />
              );
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
