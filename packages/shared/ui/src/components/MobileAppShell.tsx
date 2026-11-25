import { type ReactNode, useState } from 'react';

import { Button } from '../elements/base';

import styles from './MobileAppShell.module.css';

export interface MobileNavItem {
  readonly id: string;
  readonly label: string;
  readonly shortLabel?: string;
  readonly icon: ReactNode;
  readonly active: boolean;
  readonly renderLink: (props: {
    readonly className: string;
    readonly 'aria-current'?: 'page';
    readonly 'data-active': 'true' | 'false';
    readonly children: ReactNode;
  }) => ReactNode;
}

export interface MobileAppShellProps {
  readonly layoutMode: 'mobile-portrait' | 'mobile-landscape';
  readonly brand: ReactNode;
  readonly pageTitle: string;
  readonly navLabel: string;
  readonly navItems: readonly MobileNavItem[];
  readonly headerActions?: ReactNode;
  readonly secondaryMenuItems?: ReactNode;
  readonly railFooterActions?: ReactNode;
  readonly children: ReactNode;
}

export function MobileAppShell({
  layoutMode,
  brand,
  pageTitle,
  navLabel,
  navItems,
  headerActions,
  secondaryMenuItems,
  railFooterActions,
  children,
}: MobileAppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [railExpanded, setRailExpanded] = useState(false);

  if (layoutMode === 'mobile-landscape') {
    return (
      <div
        className={styles.landscapeShell}
        data-mobile-shell='landscape'
        data-rail-expanded={railExpanded ? 'true' : 'false'}
      >
        <nav
          className={styles.rail}
          aria-label={navLabel}
          data-mobile-rail='true'
          data-expanded={railExpanded ? 'true' : 'false'}
        >
          <div className={styles.railTop}>
            <Button.Root
              type='button'
              variant='ghost'
              size='sm'
              className={styles.railToggle}
              aria-expanded={railExpanded}
              aria-label={railExpanded ? 'Collapse navigation rail' : 'Expand navigation rail'}
              onClick={() => setRailExpanded(expanded => !expanded)}
            >
              <Button.Icon aria-hidden='true'>{railExpanded ? '‹' : '›'}</Button.Icon>
              {railExpanded ? <span className={styles.railBrand}>{brand}</span> : null}
            </Button.Root>
          </div>
          <ul className={styles.railList}>
            {navItems.map(item => (
              <li key={item.id} className={styles.railItem}>
                {item.renderLink({
                  className: styles.railLink,
                  'aria-current': item.active ? 'page' : undefined,
                  'data-active': item.active ? 'true' : 'false',
                  children: (
                    <>
                      <span className={styles.navIcon} aria-hidden='true'>
                        {item.icon}
                      </span>
                      <span className={railExpanded ? styles.railLabel : styles.srOnly}>
                        {item.label}
                      </span>
                    </>
                  ),
                })}
              </li>
            ))}
          </ul>
          {railFooterActions ? (
            <div className={styles.railFooter} data-mobile-rail-footer='true'>
              {railFooterActions}
            </div>
          ) : null}
        </nav>
        <main className={styles.landscapeMain} data-mobile-main='landscape'>
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className={styles.portraitShell} data-mobile-shell='portrait'>
      <header className={styles.header} data-mobile-header='true'>
        <div className={styles.headerBar}>
          <div className={styles.headerBrand}>{brand}</div>
          <span className={styles.pageTitle}>{pageTitle}</span>
          <div className={styles.headerActions}>
            {headerActions}
            {secondaryMenuItems ? (
              <Button.Root
                type='button'
                variant='ghost'
                size='sm'
                className={styles.menuToggle}
                aria-expanded={menuOpen}
                aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                onClick={() => setMenuOpen(open => !open)}
              >
                <Button.Icon aria-hidden='true'>{menuOpen ? '×' : '≡'}</Button.Icon>
              </Button.Root>
            ) : null}
          </div>
        </div>
        {menuOpen && secondaryMenuItems ? (
          <section
            className={styles.secondaryMenu}
            data-mobile-secondary-menu='true'
            aria-label='More navigation and actions'
          >
            {secondaryMenuItems}
          </section>
        ) : null}
      </header>
      <main className={styles.portraitMain} data-mobile-main='portrait'>
        {children}
      </main>
      <nav className={styles.bottomNav} aria-label={navLabel} data-mobile-bottom-nav='true'>
        <ul className={styles.bottomNavList}>
          {navItems.map(item => (
            <li key={item.id} className={styles.bottomNavItem}>
              {item.renderLink({
                className: styles.bottomNavLink,
                'aria-current': item.active ? 'page' : undefined,
                'data-active': item.active ? 'true' : 'false',
                children: (
                  <>
                    <span className={styles.navIcon} aria-hidden='true'>
                      {item.icon}
                    </span>
                    <span className={styles.bottomNavLabel}>{item.shortLabel ?? item.label}</span>
                  </>
                ),
              })}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
