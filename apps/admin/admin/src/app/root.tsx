import './theme.css';
import {
  type AdminRootLoaderData,
  type AdminRoutePath,
  type AuthSession,
  type AuthSessionStatus,
  buildCanonicalUrl,
  buildRouteMetaTags,
  type DocumentSeoRuntimeConfig,
  readSeoRuntimeConfig,
  type StreamResult,
} from '@aklapper/core';
import { classifyServerError } from '@aklapper/core/server-errors';
import { loadAdminRootDataWithPrerender } from '@aklapper/db';
import { resolveAdminSessionFromRequest } from '@aklapper/db/auth';
import { sanitizeRedirectTarget } from '@aklapper/node-runtime/auth';
import {
  createFallbackLogger,
  deferStreamResult,
  getOrCreateCorrelationId,
  getRequestContext,
  logDiagnosticError,
} from '@aklapper/node-runtime/ssr/stream';
import {
  Button,
  DirectionProvider,
  DocumentBodyAnalytics,
  DocumentHeadTags,
  NavigationMenu,
  OscStatusBadge,
  RouteErrorBoundaryView,
  SolarForgeEmblem,
  SuspenseElement,
  TerminalWorkspace,
  Tooltip,
  useAnimatedFavicon,
} from '@aklapper/ui';
import { type ReactNode, useState } from 'react';
import {
  data,
  href,
  Link,
  Links,
  Meta,
  Outlet,
  redirect,
  Scripts,
  ScrollRestoration,
  useLocation,
  useNavigate,
  useRouteLoaderData,
} from 'react-router';

import type { Route } from './+types/root';
import { reportAdminPublicError } from './client-telemetry';
import { ADMIN_ROBOTS_DIRECTIVE, ADMIN_SITE_NAME, DEFAULT_ADMIN_SITE_URL } from './seo';

import styles from './root.module.css';

type RegisteredAdminHrefPath = Exclude<Parameters<typeof href>[0], '/api/auth/*'>;
type AssertAssignable<TActual extends TExpected, TExpected> = TActual;
export type AdminRoutePathParityCheck = [
  AssertAssignable<AdminRoutePath, RegisteredAdminHrefPath>,
  AssertAssignable<RegisteredAdminHrefPath, AdminRoutePath>,
];

const ADMIN_NAV_ITEMS = [
  { to: href('/'), label: 'Overview' },
  { to: href('/analytics'), label: 'Analytics' },
  { to: href('/cms'), label: 'CMS' },
  { to: href('/inbox'), label: 'Inbox' },
  { to: href('/quotas'), label: 'Quotas' },
  { to: href('/ops'), label: 'Ops' },
] as const;

export interface AdminRootStreamData {
  readonly runtimeSeo: DocumentSeoRuntimeConfig;
  readonly correlationId: string;
  readonly isLoginRoute: boolean;
  readonly session: AuthSession | null;
  readonly authMeta: {
    readonly totpEnabled: boolean;
    readonly passkeyCount: number;
  };
  readonly rootPayload: Promise<StreamResult<AdminRootLoaderData>>;
}

function isNavItemActive(pathname: string, to: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (to === '/') return normalized === '/';
  return normalized === to || normalized.startsWith(`${to}/`);
}

function getAdminPaneTitle(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return normalized === '/' ? 'tui :: admin' : `tui :: admin${normalized}`;
}

export async function loader({ request, context }: Route.LoaderArgs): Promise<AdminRootStreamData> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const isLoginRoute = pathname === '/login' || pathname === '/login/';
  const isApiRoute = pathname.startsWith('/api/');
  const correlationId = getOrCreateCorrelationId(request, context);
  const reqCtx = getRequestContext(context);
  const logger = reqCtx?.logger ?? createFallbackLogger('admin-root');

  let status: AuthSessionStatus;
  try {
    status = await resolveAdminSessionFromRequest(request);
  } catch (error) {
    const { publicError, diagnostic } = classifyServerError(error, {
      correlationId,
      source: 'admin.root.auth',
    });
    logDiagnosticError(logger, diagnostic);
    throw data(publicError, {
      status: publicError.status,
      headers: { 'X-Correlation-Id': correlationId },
    });
  }

  const isAuthenticatedAdmin = Boolean(status.authenticated && status.session?.role === 'admin');

  if (!isLoginRoute && !isApiRoute && !isAuthenticatedAdmin) {
    const safeNext = sanitizeRedirectTarget(`${url.pathname}${url.search}`, href('/'));
    const loginUrl =
      safeNext === href('/')
        ? href('/login')
        : `${href('/login')}?next=${encodeURIComponent(safeNext)}`;
    throw redirect(loginUrl);
  }

  if (isLoginRoute && isAuthenticatedAdmin) {
    const safeNext = sanitizeRedirectTarget(url.searchParams.get('next'), href('/'));
    throw redirect(safeNext === href('/login') ? href('/') : safeNext);
  }

  const runtimeSeo = readSeoRuntimeConfig({
    defaultSiteUrl: DEFAULT_ADMIN_SITE_URL,
    siteUrlEnvKey: 'PUBLIC_ADMIN_URL',
  });

  return {
    runtimeSeo,
    correlationId,
    isLoginRoute,
    session: isAuthenticatedAdmin ? status.session : null,
    authMeta: {
      totpEnabled: status.totpEnabled,
      passkeyCount: status.passkeyCount,
    },
    rootPayload: deferStreamResult(
      (async () => {
        const rootData = await loadAdminRootDataWithPrerender();
        return {
          ...rootData,
          terminal: isLoginRoute ? undefined : rootData.terminal,
        };
      })(),
      {
        request,
        context,
        source: 'admin.root.loader',
      },
    ),
  };
}

