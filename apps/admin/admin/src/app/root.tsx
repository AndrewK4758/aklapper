import './theme.css';
import type { AdminRootLoaderData } from '@aklapper/core';
import { buildCanonicalUrl, buildRouteMetaTags, readSeoRuntimeConfig } from '@aklapper/core';
import { loadAdminRootDataWithPrerender } from '@aklapper/db';
import { resolveAdminSessionFromRequest } from '@aklapper/db/auth';
import { sanitizeRedirectTarget } from '@aklapper/node-runtime/auth';
import {
  Button,
  DirectionProvider,
  DocumentBodyAnalytics,
  DocumentHeadTags,
  NavigationMenu,
  OscStatusBadge,
  SolarForgeEmblem,
  TerminalWorkspace,
  Tooltip,
  useAnimatedFavicon,
} from '@aklapper/ui';
import { type ReactNode, useState } from 'react';
import {
  Link,
  Links,
  type LoaderFunctionArgs,
  Meta,
  type MetaArgs,
  Outlet,
  redirect,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation,
  useNavigate,
  useRouteLoaderData,
} from 'react-router';

import { ADMIN_ROBOTS_DIRECTIVE, ADMIN_SITE_NAME, DEFAULT_ADMIN_SITE_URL } from './seo';

import styles from './root.module.css';

const ADMIN_NAV_ITEMS = [
  { to: '/', label: 'Overview' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/cms', label: 'CMS' },
  { to: '/inbox', label: 'Inbox' },
  { to: '/quotas', label: 'Quotas' },
  { to: '/ops', label: 'Ops' },
] as const;

function isNavItemActive(pathname: string, to: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (to === '/') return normalized === '/';
  return normalized === to || normalized.startsWith(`${to}/`);
}

export async function loader({ request }: LoaderFunctionArgs): Promise<AdminRootLoaderData> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const isLoginRoute = pathname === '/login' || pathname === '/login/';
  const isApiRoute = pathname.startsWith('/api/');

  const status = await resolveAdminSessionFromRequest(request);
  const isAuthenticatedAdmin = Boolean(status.authenticated && status.session?.role === 'admin');

  if (!isLoginRoute && !isApiRoute && !isAuthenticatedAdmin) {
    const safeNext = sanitizeRedirectTarget(`${url.pathname}${url.search}`, '/');
    const loginUrl = safeNext === '/' ? '/login' : `/login?next=${encodeURIComponent(safeNext)}`;
    throw redirect(loginUrl);
  }

  if (isLoginRoute && isAuthenticatedAdmin) {
    const safeNext = sanitizeRedirectTarget(url.searchParams.get('next'), '/');
    throw redirect(safeNext === '/login' ? '/' : safeNext);
  }

  const data = await loadAdminRootDataWithPrerender();
  return {
    ...data,
    terminal: isLoginRoute ? undefined : data.terminal,
    session: isAuthenticatedAdmin ? status.session : null,
    authMeta: {
      totpEnabled: status.totpEnabled,
      passkeyCount: status.passkeyCount,
    },
    runtimeSeo: readSeoRuntimeConfig({
      defaultSiteUrl: DEFAULT_ADMIN_SITE_URL,
      siteUrlEnvKey: 'PUBLIC_ADMIN_URL',
    }),
  };
}

function getAdminPaneTitle(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return normalized === '/' ? 'tui :: admin' : `tui :: admin${normalized}`;
}

export function meta({ loaderData, location }: MetaArgs<typeof loader>) {
  const siteUrl = loaderData?.runtimeSeo?.siteUrl ?? DEFAULT_ADMIN_SITE_URL;
  return buildRouteMetaTags({
    title: loaderData?.chrome.pageTitle ?? 'admin.andrew-k.us // Solar Forge Ops',
    description:
      'Isolated operations console for andrew-k.us: passkey gate, first-party analytics telemetry, CMS, inbox, quotas, and cadence-admin controls.',
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
  const { chrome, terminal, session } = useLoaderData() as AdminRootLoaderData;
  const location = useLocation();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const hasGlobalWorkspace = Boolean(terminal);
  const isAdminSession = session?.role === 'admin';

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.assign('/login');
    }
  }

  return (
    <DirectionProvider.Provider direction='ltr'>
      <Tooltip.Provider>
        <div className={styles.shell} data-pane-workspace={hasGlobalWorkspace ? 'true' : 'false'}>
          <header className={styles.bar}>
            <NavigationMenu.Root aria-label='Admin console navigation'>
              <NavigationMenu.List className={styles.navList}>
                <NavigationMenu.Item>
                  <NavigationMenu.Link render={<Link to='/' />} className={styles.brand}>
                    <SolarForgeEmblem size={20} />
                    <span>{chrome.brandLabel}</span>
                  </NavigationMenu.Link>
                </NavigationMenu.Item>
                {isAdminSession
                  ? ADMIN_NAV_ITEMS.map(item => {
                      const active = isNavItemActive(location.pathname, item.to);
                      return (
                        <NavigationMenu.Item key={item.to}>
                          <NavigationMenu.Link
                            render={<Link to={item.to} />}
                            className={styles.navLink}
                            data-active={active ? 'true' : 'false'}
                            aria-current={active ? 'page' : undefined}
                          >
                            {item.label}
                          </NavigationMenu.Link>
                        </NavigationMenu.Item>
                      );
                    })
                  : null}
              </NavigationMenu.List>
            </NavigationMenu.Root>
            <div className={styles.barMeta}>
              {hasGlobalWorkspace ? (
                <span className={styles.shortcutHint}>
                  {'Ctrl+⇧} / ⌘D split · Ctrl+⇧{ / ⌘⇧D hsplit · Alt+⇧T tab'}
                </span>
              ) : null}
              {isAdminSession && session ? (
                <span className={styles.sessionHandle}>{session.handle}@admin</span>
              ) : null}
              <OscStatusBadge
                source={chrome.statusBadge.source}
                state={isAdminSession ? 'ready' : chrome.statusBadge.state}
                label={isAdminSession ? 'Passkey Verified' : chrome.statusBadge.label}
              />
              {isAdminSession ? (
                <Button.Root
                  type='button'
                  variant='ghost'
                  size='sm'
                  loading={signingOut}
                  onClick={() => {
                    void handleSignOut();
                  }}
                >
                  <Button.Label>Sign Out</Button.Label>
                </Button.Root>
              ) : null}
            </div>
          </header>
          <main className={styles.main} data-pane-workspace={hasGlobalWorkspace ? 'true' : 'false'}>
            {terminal ? (
              <TerminalWorkspace
                terminal={terminal}
                disableMenuShortcut
                navigate={to => {
                  void navigate(to);
                }}
                primaryPane={{
                  title: getAdminPaneTitle(location.pathname),
                  content: <Outlet />,
                }}
              />
            ) : (
              <Outlet />
            )}
          </main>
        </div>
      </Tooltip.Provider>
    </DirectionProvider.Provider>
  );
}
