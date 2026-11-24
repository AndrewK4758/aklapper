import './theme.css';
import type { AdminRootLoaderData } from '@aklapper/contracts';
import { loadAdminRootDataWithPrerender } from '@aklapper/db';
import {
  buildCanonicalUrl,
  buildRouteMetaTags,
  readSeoRuntimeConfig,
} from '@aklapper/shared-utils';
import {
  DirectionProvider,
  DocumentBodyAnalytics,
  DocumentHeadTags,
  NavigationMenu,
  OscStatusBadge,
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

import { ADMIN_ROBOTS_DIRECTIVE, ADMIN_SITE_NAME, DEFAULT_ADMIN_SITE_URL } from './seo';

import styles from './root.module.css';

export async function loader(): Promise<AdminRootLoaderData> {
  const data = await loadAdminRootDataWithPrerender();
  return {
    ...data,
    runtimeSeo: readSeoRuntimeConfig({
      defaultSiteUrl: DEFAULT_ADMIN_SITE_URL,
      siteUrlEnvKey: 'PUBLIC_ADMIN_URL',
    }),
  };
}

export function meta({ loaderData, location }: MetaArgs<typeof loader>) {
  const siteUrl = loaderData?.runtimeSeo?.siteUrl ?? DEFAULT_ADMIN_SITE_URL;
  return buildRouteMetaTags({
    title: loaderData?.chrome.pageTitle ?? 'admin.andrew-k.us // Solar Forge Ops',
    description:
      'Isolated operations console for andrew-k.us: passkey gate, first-party analytics telemetry, and cadence-admin controls.',
    siteName: ADMIN_SITE_NAME,
    siteUrl,
    pathname: location.pathname,
    robots: ADMIN_ROBOTS_DIRECTIVE,
  });
}

export function Layout({ children }: { children: ReactNode }) {
  const rootData = useRouteLoaderData('root') as AdminRootLoaderData | undefined;
  const location = useLocation();
  const siteUrl = rootData?.runtimeSeo?.siteUrl ?? DEFAULT_ADMIN_SITE_URL;
  const canonicalUrl = buildCanonicalUrl(siteUrl, location.pathname);

  return (
    <html lang='en' data-theme='solar-forge'>
      <head>
        <DocumentHeadTags
          applicationName='admin.andrew-k.us // Solar Forge Ops'
          canonicalUrl={canonicalUrl}
          robots={ADMIN_ROBOTS_DIRECTIVE}
          analyticsApp='admin'
          runtimeSeo={rootData?.runtimeSeo}
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

export default function AdminRoot() {
  useAnimatedFavicon();
  const { chrome } = useLoaderData() as AdminRootLoaderData;

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
        </div>
      </Tooltip.Provider>
    </DirectionProvider.Provider>
  );
}
