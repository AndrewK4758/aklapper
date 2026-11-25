import type { AdminRootLoaderData, AuthSession } from '@aklapper/core';
import {
  Button,
  LazyChunkBoundary,
  lazyWithRetry,
  NavigationMenu,
  OscStatusBadge,
  SolarForgeEmblem,
  useViewportLayoutMode,
} from '@aklapper/ui';
import {
  createRouteWorkspaceStore,
  normalizeWorkspaceRouteKey,
} from '@aklapper/ui/workspace-storage';
import { type ReactNode, useState } from 'react';
import { href, Link, Outlet, useOutlet } from 'react-router';

import { AdminMobileWorkspaceHost } from './AdminMobileWorkspaceHost';
import { reportAdminLazyChunkError } from './client-telemetry';

import styles from './root.module.css';

export const adminRouteWorkspaceStore = createRouteWorkspaceStore({
  namespace: 'admin',
});

interface AdminRouteWorkspaceProps {
  readonly pathname: string;
  readonly outlet: ReactNode;
  readonly terminal: NonNullable<AdminRootLoaderData['terminal']>;
  readonly navigate: (to: string) => void | Promise<void>;
}

const LazyAdminRouteWorkspace = lazyWithRetry(() =>
  import('@aklapper/ui/terminal-workspace').then(mod => {
    const { RouteWorkspaceHost, TerminalWorkspace } = mod;
    return {
      default: function AdminRouteWorkspace({
        pathname,
        outlet,
        terminal,
        navigate,
      }: AdminRouteWorkspaceProps) {
        return (
          <RouteWorkspaceHost
            activeRouteKey={pathname}
            outlet={outlet}
            renderWorkspace={({ routeKey, outlet: layerOutlet, isActive }) => (
              <TerminalWorkspace
                terminal={terminal}
                disableMenuShortcut
                isActive={isActive}
                routeKey={routeKey}
                workspaceStore={adminRouteWorkspaceStore}
                navigate={to => {
                  void navigate(to);
                }}
                primaryPane={{
                  title: getAdminPaneTitle(routeKey),
                  content: layerOutlet,
                }}
              />
            )}
          />
        );
      },
    };
  }),
);

export type AdminWorkspaceMountBranch =
  | 'login-outlet-only'
  | 'lazy-terminal-workspace'
  | 'mobile-tui-workspace';

let lastEmittedWorkspaceBranchKey: string | null = null;
let lastEmittedUnauthMobileKey: string | null = null;

export function resetAdminRootBranchTelemetryForTest(): void {
  lastEmittedWorkspaceBranchKey = null;
  lastEmittedUnauthMobileKey = null;
}

function emitAdminWorkspaceMountBranch(branch: AdminWorkspaceMountBranch, pathname: string): void {
  if (typeof window === 'undefined') return;
  const dedupKey = `${branch}:${pathname}`;
  if (lastEmittedWorkspaceBranchKey === dedupKey) {
    return;
  }
  lastEmittedWorkspaceBranchKey = dedupKey;
  console.debug(
    JSON.stringify({
      event: 'admin.root.workspace_mount_branch',
      seamType: 'RULE_DIVERGENCE',
      branch,
      pathname,
    }),
  );
}

function emitAdminUnauthMobileShellBlocked(pathname: string): void {
  if (typeof window === 'undefined') return;
  if (lastEmittedUnauthMobileKey === pathname) {
    return;
  }
  lastEmittedUnauthMobileKey = pathname;
  console.warn(
    JSON.stringify({
      event: 'admin.root.unauth_mobile_shell_blocked',
      seamType: 'UNSOUND_CONDITION',
      pathname,
    }),
  );
}

const ADMIN_NAV_ITEMS = [
  { to: href('/'), label: 'Overview' },
  { to: href('/analytics'), label: 'Analytics' },
  { to: href('/cms'), label: 'CMS' },
  { to: href('/inbox'), label: 'Inbox' },
  { to: href('/quotas'), label: 'Quotas' },
  { to: href('/ops'), label: 'Ops' },
] as const;

