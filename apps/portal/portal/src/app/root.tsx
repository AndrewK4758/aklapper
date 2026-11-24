import './theme.css';
import type { PortalRootLoaderData } from '@aklapper/contracts';
import { loadPortalRootDataWithPrerender } from '@aklapper/db';
import {
  buildCanonicalUrl,
  buildPortalJsonLd,
  buildRouteMetaTags,
  readSeoRuntimeConfig,
} from '@aklapper/shared-utils';
import {
  Button,
  DirectionProvider,
  DocumentBodyAnalytics,
  DocumentHeadTags,
  NavigationMenu,
  OscStatusBadge,
  Separator,
  SolarForgeEmblem,
  Tooltip,
  useAnimatedFavicon,
} from '@aklapper/ui';
import type { ReactNode } from 'react';
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
  useRouteLoaderData,
} from 'react-router';

import { ChangesInProgressView } from './routes/changes-in-progress';
import { DEFAULT_PORTAL_SITE_URL, PORTAL_SITE_NAME } from './seo';

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
  const pathname = normalizePathname(location.pathname);

  if (data.maintenanceMode && data.maintenance) {
    return (
      <DirectionProvider.Provider direction='ltr'>
        <Tooltip.Provider>
          <div className={styles.standaloneShell}>
            <main className={styles.main}>
              <ChangesInProgressView data={data.maintenance} />
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
            <main className={styles.main}>
              <Outlet />
            </main>
          </div>
        </Tooltip.Provider>
      </DirectionProvider.Provider>
    );
  }

  const { chrome } = data;

  return (
    <DirectionProvider.Provider direction='ltr'>
      <Tooltip.Provider>
        <div className={styles.shell}>
          <header className={styles.bar}>
            <NavigationMenu.Root>
              <NavigationMenu.List>
                <NavigationMenu.Item>
                  <NavigationMenu.Link render={<Link to='/' />} className={styles.brand}>
                    <SolarForgeEmblem size={20} />
                    <span>{chrome.brandLabel}</span>
                  </NavigationMenu.Link>
                </NavigationMenu.Item>
              </NavigationMenu.List>
            </NavigationMenu.Root>
            <OscStatusBadge
              source={chrome.statusBadge.source}
              state={chrome.statusBadge.state}
              label={chrome.statusBadge.label}
            />
          </header>
          <main className={styles.main}>
            <Outlet />
          </main>
          <div className={styles.footerWrap}>
            <Separator.Root />
            <footer className={styles.footer}>
              <span>{chrome.footerText}</span>
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
            </footer>
          </div>
        </div>
      </Tooltip.Provider>
    </DirectionProvider.Provider>
  );
}
