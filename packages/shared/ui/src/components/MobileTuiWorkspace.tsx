import { type FocusEvent, type JSX, type ReactNode, useMemo, useState } from 'react';

import { cx } from '../elements/_internal/elementFactory';
import { Button } from '../elements/base/Button';
import { Dialog } from '../elements/base/Dialog';
import { PaneNavigationContext, type PaneNavigationContextValue } from './paneNavigationContext';

import styles from './MobileTuiWorkspace.module.css';

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

export interface MobileTuiWorkspaceProps {
  readonly layoutMode: 'mobile-portrait' | 'mobile-landscape';
  readonly brand: ReactNode;
  readonly activeTtyLabel: string;
  readonly navLabel: string;
  readonly navItems: readonly MobileNavItem[];
  readonly statusBadge?: ReactNode;
  readonly overflowItems?: ReactNode;
  readonly quickLaunchItems?: ReactNode;
  readonly railFooterActions?: ReactNode;
  readonly terminalAccessoryBar?: ReactNode;
  readonly keyboardActive?: boolean;
  readonly paneStack?: readonly string[];
  readonly onPushPane?: (viewId: string) => void;
  readonly onPopPane?: () => void;
  readonly onExitPane?: () => void;
  readonly renderStackedPane?: (viewId: string) => ReactNode;
  readonly children: ReactNode;
}

