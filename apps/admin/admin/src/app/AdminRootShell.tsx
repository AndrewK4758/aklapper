import type { AdminRootLoaderData, AuthSession } from '@aklapper/core';
import {
  Button,
  LazyChunkBoundary,
  NavigationMenu,
  OscStatusBadge,
  SolarForgeEmblem,
} from '@aklapper/ui';
import { lazy, useState } from 'react';
import { href, Link, Outlet } from 'react-router';

import { reportAdminClientError } from './client-telemetry';

import styles from './root.module.css';

const LazyTerminalWorkspace = lazy(() =>
  import('@aklapper/ui/terminal-workspace').then(mod => ({ default: mod.TerminalWorkspace })),
);

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
  const [signingOut, setSigningOut] = useState(false);
  const { chrome, terminal } = rootData;
  const resolvedTerminal = isLoginRoute ? undefined : terminal;
  const hasGlobalWorkspace = !isLoginRoute && Boolean(resolvedTerminal);
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
        {!isLoginRoute && resolvedTerminal ? (
          <LazyChunkBoundary
            loadingLabel='Loading terminal workspace...'
            errorTitle='Unable to load terminal workspace'
            onChunkError={error => {
              console.error(
                JSON.stringify({
                  event: 'ui.lazy_chunk.load_failed',
                  module: '@aklapper/ui/terminal-workspace',
                  pathname,
                }),
              );
              reportAdminClientError(error, {
                phase: 'boundary',
                pathname,
                errorCode: 'ERR_UPSTREAM_UNAVAILABLE',
              });
            }}
          >
            <LazyTerminalWorkspace
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
          </LazyChunkBoundary>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