function isNavItemActive(pathname: string, to: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (to === '/') return normalized === '/';
  return normalized === to || normalized.startsWith(`${to}/`);
}

function getAdminPaneTitle(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return normalized === '/' ? 'tui :: admin' : `tui :: admin${normalized}`;
}

export interface AdminRootShellProps {
  readonly data: AdminRootLoaderData;
  readonly session: AuthSession | null;
  readonly isLoginRoute: boolean;
  readonly pathname: string;
  readonly navigate: (to: string) => void | Promise<void>;
}

export function AdminRootShell({
  data: rootData,
  session,
  isLoginRoute,
  pathname,
  navigate,
}: AdminRootShellProps) {
  const outlet = useOutlet();
  const [signingOut, setSigningOut] = useState(false);
  const layoutMode = useViewportLayoutMode();
  const { chrome, terminal } = rootData;
  const effectiveIsLoginRoute = isLoginRoute || normalizeWorkspaceRouteKey(pathname) === '/login';
  const isAdminSession = session?.role === 'admin';
  const isHandheld = layoutMode !== 'desktop';
  const isAuthenticatedHandheld = !effectiveIsLoginRoute && isAdminSession && isHandheld;
  const resolvedTerminal = effectiveIsLoginRoute || !isAdminSession ? undefined : terminal;
  const hasGlobalWorkspace =
    !effectiveIsLoginRoute && isAdminSession && !isHandheld && Boolean(resolvedTerminal);

  if (!effectiveIsLoginRoute && !isAdminSession && isHandheld) {
    emitAdminUnauthMobileShellBlocked(pathname);
  }

  const workspaceMountBranch: AdminWorkspaceMountBranch = isAuthenticatedHandheld
    ? 'mobile-tui-workspace'
    : hasGlobalWorkspace
      ? 'lazy-terminal-workspace'
      : 'login-outlet-only';
  emitAdminWorkspaceMountBranch(workspaceMountBranch, pathname);

  if (effectiveIsLoginRoute || !isAdminSession) {
    if (typeof window !== 'undefined') {
      adminRouteWorkspaceStore.clearAll({ silent: true });
    }
    adminRouteWorkspaceStore.recordRoutePolicy(pathname, 'admin-cleared');
  } else if (hasGlobalWorkspace) {
    adminRouteWorkspaceStore.recordRoutePolicy(pathname, 'cached-workspace');
  }

  async function handleSignOut() {
    setSigningOut(true);
    adminRouteWorkspaceStore.clearAll();
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      adminRouteWorkspaceStore.clearAll({ silent: true });
      window.location.assign(href('/login'));
    }
  }

  if (isAuthenticatedHandheld) {
    return (
      <AdminMobileWorkspaceHost
        layoutMode={layoutMode}
        chrome={chrome}
        pathname={pathname}
        signingOut={signingOut}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <div className={styles.shell} data-pane-workspace={hasGlobalWorkspace ? 'true' : 'false'}>
      <header className={styles.bar}>
        <NavigationMenu.Root aria-label='Admin console navigation'>
          <NavigationMenu.List className={styles.navList}>
            <NavigationMenu.Item>
              <NavigationMenu.Link
                render={<Link to={href('/')} prefetch='intent' />}
                className={styles.brand}
              >
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
                        render={<Link to={item.to} prefetch='intent' />}
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
        {!effectiveIsLoginRoute && isAdminSession && resolvedTerminal ? (
          <LazyChunkBoundary
            loadingLabel='Loading terminal workspace...'
            errorTitle='Unable to load terminal workspace'
            onChunkError={error => {
              reportAdminLazyChunkError('@aklapper/ui/terminal-workspace', pathname, error);
            }}
          >
            <LazyAdminRouteWorkspace
              pathname={pathname}
              outlet={outlet}
              terminal={resolvedTerminal}
              navigate={navigate}
            />
          </LazyChunkBoundary>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