export function MobileTuiWorkspace({
  layoutMode,
  brand,
  activeTtyLabel,
  navLabel,
  navItems,
  statusBadge,
  overflowItems,
  quickLaunchItems,
  railFooterActions,
  terminalAccessoryBar,
  keyboardActive = false,
  paneStack,
  onPushPane,
  onPopPane,
  onExitPane,
  renderStackedPane,
  children,
}: MobileTuiWorkspaceProps): JSX.Element {
  const [internalStack, setInternalStack] = useState<readonly string[]>([]);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [quickLaunchOpen, setQuickLaunchOpen] = useState(false);
  const [railExpanded, setRailExpanded] = useState(false);
  const [terminalInputFocused, setTerminalInputFocused] = useState(false);

  const isKeyboardSuppressed = keyboardActive || terminalInputFocused;

  const handleMainFocusCapture = (event: FocusEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.dataset.terminalInput === 'true') {
      setTerminalInputFocused(true);
    }
  };

  const handleMainBlurCapture = (event: FocusEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.dataset.terminalInput === 'true') {
      setTerminalInputFocused(false);
    }
  };

  const stack = paneStack ?? internalStack;
  const canGoBack = stack.length > 0;
  const activeStackedViewId = stack.length > 0 ? stack[stack.length - 1] : null;

  const paneNavValue = useMemo<PaneNavigationContextValue>(
    () => ({
      paneId: 'mobile-tty1',
      ttyNumber: 1,
      isActive: true,
      isSinglePane: true,
      docked: true,
      stack,
      canGoBack,
      push: (viewId: string) => {
        if (onPushPane) {
          onPushPane(viewId);
        } else {
          setInternalStack(prev => [...prev, viewId]);
        }
      },
      pop: () => {
        if (onPopPane) {
          onPopPane();
        } else {
          setInternalStack(prev => prev.slice(0, -1));
        }
      },
      exitTui: () => {
        if (onExitPane) {
          onExitPane();
        } else {
          setInternalStack([]);
        }
      },
      openInSplit: (viewId: string) => {
        if (onPushPane) {
          onPushPane(viewId);
        } else {
          setInternalStack(prev => [...prev, viewId]);
        }
      },
      openInTab: (viewId: string) => {
        if (onPushPane) {
          onPushPane(viewId);
        } else {
          setInternalStack(prev => [...prev, viewId]);
        }
      },
    }),
    [canGoBack, onExitPane, onPopPane, onPushPane, stack],
  );

  const activePaneContent =
    activeStackedViewId && renderStackedPane ? renderStackedPane(activeStackedViewId) : children;

  const breadcrumbText = activeStackedViewId
    ? `${activeTtyLabel} / ${activeStackedViewId}`
    : activeTtyLabel;

  const statusHeader = (
    <header className={styles.statusHeader} data-mobile-tui-header='true'>
      <div className={styles.headerStart}>
        {canGoBack ? (
          <Button.Root
            type='button'
            variant='ghost'
            size='sm'
            className={styles.backButton}
            aria-label='Back to previous pane'
            onClick={paneNavValue.pop}
          >
            ← Back
          </Button.Root>
        ) : (
          <div className={styles.headerBrand}>{brand}</div>
        )}
        <span className={styles.ttyBreadcrumb} data-mobile-tui-breadcrumb='true'>
          {breadcrumbText}
        </span>
      </div>
      <div className={styles.headerEnd}>
        {statusBadge ? <div className={styles.statusSlot}>{statusBadge}</div> : null}
        {overflowItems ? (
          <Button.Root
            type='button'
            variant='ghost'
            size='sm'
            className={styles.headerIconButton}
            aria-expanded={overflowOpen}
            aria-label={overflowOpen ? 'Close workspace menu' : 'Open workspace menu'}
            onClick={() => setOverflowOpen(open => !open)}
          >
            <Button.Icon aria-hidden='true'>{overflowOpen ? '×' : '≡'}</Button.Icon>
          </Button.Root>
        ) : null}
      </div>
    </header>
  );

  const overflowSheet = overflowItems ? (
    <Dialog.Root open={overflowOpen} onOpenChange={setOverflowOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Viewport>
          <Dialog.Popup data-mobile-overflow-sheet='true'>
            <Dialog.Header>
              <Dialog.Title>Workspace Menu</Dialog.Title>
              <Dialog.Close aria-label='Close workspace menu'>×</Dialog.Close>
            </Dialog.Header>
            <Dialog.Body className={styles.sheetBody}>{overflowItems}</Dialog.Body>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  ) : null;

  const quickLaunchSheet = quickLaunchItems ? (
    <Dialog.Root open={quickLaunchOpen} onOpenChange={setQuickLaunchOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Viewport>
          <Dialog.Popup data-mobile-quick-launch-sheet='true'>
            <Dialog.Header>
              <Dialog.Title>TUI Quick Launch</Dialog.Title>
              <Dialog.Close aria-label='Close TUI quick launch'>×</Dialog.Close>
            </Dialog.Header>
            <Dialog.Body className={styles.sheetBody}>{quickLaunchItems}</Dialog.Body>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  ) : null;

  if (layoutMode === 'mobile-landscape') {
    return (
      <PaneNavigationContext.Provider value={paneNavValue}>
        <div
          className={styles.landscapeWorkspace}
          data-mobile-tui-workspace='landscape'
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
                        <span className={styles.dockIcon} aria-hidden='true'>
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
              {quickLaunchItems ? (
                <li className={styles.railItem}>
                  <button
                    type='button'
                    className={styles.railLink}
                    aria-expanded={quickLaunchOpen}
                    aria-label='TUI Quick Launch'
                    onClick={() => setQuickLaunchOpen(true)}
                  >
                    <span className={styles.dockIcon} aria-hidden='true'>
                      ⌘
                    </span>
                    <span className={railExpanded ? styles.railLabel : styles.srOnly}>TUI</span>
                  </button>
                </li>
              ) : null}
            </ul>
            {railFooterActions ? (
              <div className={styles.railFooter} data-mobile-rail-footer='true'>
                {railFooterActions}
              </div>
            ) : null}
          </nav>

          <div className={styles.landscapeColumn}>
            {statusHeader}
            <main className={styles.paneMain} data-mobile-main='landscape'>
              {activePaneContent}
            </main>
            {terminalAccessoryBar}
          </div>
          {overflowSheet}
          {quickLaunchSheet}
        </div>
      </PaneNavigationContext.Provider>
    );
  }

  return (
    <PaneNavigationContext.Provider value={paneNavValue}>
      <div
        className={styles.portraitWorkspace}
        data-mobile-tui-workspace='portrait'
        data-keyboard-active={isKeyboardSuppressed ? 'true' : 'false'}
      >
        {statusHeader}
        <main
          className={cx(styles.paneMain, !isKeyboardSuppressed && styles.portraitMainWithDock)}
          data-mobile-main='portrait'
          onFocusCapture={handleMainFocusCapture}
          onBlurCapture={handleMainBlurCapture}
        >
          {activePaneContent}
        </main>
        {terminalAccessoryBar}
        {!isKeyboardSuppressed ? (
          <nav className={styles.bottomDock} aria-label={navLabel} data-mobile-tui-dock='true'>
            <ul className={styles.dockList}>
              {navItems.map(item => (
                <li key={item.id} className={styles.dockItem}>
                  {item.renderLink({
                    className: styles.dockLink,
                    'aria-current': item.active ? 'page' : undefined,
                    'data-active': item.active ? 'true' : 'false',
                    children: (
                      <>
                        <span className={styles.dockIcon} aria-hidden='true'>
                          {item.icon}
                        </span>
                        <span className={styles.dockLabel}>{item.shortLabel ?? item.label}</span>
                      </>
                    ),
                  })}
                </li>
              ))}
              {quickLaunchItems ? (
                <li className={styles.dockItem}>
                  <button
                    type='button'
                    className={styles.dockActionButton}
                    aria-expanded={quickLaunchOpen}
                    aria-label='Open TUI Quick Launch'
                    onClick={() => setQuickLaunchOpen(true)}
                  >
                    <span className={styles.dockIcon} aria-hidden='true'>
                      ⌘
                    </span>
                    <span className={styles.dockLabel}>TUI</span>
                  </button>
                </li>
              ) : null}
            </ul>
          </nav>
        ) : null}
        {overflowSheet}
        {quickLaunchSheet}
      </div>
    </PaneNavigationContext.Provider>
  );
}
