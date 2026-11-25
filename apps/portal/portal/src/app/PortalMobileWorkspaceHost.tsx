import type { PortalRootLoaderData } from '@aklapper/core';
import { OscStatusBadge, SolarForgeEmblem } from '@aklapper/ui';
import { type MobileNavItem, MobileTuiWorkspace } from '@aklapper/ui/mobile-tui-workspace';
import { href, Link, Outlet } from 'react-router';

import { PortalLauncherTui } from '#pages/home';

import type { ClusterTelemetrySnapshot } from './cluster-stream';
import { renderPortalPaneView } from './portalPaneViews';

import styles from './root.module.css';

const PORTAL_MOBILE_NAV = [
  { id: 'terminal', to: href('/'), label: 'Terminal', shortLabel: 'TUI', icon: '>_' },
  { id: 'menu', to: href('/menu'), label: 'Menu', shortLabel: 'Menu', icon: '::' },
  { id: 'ask', to: href('/ask'), label: 'Ask', shortLabel: 'Ask', icon: '?' },
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
  readonly cluster: ClusterTelemetrySnapshot;
  readonly navigate: (to: string) => void | Promise<void>;
}

export function PortalMobileWorkspaceHost({
  layoutMode,
  data,
  pathname,
  cluster,
  navigate,
}: PortalMobileWorkspaceHostProps) {
  const { chrome, homeContent } = data;
  const headerBadgeState = cluster.connected ? cluster.summaryState : chrome.statusBadge.state;
  const headerBadgeLabel =
    cluster.connected && cluster.summaryLabel ? cluster.summaryLabel : chrome.statusBadge.label;

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

  const agensiActive = isPortalNavActive(pathname, href('/agensi'));
  const agensiLink = (
    <Link
      to={href('/agensi')}
      prefetch='intent'
      className={styles.mobileSecondaryLink}
      data-active={agensiActive ? 'true' : 'false'}
      aria-current={agensiActive ? 'page' : undefined}
    >
      Agensi
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
      overflowItems={
        <>
          {agensiLink}
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
              void navigate(href('/'));
            }}
          />
        ) : (
          agensiLink
        )
      }
      railFooterActions={agensiLink}
      renderStackedPane={viewId =>
        renderPortalPaneView({
          ctx: {
            viewId,
            paneId: 'mobile-tty1',
            ttyNumber: 1,
            isSinglePane: true,
            stack: [viewId],
            canGoBack: true,
            push: next => {
              void navigate(next);
            },
            pop: () => {
              void navigate(href('/'));
            },
            exitTui: () => {
              void navigate(href('/'));
            },
            openInSplit: next => {
              void navigate(next);
            },
            openInTab: next => {
              void navigate(next);
            },
          },
          homeContent,
          deployments: cluster.deployments,
        })
      }
    >
      <Outlet />
    </MobileTuiWorkspace>
  );
}
