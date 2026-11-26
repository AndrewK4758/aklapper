import type { PortalRootLoaderData } from '@aklapper/core';
import { OscStatusBadge, SolarForgeEmblem } from '@aklapper/ui';
import { type MobileNavItem, MobileTuiWorkspace } from '@aklapper/ui/mobile-tui-workspace';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { href, Link, Outlet } from 'react-router';

import { PortalLauncherTui } from '#pages/home';

import { isPortalPaneRoute, renderPortalPaneView } from './portalPaneViews';
import type { RuntimeStatusTelemetrySnapshot } from './runtime-status';
import { portalPaneStreamStore } from './workspace/portalPaneStreamStore';

import styles from './root.module.css';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
const MOBILE_PANE_ID = 'mobile-tty1';

const PORTAL_MOBILE_NAV = [
  { id: 'terminal', to: href('/'), label: 'Terminal', shortLabel: 'TUI', icon: '>_' },
  { id: 'agensi', to: href('/agensi'), label: 'Agensi', shortLabel: 'Skills', icon: '::' },
  { id: 'chat', to: href('/chat'), label: 'Chat', shortLabel: 'Chat', icon: '?' },
  { id: 'cadence', to: href('/cadence'), label: 'CADENCE', shortLabel: 'CAD', icon: '◈' },
  { id: 'contact', to: href('/contact'), label: 'Contact', shortLabel: 'Mail', icon: '@' },
] as const;

function isPortalNavActive(pathname: string, to: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (to === '/') return normalized === '/';
  return normalized === to || normalized.startsWith(`${to}/`);
}

function getPortalMobileTtyLabel(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return normalized === '/' ? 'tty1 :: /' : `tty1 :: ${normalized}`;
}

export interface PortalMobileWorkspaceHostProps {
  readonly layoutMode: 'mobile-portrait' | 'mobile-landscape';
  readonly data: PortalRootLoaderData;
  readonly pathname: string;
  readonly runtimeStatus: RuntimeStatusTelemetrySnapshot;
  readonly navigate: (to: string) => void | Promise<void>;
}

export function PortalMobileWorkspaceHost({
  layoutMode,
  data,
  pathname,
  runtimeStatus,
  navigate,
}: PortalMobileWorkspaceHostProps) {
  const [paneStack, setPaneStack] = useState<readonly string[]>([]);
  const [prevPathname, setPrevPathname] = useState(pathname);
  const lastPathnameRef = useRef(pathname);

  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (paneStack.length > 0) {
      setPaneStack([]);
    }
  }

  useIsomorphicLayoutEffect(() => {
    if (lastPathnameRef.current !== pathname) {
      lastPathnameRef.current = pathname;
      portalPaneStreamStore.evictPane(MOBILE_PANE_ID);
    }
  }, [pathname]);

  useIsomorphicLayoutEffect(
    () => () => {
      portalPaneStreamStore.evictPane(MOBILE_PANE_ID);
    },
    [],
  );

  const pushPane = (viewId: string) => {
    if (isPortalPaneRoute(viewId)) {
      portalPaneStreamStore.prewarm(MOBILE_PANE_ID, viewId);
    }
    setPaneStack(prev => [...prev, viewId]);
  };

  const popPane = () => {
    const top = paneStack[paneStack.length - 1];
    const nextStack = paneStack.slice(0, -1);
    if (nextStack.length === 0) {
      portalPaneStreamStore.evictPane(MOBILE_PANE_ID);
    } else if (top && isPortalPaneRoute(top) && !nextStack.includes(top)) {
      portalPaneStreamStore.evictPaneViews([{ paneId: MOBILE_PANE_ID, routePath: top }]);
    }
    setPaneStack(nextStack);
  };

  const exitPane = () => {
    portalPaneStreamStore.evictPane(MOBILE_PANE_ID);
    setPaneStack([]);
  };

  const { chrome, homeContent } = data;
  const headerBadgeState = runtimeStatus.loaded
    ? runtimeStatus.summaryState
    : chrome.statusBadge.state;
  const headerBadgeLabel =
    runtimeStatus.loaded && runtimeStatus.summaryLabel
      ? runtimeStatus.summaryLabel
      : chrome.statusBadge.label;

  const mobileNavItems: readonly MobileNavItem[] = PORTAL_MOBILE_NAV.map(item => ({
    id: item.id,
    label: item.label,
    shortLabel: item.shortLabel,
    icon: item.icon,
    active: isPortalNavActive(pathname, item.to),
    renderLink: linkProps => (
      <Link to={item.to} prefetch='intent' {...linkProps}>
        {linkProps.children}
      </Link>
    ),
  }));

  const aboutActive = isPortalNavActive(pathname, href('/about'));
  const aboutLink = (
    <Link
      to={href('/about')}
      prefetch='intent'
      className={styles.mobileSecondaryLink}
      data-active={aboutActive ? 'true' : 'false'}
      aria-current={aboutActive ? 'page' : undefined}
    >
      About
    </Link>
  );

  const statusBadge = (
    <OscStatusBadge
      source={chrome.statusBadge.source}
      state={headerBadgeState}
      label={headerBadgeLabel}
    />
  );

  return (
    <MobileTuiWorkspace
      layoutMode={layoutMode}
      routeKey={pathname}
      brand={
        <Link to={href('/')} prefetch='intent' className={styles.mobileBrand}>
          <SolarForgeEmblem size={18} />
          <span>{chrome.brandLabel}</span>
        </Link>
      }
      activeTtyLabel={getPortalMobileTtyLabel(pathname)}
      navLabel='Portal mobile navigation'
      navItems={mobileNavItems}
      statusBadge={statusBadge}
      paneStack={paneStack}
      onPushPane={pushPane}
      onPopPane={popPane}
      onExitPane={exitPane}
      overflowItems={
        <>
          {aboutLink}
          {chrome.brandContactEmail ? (
            <Link to={href('/contact')} prefetch='intent' className={styles.mobileSecondaryLink}>
              {chrome.brandContactEmail}
            </Link>
          ) : null}
        </>
      }
      quickLaunchItems={
        homeContent ? (
          <PortalLauncherTui
            content={homeContent}
            ttyNumber={1}
            isSinglePane
            onClose={() => {
              exitPane();
              void navigate(href('/'));
            }}
          />
        ) : (
          aboutLink
        )
      }
      railFooterActions={aboutLink}
      renderStackedPane={viewId =>
        renderPortalPaneView({
          ctx: {
            viewId,
            paneId: MOBILE_PANE_ID,
            ttyNumber: 1,
            isSinglePane: true,
            isActive: true,
            isInitialPrimaryDeepLink: false,
            stack: paneStack,
            push: pushPane,
            pop: popPane,
            exitTui: exitPane,
            openInSplit: pushPane,
            openInTab: pushPane,
          },
          homeContent,
        })
      }
    >
      <Outlet />
    </MobileTuiWorkspace>
  );
}
