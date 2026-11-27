import { normalizePathname, type PortalRootLoaderData } from '@aklapper/core';
import { trackTerminalCommand } from '@aklapper/core/analytics';
import {
  Button,
  Menu,
  NavigationMenu,
  OscStatusBadge,
  Separator,
  SolarForgeEmblem,
  TerminalWorkspace,
  useViewportLayoutMode,
  useWorkspaceLauncher,
} from '@aklapper/ui';
import { useMemo } from 'react';
import { href, Link, Outlet } from 'react-router';

import { PortalLauncherTui } from '#pages/home';

import { PortalMobileWorkspaceHost } from './PortalMobileWorkspaceHost';
import { isPortalPaneRoute, renderPortalPaneView } from './portalPaneViews';
import type { RuntimeStatusTelemetrySnapshot } from './runtime-status';
import { createPortalTerminalForms } from './terminalForms';
import { PortalWorkspaceProvider } from './workspace/PortalWorkspaceContext';
import { portalWorkspaceStore } from './workspace/portalWorkspaceStore';

import styles from './root.module.css';

function getPortalPaneTitle(pathname: string): string {
  return pathname === '/' ? 'tty1' : `tui :: ${pathname}`;
}

const PORTAL_NAV_ITEMS = [
  { to: href('/about'), label: 'About' },
  { to: href('/cadence'), label: 'CADENCE' },
  { to: href('/chat'), label: 'Chat' },
  { to: href('/agensi'), label: 'Agensi' },
  { to: href('/contact'), label: 'Contact' },
] as const;

function isPortalNavItemActive(pathname: string, to: string): boolean {
  const normalized = normalizePathname(pathname);
  return normalized === to || normalized.startsWith(`${to}/`);
}

const PANE_LAUNCHER_ITEMS = [
  { label: 'About', viewId: '/about' },
  { label: 'CADENCE', viewId: '/cadence' },
  { label: 'Chat', viewId: '/chat' },
  { label: 'Agensi', viewId: '/agensi' },
  { label: 'Contact', viewId: '/contact' },
  { label: 'Launcher TUI', viewId: 'tui' },
] as const;

function PortalHeaderPaneMenu() {
  const launcher = useWorkspaceLauncher();
  if (!launcher) {
    return null;
  }

  return (
    <Menu.Root>
      <Menu.Trigger className={styles.openPaneTrigger}>Open Pane</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align='end' sideOffset={6}>
          <Menu.Popup aria-label='Open workspace pane'>
            <Menu.Group>
              <Menu.GroupLabel>Open in Split</Menu.GroupLabel>
              {PANE_LAUNCHER_ITEMS.map(item => (
                <Menu.Item
                  key={`split:${item.viewId}`}
                  onClick={() => launcher.openPane(item.viewId, 'split')}
                >
                  {item.label} (Split)
                </Menu.Item>
              ))}
              <Menu.Item onClick={() => launcher.openTerminal('split')}>Terminal (Split)</Menu.Item>
            </Menu.Group>
            <Menu.Separator />
            <Menu.Group>
              <Menu.GroupLabel>Open in Tab</Menu.GroupLabel>
              {PANE_LAUNCHER_ITEMS.map(item => (
                <Menu.Item
                  key={`tab:${item.viewId}`}
                  onClick={() => launcher.openPane(item.viewId, 'tab')}
                >
                  {item.label} (Tab)
                </Menu.Item>
              ))}
              <Menu.Item onClick={() => launcher.openTerminal('tab')}>Terminal (Tab)</Menu.Item>
            </Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export interface PortalRootShellProps {
  readonly data: PortalRootLoaderData;
  readonly pathname: string;
  readonly locationKey?: string;
  readonly runtimeStatus: RuntimeStatusTelemetrySnapshot;
  readonly navigate: (to: string) => void | Promise<void>;
}

export function PortalRootShell({
  data,
  pathname,
  locationKey,
  runtimeStatus,
  navigate,
}: PortalRootShellProps) {
  const layoutMode = useViewportLayoutMode();
  const terminalForms = useMemo(
    () => createPortalTerminalForms(data.contactForm, navigate),
    [data.contactForm, navigate],
  );

  const { chrome, terminal, homeContent } = data;
  const isTerminalViewport = pathname === '/';
  const isPortalPaneDeepLink = isPortalPaneRoute(pathname);
  const hasGlobalWorkspace = layoutMode === 'desktop' && Boolean(terminal);
  if (hasGlobalWorkspace) {
    portalWorkspaceStore.recordRoutePolicy(pathname, 'global-workspace');
  }
  const headerBadgeState = runtimeStatus.loaded
    ? runtimeStatus.summaryState
    : chrome.statusBadge.state;
  const headerBadgeLabel =
    runtimeStatus.loaded && runtimeStatus.summaryLabel
      ? runtimeStatus.summaryLabel
      : chrome.statusBadge.label;

  if (layoutMode !== 'desktop') {
    return (
      <PortalMobileWorkspaceHost
        layoutMode={layoutMode}
        data={data}
        pathname={pathname}
        runtimeStatus={runtimeStatus}
        navigate={navigate}
      />
    );
  }

  const shellContent = (
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
              <li aria-hidden='true' className={styles.brandSeparator}>
                |
              </li>
              {PORTAL_NAV_ITEMS.map(item => {
                const active = isPortalNavItemActive(pathname, item.to);
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
              })}
            </NavigationMenu.List>
          </NavigationMenu.Root>
          <div className={styles.barMeta}>
            {hasGlobalWorkspace ? <PortalHeaderPaneMenu /> : null}
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
            isActive
            disableMenuShortcut
            navigatePrimaryInPaneRoutes
            routeKey={pathname}
            workspaceStore={portalWorkspaceStore}
            onCommandExecute={commandName => {
              trackTerminalCommand(commandName, pathname);
            }}
            navigate={to => {
              void navigate(to);
            }}
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
              isRouteView: isPortalPaneDeepLink,
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

  if (!hasGlobalWorkspace) {
    return shellContent;
  }

  return (
    <PortalWorkspaceProvider pathname={pathname} locationKey={locationKey ?? pathname}>
      {shellContent}
    </PortalWorkspaceProvider>
  );
}