export function meta({ loaderData, location }: Route.MetaArgs) {
  const siteUrl = loaderData?.runtimeSeo?.siteUrl ?? DEFAULT_ADMIN_SITE_URL;
  return buildRouteMetaTags({
    title: 'admin.andrew-k.us // Solar Forge Ops',
    description:
      'Isolated operations console for andrew-k.us: passkey gate, first-party analytics telemetry, CMS, inbox, quotas, and cadence-admin controls.',
    siteName: ADMIN_SITE_NAME,
    siteUrl,
    pathname: location.pathname,
    robots: ADMIN_ROBOTS_DIRECTIVE,
  });
}

export function Layout({ children }: { children: ReactNode }) {
  const rootData = useRouteLoaderData<typeof loader>('root');
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

interface AdminRootShellProps {
  readonly data: AdminRootLoaderData;
  readonly session: AuthSession | null;
  readonly isLoginRoute: boolean;
  readonly pathname: string;
  readonly navigate: (to: string) => void | Promise<void>;
}

function AdminRootShell({
  data: rootData,
  session,
  isLoginRoute,
  pathname,
  navigate,
}: AdminRootShellProps) {
  const [signingOut, setSigningOut] = useState(false);
  const { chrome, terminal } = rootData;
  const resolvedTerminal = isLoginRoute ? undefined : terminal;
  const hasGlobalWorkspace = Boolean(resolvedTerminal);
  const isAdminSession = session?.role === 'admin';

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.assign(href('/login'));
    }
  }

  return (
    <div className={styles.shell} data-pane-workspace={hasGlobalWorkspace ? 'true' : 'false'}>
      <header className={styles.bar}>
        <NavigationMenu.Root aria-label='Admin console navigation'>
          <NavigationMenu.List className={styles.navList}>
            <NavigationMenu.Item>
              <NavigationMenu.Link render={<Link to={href('/')} />} className={styles.brand}>
                <SolarForgeEmblem size={20} />
                <span>{chrome.brandLabel}</span>
              </NavigationMenu.Link>
            </NavigationMenu.Item>
            {isAdminSession
              ? ADMIN_NAV_ITEMS.map(item => {
                  const active = isNavItemActive(pathname, item.to);
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
          {hasGlobalWorkspace && chrome.shortcutHint ? (
            <span className={styles.shortcutHint}>{chrome.shortcutHint}</span>
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
        {resolvedTerminal ? (
          <TerminalWorkspace
            terminal={resolvedTerminal}
            disableMenuShortcut
            navigate={to => {
              void navigate(to);
            }}
            primaryPane={{
              title: getAdminPaneTitle(pathname),
              content: <Outlet />,
            }}
          />
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}

export default function AdminRoot({ loaderData }: Route.ComponentProps) {
  useAnimatedFavicon();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <DirectionProvider.Provider direction='ltr'>
      <Tooltip.Provider>
        <SuspenseElement<AdminRootLoaderData>
          resolve={loaderData.rootPayload}
          correlationId={loaderData.correlationId}
          homeHref={href('/')}
          loadingLabel='Initializing admin operations console...'
          onStreamError={error => {
            reportAdminPublicError(error, { phase: 'stream' });
          }}
        >
          {resolved => (
            <AdminRootShell
              data={resolved}
              session={loaderData.session}
              isLoginRoute={loaderData.isLoginRoute}
              pathname={location.pathname}
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
        <div className={styles.shell}>
          <main className={styles.main}>
            <RouteErrorBoundaryView
              error={error}
              correlationId={loaderData?.correlationId}
              homeHref={href('/')}
              onError={publicError => {
                reportAdminPublicError(publicError, { phase: 'boundary' });
              }}
            />
          </main>
        </div>
      </Tooltip.Provider>
    </DirectionProvider.Provider>
  );
}
