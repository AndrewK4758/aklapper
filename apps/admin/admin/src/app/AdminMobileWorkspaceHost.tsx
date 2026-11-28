import type { AdminRootLoaderData } from '@aklapper/core';
import {
  Button,
  cx,
  LazyChunkBoundary,
  lazyWithRetry,
  mobileChromeClasses,
  OscStatusBadge,
  SolarForgeEmblem,
} from '@aklapper/ui';
import type { MobileNavItem, MobileTuiWorkspaceProps } from '@aklapper/ui/mobile-tui-workspace';
import { href, Link, Outlet } from 'react-router';

import { reportAdminLazyChunkError } from './client-telemetry';

import styles from './root.module.css';

const LazyMobileTuiWorkspace = lazyWithRetry(() => import('@aklapper/ui/mobile-tui-workspace'));

const ADMIN_MOBILE_NAV = [
  { id: 'home', to: href('/'), label: 'Home', shortLabel: 'Home', icon: '⌂' },
  { id: 'cms', to: href('/cms'), label: 'CMS', shortLabel: 'CMS', icon: '✎' },
  { id: 'inbox', to: href('/inbox'), label: 'Inbox', shortLabel: 'Inbox', icon: '✉' },
  { id: 'ops', to: href('/ops'), label: 'Ops', shortLabel: 'Ops', icon: '⚙' },
  { id: 'analytics', to: href('/analytics'), label: 'Analytics', shortLabel: 'Stats', icon: '◔' },
] as const;

function isNavItemActive(pathname: string, to: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (to === '/') return normalized === '/';
  return normalized === to || normalized.startsWith(`${to}/`);
}

function getAdminMobileTtyLabel(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return normalized === '/' ? 'tty1 :: admin' : `tty1 :: admin${normalized}`;
}

export interface AdminMobileWorkspaceHostProps {
  readonly layoutMode: MobileTuiWorkspaceProps['layoutMode'];
  readonly chrome: AdminRootLoaderData['chrome'];
  readonly pathname: string;
  readonly signingOut: boolean;
  readonly onSignOut: () => void | Promise<void>;
}

export function AdminMobileWorkspaceHost({
  layoutMode,
  chrome,
  pathname,
  signingOut,
  onSignOut,
}: AdminMobileWorkspaceHostProps) {
  const mobileNavItems: readonly MobileNavItem[] = ADMIN_MOBILE_NAV.map(item => ({
    id: item.id,
    label: item.label,
    shortLabel: item.shortLabel,
    icon: item.icon,
    active: isNavItemActive(pathname, item.to),
    renderLink: linkProps => (
      <Link to={item.to} prefetch='intent' {...linkProps}>
        {linkProps.children}
      </Link>
    ),
  }));

  const quotasActive = isNavItemActive(pathname, href('/quotas'));
  const mobileActions = (
    <>
      <Link
        to={href('/quotas')}
        prefetch='intent'
        className={mobileChromeClasses.secondaryLink}
        data-active={quotasActive ? 'true' : 'false'}
        aria-current={quotasActive ? 'page' : undefined}
      >
        Quotas
      </Link>
      <Button.Root
        type='button'
        variant='ghost'
        size='sm'
        className={styles.mobileSignOutButton}
        loading={signingOut}
        onClick={() => {
          void onSignOut();
        }}
      >
        <Button.Label>Sign Out</Button.Label>
      </Button.Root>
    </>
  );

  const quickLaunchItems = (
    <>
      {ADMIN_MOBILE_NAV.map(item => (
        <Link
          key={item.id}
          to={item.to}
          prefetch='intent'
          className={mobileChromeClasses.secondaryLink}
          data-active={isNavItemActive(pathname, item.to) ? 'true' : 'false'}
        >
          {item.label}
        </Link>
      ))}
      <Link
        to={href('/quotas')}
        prefetch='intent'
        className={mobileChromeClasses.secondaryLink}
        data-active={quotasActive ? 'true' : 'false'}
      >
        Quotas
      </Link>
    </>
  );

  return (
    <LazyChunkBoundary
      loadingLabel='Loading mobile admin workspace...'
      errorTitle='Unable to load mobile admin workspace'
      onChunkError={error => {
        reportAdminLazyChunkError('@aklapper/ui/mobile-tui-workspace', pathname, error);
      }}
    >
      <LazyMobileTuiWorkspace
        layoutMode={layoutMode}
        routeKey={pathname}
        brand={
          <Link
            to={href('/')}
            prefetch='intent'
            className={cx(mobileChromeClasses.brand, mobileChromeClasses.brandAccent)}
          >
            <SolarForgeEmblem size={18} />
            <span>{chrome.brandLabel}</span>
          </Link>
        }
        activeTtyLabel={getAdminMobileTtyLabel(pathname)}
        navLabel='Admin mobile navigation'
        navItems={mobileNavItems}
        statusBadge={
          <OscStatusBadge
            source={chrome.statusBadge.source}
            state='ready'
            label='Passkey Verified'
          />
        }
        overflowItems={mobileActions}
        quickLaunchItems={quickLaunchItems}
        railFooterActions={mobileActions}
      >
        <Outlet />
      </LazyMobileTuiWorkspace>
    </LazyChunkBoundary>
  );
}
