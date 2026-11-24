import './theme.css';
import type { PortalRootLoaderData } from '@aklapper/core';
import {
  buildCanonicalUrl,
  buildPortalJsonLd,
  buildRouteMetaTags,
  readSeoRuntimeConfig,
} from '@aklapper/core';
import { loadPortalRootDataWithPrerender } from '@aklapper/db';
import {
  Button,
  DirectionProvider,
  DocumentBodyAnalytics,
  DocumentHeadTags,
  NavigationMenu,
  OscStatusBadge,
  Separator,
  SolarForgeEmblem,
  TerminalWorkspace,
  Tooltip,
  useAnimatedFavicon,
} from '@aklapper/ui';
import { type ReactNode, useMemo } from 'react';
import {
  Link,
  Links,
  Meta,
  type MetaArgs,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation,
  useNavigate,
  useRouteLoaderData,
} from 'react-router';

import { PortalChangesInProgressPage } from '#pages/changes-in-progress';
import { PortalLauncherTui } from '#pages/home';

import { DEFAULT_PORTAL_SITE_URL, PORTAL_SITE_NAME } from './seo';
import { createPortalTerminalForms } from './terminalForms';

import styles from './root.module.css';

export async function loader(): Promise<PortalRootLoaderData> {
  const envFlag = process.env['PORTAL_MAINTENANCE_MODE'];
  const maintenanceModeOverride =
    envFlag === 'true' ? true : envFlag === 'false' ? false : undefined;
  const data = await loadPortalRootDataWithPrerender(maintenanceModeOverride);
  return {
    ...data,
    runtimeSeo: readSeoRuntimeConfig({
      defaultSiteUrl: DEFAULT_PORTAL_SITE_URL,
      siteUrlEnvKey: 'PUBLIC_PORTAL_URL',
    }),
  };
}

function normalizePathname(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

function getPortalPaneTitle(pathname: string): string {
  return pathname === '/' ? 'tty1' : `tui :: ${pathname}`;
}

export function meta({ loaderData, location }: MetaArgs<typeof loader>) {
  const siteUrl = loaderData?.runtimeSeo?.siteUrl ?? DEFAULT_PORTAL_SITE_URL;
  const pathname = normalizePathname(location.pathname);
  const isNoIndex = Boolean(loaderData?.maintenanceMode) || pathname === '/changes-in-progress';
  return buildRouteMetaTags({
    title: loaderData?.chrome.pageTitle ?? 'andrew-k.us // Solar Forge Terminal',
    description:
      'Interactive Solar Forge portfolio terminal, CADENCE sandboxed artifact builder, and GKE Autopilot scale-from-zero microservices showcase by Andrew Klapper.',
    siteName: PORTAL_SITE_NAME,
    siteUrl,
    pathname,
    robots: isNoIndex ? 'noindex, nofollow' : 'index, follow',
  });
}

export function Layout({ children }: { children: ReactNode }) {
  const rootData = useRouteLoaderData('root') as PortalRootLoaderData | undefined;
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

export default function PortalRoot() {
  useAnimatedFavicon();
  const data = useLoaderData() as PortalRootLoaderData;
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = normalizePathname(location.pathname);

  const terminalForms = useMemo(
    () => createPortalTerminalForms(data.contactForm, navigate),
    [data.contactForm, navigate],
  );

  if (data.maintenanceMode && data.maintenance) {
    return (
      <DirectionProvider.Provider direction='ltr'>
        <Tooltip.Provider>
          <div className={styles.standaloneShell}>
            <main className={styles.standaloneMain}>
              <PortalChangesInProgressPage data={data.maintenance} />
            </main>
          </div>
        </Tooltip.Provider>
      </DirectionProvider.Provider>
    );
  }

  if (pathname === '/changes-in-progress') {
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

  const { chrome, terminal, homeContent } = data;
  const isTerminalViewport = pathname === '/';
  const hasGlobalWorkspace = Boolean(terminal);

  return (
    <DirectionProvider.Provider direction='ltr'>
      <Tooltip.Provider>
        <div
          className={styles.shell}
          data-terminal-viewport={isTerminalViewport ? 'true' : 'false'}
          data-pane-workspace={hasGlobalWorkspace ? 'true' : 'false'}
        >
          <div className={styles.barWrap}>
            <header className={styles.bar}>
              <NavigationMenu.Root>
                <NavigationMenu.List>
                  <NavigationMenu.Item>
                    <NavigationMenu.Link render={<Link to='/' />} className={styles.brand}>
                      <SolarForgeEmblem size={18} />
                      <span>{chrome.brandLabel}</span>
                    </NavigationMenu.Link>
                  </NavigationMenu.Item>
                </NavigationMenu.List>
              </NavigationMenu.Root>
              <div className={styles.barMeta}>
                {hasGlobalWorkspace || isTerminalViewport ? (
                  <span className={styles.shortcutHint}>
                    {'Ctrl+⇧} / ⌘D split · Ctrl+⇧{ / ⌘⇧D hsplit · Alt+T tui'}
                  </span>
                ) : null}
                <OscStatusBadge
                  source={chrome.statusBadge.source}
                  state={chrome.statusBadge.state}
                  label={chrome.statusBadge.label}
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
                  flush: isTerminalViewport,
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
      </Tooltip.Provider>
    </DirectionProvider.Provider>
  );
}
