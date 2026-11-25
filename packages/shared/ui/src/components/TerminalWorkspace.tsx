import {
  isAltNReadlineChord,
  matchTerminalReadlineShortcut,
  NEW_TAB_TOOLTIP_LABEL,
  type TerminalProfileData,
} from '@aklapper/core';
import {
  createContext,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Button, Toolbar, Tooltip } from '../elements/base';
import { buildZshCommandHandlers } from './buildZshCommands';
import { PaneActiveContext, useIsPaneActive } from './paneActiveContext';
import { PaneNavigationContext, type PaneNavigationContextValue } from './paneNavigationContext';
import { type TerminalFormConfig } from './terminalFormSession';
import {
  exitPaneTui,
  getActivePaneViewId,
  openViewInSplit,
  openViewInTab,
  popPaneView,
  pushPaneView,
  type TerminalNavTarget,
} from './terminalPaneNav';
import {
  addWorkspaceTab,
  closeActivePaneOrTab,
  closePaneById,
  closeWorkspaceTab,
  computeLeafRects,
  computePaneDropTarget,
  computeSplitDividers,
  createInitialTabbedWorkspaceState,
  detachPaneToNewTab,
  dockPane,
  equalizeAllSplits,
  findLeafPane,
  focusDirectionalPane,
  focusPaneById,
  focusRelativePane,
  getActiveWorkspaceTab,
  listLeafPanes,
  matchWorkspaceShortcut,
  moveActiveSplit,
  openTuiPane,
  type PaneDropTarget,
  renameWorkspaceTab,
  resizeActiveSplit,
  rotateActiveSplit,
  selectRelativeWorkspaceTab,
  selectWorkspaceTab,
  selectWorkspaceTabByIndex,
  setSplitRatio,
  splitActivePane,
  type SplitCreateDirection,
  type SplitDirection,
  type SplitDividerRect,
  swapActivePaneWithNeighbor,
  type TerminalLeafPane,
  type TerminalTabbedWorkspaceState,
  type TerminalWorkspaceTab,
  toggleTuiPane,
  toggleZoomActivePane,
  updateActiveTabWorkspace,
} from './terminalPaneTree';
import {
  TerminalReadlineRegistryContext,
  type ZshTerminalHandle,
} from './terminalReadlineRegistryContext';
import { ZshP10kTerminal, type ZshCommandHandler } from './ZshP10kTerminal';

import styles from './TerminalWorkspace.module.css';

export interface TerminalPaneTuiContext {
  readonly paneId: string;
  readonly ttyNumber: number;
  readonly isSinglePane: boolean;
  readonly closeTui: () => void;
}

export interface TerminalPaneViewContext {
  readonly paneId: string;
  readonly ttyNumber: number;
  readonly viewId: string;
  readonly stack: readonly string[];
  readonly isSinglePane: boolean;
  readonly isActive: boolean;
  readonly isInitialPrimaryDeepLink: boolean;
  readonly push: (viewId: string) => void;
  readonly pop: () => void;
  readonly exitTui: () => void;
  readonly openInSplit: (viewId: string) => void;
  readonly openInTab: (viewId: string) => void;
}

export interface TerminalWorkspacePrimaryPane {
  readonly title: string;
  readonly content: ReactNode;
  readonly flush?: boolean;
  readonly embeddedTerminal?: boolean;
}

export interface TerminalWorkspaceProps {
  terminal: TerminalProfileData;
  terminalForms?: Readonly<Record<string, TerminalFormConfig>>;
  navigate?: (to: string) => void | Promise<void>;
  renderTui?: (context: TerminalPaneTuiContext) => ReactNode;
  renderPaneView?: (context: TerminalPaneViewContext) => ReactNode;
  initialPrimaryTuiStack?: readonly string[];
  onPrimaryPaneReturnToShell?: () => void;
  dockTuiWindows?: boolean;
  canHandleInPaneRoute?: (to: string) => boolean;
  primaryPane?: TerminalWorkspacePrimaryPane;
  disableMenuShortcut?: boolean;
}

interface EmbeddedTerminalPaneContextValue {
  readonly pane: TerminalLeafPane;
  readonly isActive: boolean;
  readonly isMultiPane: boolean;
  readonly canCloseTab: boolean;
  readonly focusToken: number;
  readonly onFocus: (paneId: string) => void;
  readonly onSplit: (paneId: string, direction: SplitCreateDirection) => void;
  readonly onRotate: (paneId: string) => void;
  readonly onSwap: (paneId: string) => void;
  readonly onDetach: (paneId: string) => void;
  readonly onToggleZoom: (paneId: string) => void;
  readonly onClose: (paneId: string) => void;
  readonly onNewTab: () => void;
  readonly onCloseCurrentTab: () => void;
  readonly onOpenTui: (paneId: string, target?: TerminalNavTarget) => void;
  readonly onNavigateView?: (paneId: string, viewId: string, target: TerminalNavTarget) => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') {
    return false;
  }
  const el = target as HTMLElement;
  const tagName = el.tagName;
  return (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    Boolean(el.isContentEditable)
  );
}

function isVisibleOpenPopup(el: Element): boolean {
  return (
    el.closest('[hidden], [inert], [aria-hidden="true"]') === null &&
    el.getAttribute('data-closed') === null
  );
}

function hasOpenOverlayOrPopup(target: EventTarget | null): boolean {
  const popupSelector =
    '[role="listbox"], [role="menu"], [role="dialog"], [role="alertdialog"], dialog[open], [data-popup-open][aria-haspopup], [aria-expanded="true"][aria-haspopup]';
  if (
    target &&
    typeof target === 'object' &&
    'closest' in target &&
    typeof (target as Element).closest === 'function'
  ) {
    const match = (target as Element).closest(popupSelector);
    if (match && isVisibleOpenPopup(match)) {
      return true;
    }
  }
  if (typeof document !== 'undefined') {
    const candidates = document.querySelectorAll(popupSelector);
    for (const candidate of candidates) {
      if (isVisibleOpenPopup(candidate)) {
        return true;
      }
    }
  }
  return false;
}

function defaultCanHandleInPaneRoute(to: string): boolean {
  return to !== '/changes-in-progress';
}

interface SyncedTabState {
  readonly tabs: TerminalTabbedWorkspaceState;
  readonly embeddedTerminal: boolean | undefined;
  readonly deepLinkRoute: string | null;
}

function isPrimaryHostTab(tab: TerminalWorkspaceTab): boolean {
  return Boolean(tab.pinned);
}

function isPrimaryHostPane(
  tabPinned: boolean | undefined,
  panePinned: boolean | undefined,
): boolean {
  return Boolean(tabPinned && panePinned);
}

function findPrimaryHostPaneId(tab: TerminalWorkspaceTab): string | null {
  if (!tab.pinned) {
    return null;
  }
  const pinnedLeaf = listLeafPanes(tab.workspace.root).find(leaf => Boolean(leaf.pinned));
  return pinnedLeaf?.id ?? tab.workspace.activePaneId;
}

function exitPrimaryPaneTui(state: TerminalTabbedWorkspaceState): TerminalTabbedWorkspaceState {
  return {
    ...state,
    tabs: state.tabs.map(tab => {
      const hostPaneId = findPrimaryHostPaneId(tab);
      return hostPaneId ? { ...tab, workspace: exitPaneTui(tab.workspace, hostPaneId) } : tab;
    }),
  };
}

function seedPrimaryPaneDeepLink(
  state: TerminalTabbedWorkspaceState,
  deepLinkRoute: string,
): TerminalTabbedWorkspaceState {
  return {
    ...state,
    tabs: state.tabs.map(tab => {
      const hostPaneId = findPrimaryHostPaneId(tab);
      return hostPaneId
        ? {
            ...tab,
            workspace: pushPaneView(
              exitPaneTui(tab.workspace, hostPaneId),
              hostPaneId,
              deepLinkRoute,
            ),
          }
        : tab;
    }),
  };
}

function reconcilePrimaryRouteState(
  state: SyncedTabState,
  embeddedTerminal: boolean | undefined,
  deepLinkRoute: string | null,
): SyncedTabState {
  if (state.embeddedTerminal === embeddedTerminal && state.deepLinkRoute === deepLinkRoute) {
    return state;
  }
  if (deepLinkRoute !== null && deepLinkRoute !== state.deepLinkRoute) {
    return {
      tabs: seedPrimaryPaneDeepLink(state.tabs, deepLinkRoute),
      embeddedTerminal,
      deepLinkRoute,
    };
  }
  if (embeddedTerminal === true && state.embeddedTerminal === false) {
    return {
      tabs: exitPrimaryPaneTui(state.tabs),
      embeddedTerminal,
      deepLinkRoute,
    };
  }
  return {
    ...state,
    embeddedTerminal,
    deepLinkRoute,
  };
}

interface DragOrigin {
  readonly paneId: string;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly allowDetachTab: boolean;
  activated: boolean;
  lastTarget: PaneDropTarget | null;
}

interface ActiveDragState {
  readonly sourcePaneId: string;
  readonly target: PaneDropTarget | null;
}

interface DividerDragOrigin {
  readonly splitId: string;
  readonly direction: SplitDirection;
  readonly pointerId: number;
  readonly containerStart: number;
  readonly containerSpan: number;
  readonly initialRatio: number;
}

const DRAG_THRESHOLD_PX = 6;
const DIVIDER_KEY_STEP = 0.05;

const EmbeddedTerminalPaneContext = createContext<EmbeddedTerminalPaneContextValue | null>(null);

export { useIsPaneActive };

function resolveTabDisplayTitle(
  tab: TerminalWorkspaceTab,
  primaryPane?: TerminalWorkspacePrimaryPane,
): string {
  if (tab.title) {
    return tab.title;
  }
  const activeLeaf =
    findLeafPane(tab.workspace.root, tab.workspace.activePaneId) ??
    listLeafPanes(tab.workspace.root)[0];
  if (primaryPane && isPrimaryHostTab(tab) && !primaryPane.embeddedTerminal) {
    return primaryPane.title;
  }
  const activeViewId = activeLeaf ? getActivePaneViewId(activeLeaf) : null;
  if (activeViewId) {
    return activeViewId === 'tui' ? 'tui' : activeViewId.replace(/^\/+/, '');
  }
  if (activeLeaf?.kind === 'tui') {
    return 'tui';
  }
  return activeLeaf ? `tty${activeLeaf.ttyNumber}` : tab.id;
}

interface TabStripProps {
  tabs: readonly TerminalWorkspaceTab[];
  activeTabId: string;
  primaryPane?: TerminalWorkspacePrimaryPane;
  renamingTabId: string | null;
  renameDraft: string;
  isDetachPreview: boolean;
  onSelectTab: (tabId: string) => void;
  onAddTab: () => void;
  onCloseTab: (tabId: string) => void;
  onStartRename: (tabId: string, currentTitle: string) => void;
  onChangeRenameDraft: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
}

function focusRenameInput(node: HTMLInputElement | null): void {
  if (node) {
    node.focus();
    node.select();
  }
}

interface WorkspaceTooltipProps {
  label: string;
  disabled?: boolean;
  children: ReactElement;
}

function WorkspaceTooltip({ label, disabled = false, children }: WorkspaceTooltipProps) {
  if (disabled) {
    return children;
  }
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup>{label}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function TabStrip({
  tabs,
  activeTabId,
  primaryPane,
  renamingTabId,
  renameDraft,
  isDetachPreview,
  onSelectTab,
  onAddTab,
  onCloseTab,
  onStartRename,
  onChangeRenameDraft,
  onCommitRename,
  onCancelRename,
}: TabStripProps) {
  return (
    <div
      className={styles.tabStrip}
      data-tab-strip='true'
      data-drop-detach={isDetachPreview ? 'true' : 'false'}
    >
      <div className={styles.tabList} role='tablist' aria-label='Terminal workspace tabs'>
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId;
          const displayTitle = resolveTabDisplayTitle(tab, primaryPane);
          const paneCount = listLeafPanes(tab.workspace.root).length;
          const canClose = tabs.length > 1;
          const isRenaming = renamingTabId === tab.id;

          return (
            <div
              key={tab.id}
              className={styles.tabItem}
              data-tab-id={tab.id}
              data-active={isActive ? 'true' : 'false'}
            >
              {isRenaming ? (
                <input
                  ref={focusRenameInput}
                  type='text'
                  className={styles.tabRenameInput}
                  aria-label='Rename tab'
                  value={renameDraft}
                  onChange={event => onChangeRenameDraft(event.target.value)}
                  onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      onCommitRename();
                    } else if (event.key === 'Escape') {
                      event.preventDefault();
                      onCancelRename();
                    }
                  }}
                  onBlur={onCommitRename}
                />
              ) : (
                <WorkspaceTooltip label='Click to switch · double-click to rename'>
                  <button
                    type='button'
                    role='tab'
                    aria-selected={isActive}
                    className={styles.tabLabelButton}
                    onClick={() => onSelectTab(tab.id)}
                    onDoubleClick={() => onStartRename(tab.id, displayTitle)}
                  >
                    <span>{displayTitle}</span>
                    {paneCount > 1 ? (
                      <span className={styles.tabPaneCount} aria-label={`${paneCount} panes`}>
                        {paneCount}
                      </span>
                    ) : null}
                  </button>
                </WorkspaceTooltip>
              )}

              {canClose && !isRenaming ? (
                <Button.Root
                  type='button'
                  size='xs'
                  className={styles.tabCloseBtn}
                  aria-label={`Close tab ${displayTitle}`}
                  onClick={() => onCloseTab(tab.id)}
                >
                  <Button.Label>×</Button.Label>
                </Button.Root>
              ) : null}
            </div>
          );
        })}
      </div>

      <WorkspaceTooltip label={NEW_TAB_TOOLTIP_LABEL}>
        <Button.Root
          type='button'
          size='xs'
          className={styles.newTabBtn}
          aria-label='New terminal tab'
          onClick={onAddTab}
        >
          <Button.Label>+</Button.Label>
        </Button.Root>
      </WorkspaceTooltip>
    </div>
  );
}

interface PaneChromeBarProps {
  paneId: string;
  title: string;
  isZoomed: boolean;
  canClose: boolean;
  canDrag: boolean;
  onSplit: (paneId: string, direction: SplitCreateDirection) => void;
  onRotate: (paneId: string) => void;
  onDetach: (paneId: string) => void;
  onToggleZoom: (paneId: string) => void;
  onClose: (paneId: string) => void;
  onDragPointerDown?: (
    paneId: string,
    canDetach: boolean,
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  onDragPointerMove?: (event: ReactPointerEvent<HTMLElement>) => void;
  onDragPointerUp?: (event: ReactPointerEvent<HTMLElement>) => void;
  onDragPointerCancel?: () => void;
}

function PaneChromeBar({
  paneId,
  title,
  isZoomed,
  canClose,
  canDrag,
  onSplit,
  onRotate,
  onDetach,
  onToggleZoom,
  onClose,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerUp,
  onDragPointerCancel,
}: PaneChromeBarProps) {
  return (
    <div className={styles.paneBar}>
      <WorkspaceTooltip
        label='Drag to swap, dock, or drop onto tab strip to detach'
        disabled={!canDrag}
      >
        <span
          className={styles.paneTitle}
          data-draggable={canDrag ? 'true' : 'false'}
          data-pane-drag-handle={paneId}
          onPointerDown={
            canDrag && onDragPointerDown
              ? event => onDragPointerDown(paneId, canClose, event)
              : undefined
          }
          onPointerMove={canDrag ? onDragPointerMove : undefined}
          onPointerUp={canDrag ? onDragPointerUp : undefined}
          onPointerCancel={canDrag ? onDragPointerCancel : undefined}
        >
          {canDrag ? (
            <span className={styles.paneGrip} aria-hidden='true'>
              ⠿
            </span>
          ) : null}
          <span className={styles.paneDot} aria-hidden='true' />
          <span>
            {title}
            {isZoomed ? ' · zoomed' : ''}
          </span>
        </span>
      </WorkspaceTooltip>
      <Toolbar.Root className={styles.paneToolbar} aria-label={`${title} pane controls`}>
        <Button.Root
          type='button'
          size='xs'
          className={styles.paneAction}
          aria-label={`Split ${title} right`}
          onClick={() => onSplit(paneId, 'right')}
        >
          <Button.Label>◫</Button.Label>
        </Button.Root>
        <Button.Root
          type='button'
          size='xs'
          className={styles.paneAction}
          aria-label={`Split ${title} down`}
          onClick={() => onSplit(paneId, 'down')}
        >
          <Button.Label>⬓</Button.Label>
        </Button.Root>
        <Button.Root
          type='button'
          size='xs'
          className={styles.paneAction}
          aria-label={`Rotate ${title} split`}
          onClick={() => onRotate(paneId)}
        >
          <Button.Label>↻</Button.Label>
        </Button.Root>
        {canClose ? (
          <Button.Root
            type='button'
            size='xs'
            className={styles.paneAction}
            aria-label={`Detach ${title} to new tab`}
            onClick={() => onDetach(paneId)}
          >
            <Button.Label>↗</Button.Label>
          </Button.Root>
        ) : null}
        <Button.Root
          type='button'
          size='xs'
          className={styles.paneAction}
          aria-label={isZoomed ? `Unzoom ${title}` : `Zoom ${title}`}
          onClick={() => onToggleZoom(paneId)}
        >
          <Button.Label>{isZoomed ? '⤡' : '⤢'}</Button.Label>
        </Button.Root>
        {canClose ? (
          <Button.Root
            type='button'
            size='xs'
            className={styles.paneAction}
            aria-label={`Close ${title}`}
            onClick={() => onClose(paneId)}
          >
            <Button.Label>×</Button.Label>
          </Button.Root>
        ) : null}
      </Toolbar.Root>
    </div>
  );
}

interface PaneDragHandlers {
  readonly onDragPointerDown?: (
    paneId: string,
    canDetach: boolean,
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  readonly onDragPointerMove?: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly onDragPointerUp?: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly onDragPointerCancel?: () => void;
}

interface WorkspacePaneFrameProps extends PaneDragHandlers {
  pane: TerminalLeafPane;
  title: string;
  paneKind: 'terminal' | 'primary' | 'tui';
  isActive: boolean;
  isMultiPane: boolean;
  isZoomed: boolean;
  isDragging: boolean;
  paneNav?: PaneNavigationContextValue | null;
  onFocus: (paneId: string) => void;
  onSplit: (paneId: string, direction: SplitCreateDirection) => void;
  onRotate: (paneId: string) => void;
  onDetach: (paneId: string) => void;
  onToggleZoom: (paneId: string) => void;
  onClose: (paneId: string) => void;
  children: ReactNode;
}

function WorkspacePaneFrame({
  pane,
  title,
  paneKind,
  isActive,
  isMultiPane,
  isZoomed,
  isDragging,
  paneNav = null,
  onFocus,
  onSplit,
  onRotate,
  onDetach,
  onToggleZoom,
  onClose,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerUp,
  onDragPointerCancel,
  children,
}: WorkspacePaneFrameProps) {
  const frameContent = (
    <div
      className={styles.pane}
      data-pane-id={pane.id}
      data-pane-tty={title}
      data-pane-kind={paneKind}
      data-tui-depth={pane.tuiStack?.length ?? 0}
      data-active={isActive ? 'true' : 'false'}
      data-multi={isMultiPane ? 'true' : 'false'}
      data-dragging={isDragging ? 'true' : 'false'}
      onPointerDown={() => onFocus(pane.id)}
      onFocus={() => onFocus(pane.id)}
    >
      {isMultiPane ? (
        <PaneChromeBar
          paneId={pane.id}
          title={title}
          isZoomed={isZoomed}
          canClose={!pane.pinned}
          canDrag={!isZoomed}
          onSplit={onSplit}
          onRotate={onRotate}
          onDetach={onDetach}
          onToggleZoom={onToggleZoom}
          onClose={onClose}
          onDragPointerDown={onDragPointerDown}
          onDragPointerMove={onDragPointerMove}
          onDragPointerUp={onDragPointerUp}
          onDragPointerCancel={onDragPointerCancel}
        />
      ) : null}

      {children}
    </div>
  );

  return (
    <PaneActiveContext.Provider value={isActive}>
      {paneNav ? (
        <PaneNavigationContext.Provider value={paneNav}>
          {frameContent}
        </PaneNavigationContext.Provider>
      ) : (
        frameContent
      )}
    </PaneActiveContext.Provider>
  );
}

interface TerminalLeafContentProps {
  pane: TerminalLeafPane;
  terminal: TerminalProfileData;
  terminalForms?: Readonly<Record<string, TerminalFormConfig>>;
  isActive: boolean;
  isMultiPane: boolean;
  canCloseTab: boolean;
  focusToken: number;
  navigate?: (to: string) => void | Promise<void>;
  onFocus: (paneId: string) => void;
  onSplit: (paneId: string, direction: SplitCreateDirection) => void;
  onRotate: (paneId: string) => void;
  onSwap: (paneId: string) => void;
  onDetach: (paneId: string) => void;
  onToggleZoom: (paneId: string) => void;
  onClose: (paneId: string) => void;
  onNewTab: () => void;
  onCloseCurrentTab: () => void;
  onOpenTui: (paneId: string, target?: TerminalNavTarget) => void;
  onNavigateView?: (paneId: string, viewId: string, target: TerminalNavTarget) => void;
}

function TerminalLeafContent({
  pane,
  terminal,
  terminalForms,
  isActive,
  isMultiPane,
  canCloseTab,
  focusToken,
  navigate,
  onFocus,
  onSplit,
  onRotate,
  onSwap,
  onDetach,
  onToggleZoom,
  onClose,
  onNewTab,
  onCloseCurrentTab,
  onOpenTui,
  onNavigateView,
}: TerminalLeafContentProps) {
  const paneTerminalForms = useMemo(() => {
    if (!terminalForms || !onNavigateView) {
      return terminalForms;
    }
    const wrapped: Record<string, TerminalFormConfig> = {};
    for (const [key, config] of Object.entries(terminalForms)) {
      wrapped[key] = {
        ...config,
        openTuiRoute: target => {
          onNavigateView(pane.id, `/${key}`, target ?? 'in-pane');
        },
      };
    }
    return wrapped;
  }, [onNavigateView, pane.id, terminalForms]);

  const commands = useMemo<Readonly<Record<string, ZshCommandHandler>>>(() => {
    const base = buildZshCommandHandlers(terminal.commands, {
      navigate,
      navigateView: onNavigateView
        ? (to, target) => onNavigateView(pane.id, to, target)
        : undefined,
      openTui: target => onOpenTui(pane.id, target),
    });

    return {
      ...base,
      split: () => {
        onSplit(pane.id, 'right');
        return { output: `opened new terminal pane to the right from tty${pane.ttyNumber}` };
      },
      vsplit: () => {
        onSplit(pane.id, 'right');
        return { output: `opened new terminal pane to the right from tty${pane.ttyNumber}` };
      },
      hsplit: () => {
        onSplit(pane.id, 'down');
        return { output: `opened new terminal pane below tty${pane.ttyNumber}` };
      },
      swap: () => {
        if (!isMultiPane) {
          return { output: 'open another split pane first before swapping' };
        }
        onSwap(pane.id);
        return { output: `swapped tty${pane.ttyNumber} with neighbor pane` };
      },
      rotate: () => {
        if (!isMultiPane) {
          return { output: 'open another split pane first before rotating' };
        }
        onRotate(pane.id);
        return { output: `rotated split orientation for tty${pane.ttyNumber}` };
      },
      tab: () => {
        onNewTab();
        return { output: 'opened new terminal tab' };
      },
      newtab: () => {
        onNewTab();
        return { output: 'opened new terminal tab' };
      },
      detach: () => {
        if (!isMultiPane || pane.pinned) {
          return {
            output: `tty${pane.ttyNumber} cannot be detached (split first or unpinned pane required)`,
          };
        }
        onDetach(pane.id);
        return { output: `moved tty${pane.ttyNumber} to a new tab` };
      },
      zoom: () => {
        onToggleZoom(pane.id);
        return { output: isMultiPane ? 'toggled pane zoom' : 'single pane already fills viewport' };
      },
      exit: () => {
        if (isMultiPane && !pane.pinned) {
          onClose(pane.id);
          return { output: `closing tty${pane.ttyNumber} ...` };
        }
        if (!isMultiPane && canCloseTab) {
          onCloseCurrentTab();
          return { output: `closing tab for tty${pane.ttyNumber} ...` };
        }
        return {
          output: `tty${pane.ttyNumber} is the primary session (open another split or tab first)`,
        };
      },
    };
  }, [
    canCloseTab,
    isMultiPane,
    navigate,
    onClose,
    onCloseCurrentTab,
    onDetach,
    onNavigateView,
    onNewTab,
    onOpenTui,
    onRotate,
    onSplit,
    onSwap,
    onToggleZoom,
    pane.id,
    pane.pinned,
    pane.ttyNumber,
    terminal.commands,
  ]);

  const ttyLabel = `tty${pane.ttyNumber}`;
  const inputLabel = isActive ? 'Terminal command input' : `Terminal command input (${ttyLabel})`;

  return (
    <div className={styles.paneBody}>
      <ZshP10kTerminal
        variant='viewport'
        showBanner={false}
        bannerTitle={terminal.bannerTitle}
        bannerMeta={terminal.bannerMeta}
        osLabel={terminal.osLabel}
        directory={terminal.directory}
        vcsBranch={terminal.vcsBranch}
        vcsState={terminal.vcsState}
        contextLabel={terminal.contextLabel}
        commands={commands}
        terminalForms={paneTerminalForms}
        quickCommands={terminal.quickCommands}
        initialEntries={pane.ttyNumber === 1 ? terminal.initialEntries : []}
        placeholder={terminal.placeholder}
        focusOnMount={isActive}
        isActive={isActive}
        focusToken={focusToken}
        inputLabel={inputLabel}
        ariaLabel={`Interactive Terminal ${ttyLabel}`}
        onFocusPane={() => onFocus(pane.id)}
      />
    </div>
  );
}

interface TerminalLeafViewProps extends TerminalLeafContentProps, PaneDragHandlers {
  isZoomed: boolean;
  isDragging: boolean;
  paneNav: PaneNavigationContextValue | null;
  renderPaneView?: (context: TerminalPaneViewContext) => ReactNode;
}

function TerminalLeafView({
  pane,
  terminal,
  terminalForms,
  isActive,
  isMultiPane,
  canCloseTab,
  isZoomed,
  isDragging,
  focusToken,
  navigate,
  paneNav,
  renderPaneView,
  onFocus,
  onSplit,
  onRotate,
  onSwap,
  onDetach,
  onToggleZoom,
  onClose,
  onNewTab,
  onCloseCurrentTab,
  onOpenTui,
  onNavigateView,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerUp,
  onDragPointerCancel,
}: TerminalLeafViewProps) {
  const tuiBodyRef = useRef<HTMLDivElement | null>(null);
  const stack = pane.tuiStack ?? [];
  const activeViewId = getActivePaneViewId(pane);
  const hasTuiView = Boolean(renderPaneView && activeViewId);

  useEffect(() => {
    if (!isActive || !hasTuiView) {
      return;
    }
    const container = tuiBodyRef.current;
    if (container && !container.contains(document.activeElement)) {
      container.focus({ preventScroll: true });
    }
  }, [activeViewId, focusToken, hasTuiView, isActive]);

  const leafContent = (
    <TerminalLeafContent
      pane={pane}
      terminal={terminal}
      terminalForms={terminalForms}
      isActive={isActive && !hasTuiView}
      isMultiPane={isMultiPane}
      canCloseTab={canCloseTab}
      focusToken={focusToken}
      navigate={navigate}
      onFocus={onFocus}
      onSplit={onSplit}
      onRotate={onRotate}
      onSwap={onSwap}
      onDetach={onDetach}
      onToggleZoom={onToggleZoom}
      onClose={onClose}
      onNewTab={onNewTab}
      onCloseCurrentTab={onCloseCurrentTab}
      onOpenTui={onOpenTui}
      onNavigateView={onNavigateView}
    />
  );

  return (
    <WorkspacePaneFrame
      pane={pane}
      title={`tty${pane.ttyNumber}`}
      paneKind={hasTuiView ? 'tui' : 'terminal'}
      isActive={isActive}
      isMultiPane={isMultiPane}
      isZoomed={isZoomed}
      isDragging={isDragging}
      paneNav={paneNav}
      onFocus={onFocus}
      onSplit={onSplit}
      onRotate={onRotate}
      onDetach={onDetach}
      onToggleZoom={onToggleZoom}
      onClose={onClose}
      onDragPointerDown={onDragPointerDown}
      onDragPointerMove={onDragPointerMove}
      onDragPointerUp={onDragPointerUp}
      onDragPointerCancel={onDragPointerCancel}
    >
      {renderPaneView ? (
        <>
          <div
            className={styles.shellLayer}
            data-shell-layer='true'
            hidden={hasTuiView}
            aria-hidden={hasTuiView ? 'true' : undefined}
            inert={hasTuiView}
          >
            {leafContent}
          </div>
          {hasTuiView && activeViewId && paneNav ? (
            <div
              ref={tuiBodyRef}
              tabIndex={-1}
              className={styles.tuiLayer}
              data-tui-view={activeViewId}
              data-tui-depth={stack.length}
            >
              {renderPaneView({
                paneId: pane.id,
                ttyNumber: pane.ttyNumber,
                viewId: activeViewId,
                stack,
                isSinglePane: !isMultiPane,
                isActive,
                isInitialPrimaryDeepLink: false,
                push: paneNav.push,
                pop: paneNav.pop,
                exitTui: paneNav.exitTui,
                openInSplit: paneNav.openInSplit,
                openInTab: paneNav.openInTab,
              })}
            </div>
          ) : null}
        </>
      ) : (
        leafContent
      )}
    </WorkspacePaneFrame>
  );
}

interface TuiLeafViewProps extends PaneDragHandlers {
  pane: TerminalLeafPane;
  isActive: boolean;
  isMultiPane: boolean;
  isZoomed: boolean;
  isDragging: boolean;
  focusToken: number;
  renderTui: (context: TerminalPaneTuiContext) => ReactNode;
  onFocus: (paneId: string) => void;
  onSplit: (paneId: string, direction: SplitCreateDirection) => void;
  onRotate: (paneId: string) => void;
  onDetach: (paneId: string) => void;
  onToggleZoom: (paneId: string) => void;
  onClose: (paneId: string) => void;
  onCloseTui: (paneId: string) => void;
}

function TuiLeafView({
  pane,
  isActive,
  isMultiPane,
  isZoomed,
  isDragging,
  focusToken,
  renderTui,
  onFocus,
  onSplit,
  onRotate,
  onDetach,
  onToggleZoom,
  onClose,
  onCloseTui,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerUp,
  onDragPointerCancel,
}: TuiLeafViewProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Move DOM focus into the TUI split pane when opened or focused via keyboard navigation.
  useEffect(() => {
    if (!isActive) {
      return;
    }
    const container = bodyRef.current;
    if (container && !container.contains(document.activeElement)) {
      container.focus({ preventScroll: true });
    }
  }, [focusToken, isActive]);

  return (
    <WorkspacePaneFrame
      pane={pane}
      title='tui'
      paneKind='tui'
      isActive={isActive}
      isMultiPane={isMultiPane}
      isZoomed={isZoomed}
      isDragging={isDragging}
      onFocus={onFocus}
      onSplit={onSplit}
      onRotate={onRotate}
      onDetach={onDetach}
      onToggleZoom={onToggleZoom}
      onClose={onClose}
      onDragPointerDown={onDragPointerDown}
      onDragPointerMove={onDragPointerMove}
      onDragPointerUp={onDragPointerUp}
      onDragPointerCancel={onDragPointerCancel}
    >
      <div ref={bodyRef} tabIndex={-1} className={styles.tuiPaneBody}>
        {renderTui({
          paneId: pane.id,
          ttyNumber: pane.ttyNumber,
          isSinglePane: !isMultiPane,
          closeTui: () => onCloseTui(pane.id),
        })}
      </div>
    </WorkspacePaneFrame>
  );
}

interface PrimaryPaneViewProps extends PaneDragHandlers {
  pane: TerminalLeafPane;
  primaryPane: TerminalWorkspacePrimaryPane;
  isActive: boolean;
  isMultiPane: boolean;
  canCloseTab: boolean;
  isZoomed: boolean;
  isDragging: boolean;
  focusToken: number;
  paneNav: PaneNavigationContextValue | null;
  renderPaneView?: (context: TerminalPaneViewContext) => ReactNode;
  initialDeepLinkRoute: string | null;
  onFocus: (paneId: string) => void;
  onSplit: (paneId: string, direction: SplitCreateDirection) => void;
  onRotate: (paneId: string) => void;
  onSwap: (paneId: string) => void;
  onDetach: (paneId: string) => void;
  onToggleZoom: (paneId: string) => void;
  onClose: (paneId: string) => void;
  onNewTab: () => void;
  onCloseCurrentTab: () => void;
  onOpenTui: (paneId: string, target?: TerminalNavTarget) => void;
  onNavigateView?: (paneId: string, viewId: string, target: TerminalNavTarget) => void;
}

function PrimaryPaneView({
  pane,
  primaryPane,
  isActive,
  isMultiPane,
  canCloseTab,
  isZoomed,
  isDragging,
  focusToken,
  paneNav,
  renderPaneView,
  initialDeepLinkRoute,
  onFocus,
  onSplit,
  onRotate,
  onSwap,
  onDetach,
  onToggleZoom,
  onClose,
  onNewTab,
  onCloseCurrentTab,
  onOpenTui,
  onNavigateView,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerUp,
  onDragPointerCancel,
}: PrimaryPaneViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const tuiBodyRef = useRef<HTMLDivElement | null>(null);
  const stack = pane.tuiStack ?? [];
  const activeViewId = getActivePaneViewId(pane);
  const hasTuiView = Boolean(renderPaneView && activeViewId);
  const isInitialPrimaryDeepLink = Boolean(
    hasTuiView &&
    !primaryPane.embeddedTerminal &&
    initialDeepLinkRoute &&
    stack.length === 1 &&
    stack[0] === initialDeepLinkRoute,
  );
  const showOverlayTuiLayer = Boolean(hasTuiView && !isInitialPrimaryDeepLink && activeViewId);

  const embeddedContextValue = useMemo<EmbeddedTerminalPaneContextValue>(
    () => ({
      pane,
      isActive: isActive && !hasTuiView,
      isMultiPane,
      canCloseTab,
      focusToken,
      onFocus,
      onSplit,
      onRotate,
      onSwap,
      onDetach,
      onToggleZoom,
      onClose,
      onNewTab,
      onCloseCurrentTab,
      onOpenTui,
      onNavigateView,
    }),
    [
      pane,
      isActive,
      hasTuiView,
      isMultiPane,
      canCloseTab,
      focusToken,
      onFocus,
      onSplit,
      onRotate,
      onSwap,
      onDetach,
      onToggleZoom,
      onClose,
      onNewTab,
      onCloseCurrentTab,
      onOpenTui,
      onNavigateView,
    ],
  );

  // Move DOM focus back into a non-terminal primary pane when switched via workspace keyboard navigation.
  useEffect(() => {
    if (!isActive || focusToken <= 1 || primaryPane.embeddedTerminal || showOverlayTuiLayer) {
      return;
    }
    const container = scrollContainerRef.current;
    if (container && !container.contains(document.activeElement)) {
      container.focus({ preventScroll: true });
    }
  }, [focusToken, isActive, primaryPane.embeddedTerminal, showOverlayTuiLayer]);

  useEffect(() => {
    if (!isActive || !showOverlayTuiLayer) {
      return;
    }
    const container = tuiBodyRef.current;
    if (container && !container.contains(document.activeElement)) {
      container.focus({ preventScroll: true });
    }
  }, [activeViewId, focusToken, isActive, showOverlayTuiLayer]);

  const paneLabel = primaryPane.embeddedTerminal ? `tty${pane.ttyNumber}` : primaryPane.title;
  const baseBodyNode = primaryPane.embeddedTerminal ? (
    <EmbeddedTerminalPaneContext.Provider value={embeddedContextValue}>
      <div className={styles.primaryFlushBody}>{primaryPane.content}</div>
    </EmbeddedTerminalPaneContext.Provider>
  ) : primaryPane.flush ? (
    <div ref={scrollContainerRef} tabIndex={-1} className={styles.primaryFlushBody}>
      {primaryPane.content}
    </div>
  ) : (
    <div ref={scrollContainerRef} tabIndex={-1} className={styles.primaryScrollBody}>
      <div className={styles.primaryInner}>{primaryPane.content}</div>
    </div>
  );

  const bodyNode = renderPaneView ? (
    <>
      <div
        className={styles.shellLayer}
        data-shell-layer='true'
        hidden={showOverlayTuiLayer}
        aria-hidden={showOverlayTuiLayer ? 'true' : undefined}
        inert={showOverlayTuiLayer}
      >
        {baseBodyNode}
      </div>
      {showOverlayTuiLayer && activeViewId && paneNav ? (
        <div
          ref={tuiBodyRef}
          tabIndex={-1}
          className={styles.tuiLayer}
          data-tui-view={activeViewId}
          data-tui-depth={stack.length}
        >
          {renderPaneView({
            paneId: pane.id,
            ttyNumber: pane.ttyNumber,
            viewId: activeViewId,
            stack,
            isSinglePane: !isMultiPane,
            isActive,
            isInitialPrimaryDeepLink: false,
            push: paneNav.push,
            pop: paneNav.pop,
            exitTui: paneNav.exitTui,
            openInSplit: paneNav.openInSplit,
            openInTab: paneNav.openInTab,
          })}
        </div>
      ) : null}
    </>
  ) : (
    baseBodyNode
  );

  return (
    <WorkspacePaneFrame
      pane={pane}
      title={paneLabel}
      paneKind={hasTuiView ? 'tui' : primaryPane.embeddedTerminal ? 'terminal' : 'primary'}
      isActive={isActive}
      isMultiPane={isMultiPane}
      isZoomed={isZoomed}
      isDragging={isDragging}
      paneNav={paneNav}
      onFocus={onFocus}
      onSplit={onSplit}
      onRotate={onRotate}
      onDetach={onDetach}
      onToggleZoom={onToggleZoom}
      onClose={onClose}
      onDragPointerDown={onDragPointerDown}
      onDragPointerMove={onDragPointerMove}
      onDragPointerUp={onDragPointerUp}
      onDragPointerCancel={onDragPointerCancel}
    >
      {bodyNode}
    </WorkspacePaneFrame>
  );
}

interface PaneReadlineScopeProps {
  paneId: string;
  registerHandle: (paneId: string, handle: ZshTerminalHandle) => () => void;
  children: ReactNode;
}

function PaneReadlineScope({ paneId, registerHandle, children }: PaneReadlineScopeProps) {
  const value = useMemo(() => ({ paneId, registerHandle }), [paneId, registerHandle]);
  return (
    <TerminalReadlineRegistryContext.Provider value={value}>
      {children}
    </TerminalReadlineRegistryContext.Provider>
  );
}

function StandaloneTerminalWorkspace({
  terminal,
  terminalForms,
  navigate,
  renderTui,
  renderPaneView,
  initialPrimaryTuiStack,
  onPrimaryPaneReturnToShell,
  dockTuiWindows,
  canHandleInPaneRoute = defaultCanHandleInPaneRoute,
  primaryPane,
  disableMenuShortcut = false,
}: TerminalWorkspaceProps) {
  const isDockedMode = dockTuiWindows ?? Boolean(renderPaneView);
  const initialDeepLinkRoute = initialPrimaryTuiStack?.[0] ?? null;
  const currentEmbeddedTerminal = primaryPane?.embeddedTerminal;

  const [rawState, setRawState] = useState<SyncedTabState>(() => ({
    tabs: createInitialTabbedWorkspaceState({
      pinnedPrimary: Boolean(primaryPane),
      initialPrimaryTuiStack,
    }),
    embeddedTerminal: currentEmbeddedTerminal,
    deepLinkRoute: initialDeepLinkRoute,
  }));
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [dragState, setDragState] = useState<ActiveDragState | null>(null);
  const [resizingSplitId, setResizingSplitId] = useState<string | null>(null);

  const reconciledState = reconcilePrimaryRouteState(
    rawState,
    currentEmbeddedTerminal,
    initialDeepLinkRoute,
  );
  if (reconciledState !== rawState) {
    setRawState(reconciledState);
  }
  const tabState = reconciledState.tabs;

  const setTabState = useCallback(
    (updater: (prev: TerminalTabbedWorkspaceState) => TerminalTabbedWorkspaceState) => {
      setRawState(prev => {
        const base = reconcilePrimaryRouteState(
          prev,
          currentEmbeddedTerminal,
          initialDeepLinkRoute,
        );
        const nextTabs = updater(base.tabs);
        return nextTabs === base.tabs && base === prev ? prev : { ...base, tabs: nextTabs };
      });
    },
    [currentEmbeddedTerminal, initialDeepLinkRoute],
  );

  const paneAreaRef = useRef<HTMLDivElement | null>(null);
  const dragOriginRef = useRef<DragOrigin | null>(null);
  const dividerDragRef = useRef<DividerDragOrigin | null>(null);
  const terminalHandlesRef = useRef<Map<string, ZshTerminalHandle>>(new Map());

  const registerTerminalHandle = useCallback((paneId: string, handle: ZshTerminalHandle) => {
    terminalHandlesRef.current.set(paneId, handle);
    return () => {
      if (terminalHandlesRef.current.get(paneId) === handle) {
        terminalHandlesRef.current.delete(paneId);
      }
    };
  }, []);

  const activeTab = getActiveWorkspaceTab(tabState);
  const activeWorkspace = activeTab.workspace;
  const activeLeaves = listLeafPanes(activeWorkspace.root);
  const isActiveMultiPane = activeLeaves.length > 1;
  const activeLeaf = findLeafPane(activeWorkspace.root, activeWorkspace.activePaneId);
  const activeLeafViewId = activeLeaf ? getActivePaneViewId(activeLeaf) : null;
  const activeHasTuiStack = Boolean(renderPaneView && activeLeafViewId);
  const activeIsPrimaryNonTerminal =
    isPrimaryHostPane(activeTab.pinned, activeLeaf?.pinned) &&
    Boolean(primaryPane) &&
    !primaryPane?.embeddedTerminal;
  const activeIsTuiPane = activeLeaf?.kind === 'tui';
  const activeCanToggleTui = Boolean(renderPaneView || (renderTui && !activeIsPrimaryNonTerminal));
  const activeZoomedPaneId =
    activeWorkspace.zoomedPaneId && findLeafPane(activeWorkspace.root, activeWorkspace.zoomedPaneId)
      ? activeWorkspace.zoomedPaneId
      : null;

  const notifyIfPrimaryReturnedToShell = (
    targetLeafPinned: boolean | undefined,
    nextStackEmpty: boolean,
  ) => {
    if (nextStackEmpty && isPrimaryHostPane(activeTab.pinned, targetLeafPinned)) {
      onPrimaryPaneReturnToShell?.();
    }
  };

  const handlePushPaneView = (paneId: string, viewId: string) => {
    setTabState(prev => updateActiveTabWorkspace(prev, ws => pushPaneView(ws, paneId, viewId)));
  };

  const handlePopPaneView = (paneId: string) => {
    const targetLeaf = findLeafPane(activeWorkspace.root, paneId);
    const currentLen = targetLeaf?.tuiStack?.length ?? 0;
    if (currentLen === 0) {
      return;
    }
    setTabState(prev => updateActiveTabWorkspace(prev, ws => popPaneView(ws, paneId)));
    notifyIfPrimaryReturnedToShell(targetLeaf?.pinned, currentLen === 1);
  };

  const handleExitPaneTui = (paneId: string) => {
    const targetLeaf = findLeafPane(activeWorkspace.root, paneId);
    const currentLen = targetLeaf?.tuiStack?.length ?? 0;
    if (currentLen === 0) {
      return;
    }
    setTabState(prev => updateActiveTabWorkspace(prev, ws => exitPaneTui(ws, paneId)));
    notifyIfPrimaryReturnedToShell(targetLeaf?.pinned, true);
  };

  const handleOpenViewInSplit = (paneId: string, viewId: string) => {
    setTabState(prev =>
      updateActiveTabWorkspace(prev, ws => openViewInSplit(ws, paneId, viewId, 'right')),
    );
  };

  const handleOpenViewInTab = (viewId: string) => {
    setRenamingTabId(null);
    setTabState(prev => openViewInTab(prev, viewId));
  };

  const handleNavigateView = (paneId: string, viewId: string, target: TerminalNavTarget) => {
    if (!canHandleInPaneRoute(viewId)) {
      if (navigate) {
        void navigate(viewId);
      }
      return;
    }
    if (target === 'tab') {
      handleOpenViewInTab(viewId);
      return;
    }
    if (target === 'split') {
      handleOpenViewInSplit(paneId, viewId);
      return;
    }
    handlePushPaneView(paneId, viewId);
  };

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (renamingTabId !== null) {
        return;
      }

      const isVisibleTerminalPane =
        !activeHasTuiStack && !activeIsTuiPane && !hasOpenOverlayOrPopup(event.target);

      // Intercept physical Alt+N before macOS dead-key tilde composition starts when a terminal is active.
      if (isVisibleTerminalPane && isAltNReadlineChord(event)) {
        const activeHandle = terminalHandlesRef.current.get(activeWorkspace.activePaneId);
        if (
          activeHandle &&
          (!isEditableTarget(event.target) || activeHandle.containsTarget(event.target))
        ) {
          event.preventDefault();
          event.stopPropagation();
          activeHandle.executeReadlineAction('history-next');
          return;
        }
      }

      if (event.isComposing) {
        return;
      }

      if (event.key === 'Escape' && dividerDragRef.current !== null) {
        event.preventDefault();
        const origin = dividerDragRef.current;
        dividerDragRef.current = null;
        setResizingSplitId(null);
        setTabState(prev =>
          updateActiveTabWorkspace(prev, ws =>
            setSplitRatio(ws, origin.splitId, origin.initialRatio),
          ),
        );
        return;
      }

      if (event.key === 'Escape' && dragState !== null) {
        event.preventDefault();
        dragOriginRef.current = null;
        setDragState(null);
        return;
      }

      if (
        activeHasTuiStack &&
        activeLeaf &&
        !isEditableTarget(event.target) &&
        !hasOpenOverlayOrPopup(event.target)
      ) {
        const isEscape = event.key === 'Escape' && !event.defaultPrevented;
        const isAltLeft =
          event.altKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          event.key === 'ArrowLeft';
        if (isEscape || isAltLeft) {
          event.preventDefault();
          const currentLen = activeLeaf.tuiStack?.length ?? 0;
          setTabState(prev => updateActiveTabWorkspace(prev, ws => popPaneView(ws, activeLeaf.id)));
          if (currentLen === 1 && isPrimaryHostPane(activeTab.pinned, activeLeaf.pinned)) {
            onPrimaryPaneReturnToShell?.();
          }
          return;
        }
        if (
          event.key.toLowerCase() === 'q' &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          !event.defaultPrevented
        ) {
          event.preventDefault();
          setTabState(prev => updateActiveTabWorkspace(prev, ws => exitPaneTui(ws, activeLeaf.id)));
          if (isPrimaryHostPane(activeTab.pinned, activeLeaf.pinned)) {
            onPrimaryPaneReturnToShell?.();
          }
          return;
        }
      }

      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        activeIsTuiPane &&
        !hasOpenOverlayOrPopup(event.target)
      ) {
        event.preventDefault();
        setTabState(prev => closeActivePaneOrTab(prev));
        return;
      }

      const action = matchWorkspaceShortcut(event);
      if (!action) {
        if (isVisibleTerminalPane) {
          const readlineAction = matchTerminalReadlineShortcut(event);
          if (readlineAction) {
            const activeHandle = terminalHandlesRef.current.get(activeWorkspace.activePaneId);
            if (
              activeHandle &&
              (!isEditableTarget(event.target) || activeHandle.containsTarget(event.target))
            ) {
              event.preventDefault();
              event.stopPropagation();
              activeHandle.executeReadlineAction(readlineAction);
            }
          }
        }
        return;
      }

      if (action.type === 'rename-tab') {
        const activeHandle = terminalHandlesRef.current.get(activeWorkspace.activePaneId);
        if (
          hasOpenOverlayOrPopup(event.target) ||
          (isEditableTarget(event.target) && !activeHandle?.containsTarget(event.target))
        ) {
          return;
        }
      }

      event.preventDefault();
      event.stopPropagation();

      if (event.repeat && action.type !== 'resize') {
        return;
      }

      if (action.type === 'toggle-tui' && !activeCanToggleTui) {
        return;
      }
      if (action.type === 'open-menu' && (disableMenuShortcut || (!renderPaneView && !navigate))) {
        return;
      }
      if (
        (action.type === 'resize' ||
          action.type === 'move-split' ||
          action.type === 'rotate-split') &&
        !isActiveMultiPane
      ) {
        return;
      }
      if (action.type === 'detach-pane' && (!isActiveMultiPane || activeLeaf?.pinned)) {
        return;
      }
      if (
        (action.type === 'focus-tab-relative' || action.type === 'focus-tab-index') &&
        tabState.tabs.length <= 1
      ) {
        return;
      }

      switch (action.type) {
        case 'split':
          setTabState(prev =>
            updateActiveTabWorkspace(prev, ws => splitActivePane(ws, action.direction)),
          );
          return;
        case 'focus-relative':
          setTabState(prev =>
            updateActiveTabWorkspace(prev, ws => focusRelativePane(ws, action.delta)),
          );
          return;
        case 'focus-direction':
          setTabState(prev =>
            updateActiveTabWorkspace(prev, ws => focusDirectionalPane(ws, action.direction)),
          );
          return;
        case 'resize':
          setTabState(prev =>
            updateActiveTabWorkspace(prev, ws => resizeActiveSplit(ws, action.direction)),
          );
          return;
        case 'move-split':
          setTabState(prev =>
            updateActiveTabWorkspace(prev, ws => moveActiveSplit(ws, action.direction)),
          );
          return;
        case 'rotate-split':
          setTabState(prev => updateActiveTabWorkspace(prev, ws => rotateActiveSplit(ws)));
          return;
        case 'toggle-zoom':
          setTabState(prev => updateActiveTabWorkspace(prev, ws => toggleZoomActivePane(ws)));
          return;
        case 'equalize':
          setTabState(prev => updateActiveTabWorkspace(prev, ws => equalizeAllSplits(ws)));
          return;
        case 'close-pane':
          setTabState(prev => closeActivePaneOrTab(prev));
          return;
        case 'new-tab':
          setTabState(prev => addWorkspaceTab(prev));
          return;
        case 'rename-tab': {
          const currentTitle = resolveTabDisplayTitle(activeTab, primaryPane);
          setRenamingTabId(activeTab.id);
          setRenameDraft(currentTitle);
          return;
        }
        case 'focus-tab-relative':
          setTabState(prev => selectRelativeWorkspaceTab(prev, action.delta));
          return;
        case 'focus-tab-index':
          setTabState(prev => selectWorkspaceTabByIndex(prev, action.index));
          return;
        case 'detach-pane':
          setTabState(prev =>
            detachPaneToNewTab(prev, getActiveWorkspaceTab(prev).workspace.activePaneId),
          );
          return;
        case 'toggle-tui':
          if (renderPaneView && activeLeaf) {
            if (activeLeafViewId === 'tui') {
              const currentLen = activeLeaf.tuiStack?.length ?? 0;
              setTabState(prev =>
                updateActiveTabWorkspace(prev, ws => popPaneView(ws, activeLeaf.id)),
              );
              if (currentLen === 1 && isPrimaryHostPane(activeTab.pinned, activeLeaf.pinned)) {
                onPrimaryPaneReturnToShell?.();
              }
            } else {
              setTabState(prev =>
                updateActiveTabWorkspace(prev, ws => pushPaneView(ws, activeLeaf.id, 'tui')),
              );
            }
            return;
          }
          setTabState(prev => {
            const currentTab = getActiveWorkspaceTab(prev);
            const currentActive = findLeafPane(
              currentTab.workspace.root,
              currentTab.workspace.activePaneId,
            );
            if (currentActive?.kind === 'tui') {
              return closeActivePaneOrTab(prev);
            }
            return updateActiveTabWorkspace(prev, ws =>
              toggleTuiPane(ws, ws.activePaneId, 'right'),
            );
          });
          return;
        case 'open-menu':
          if (renderPaneView && activeLeaf) {
            setTabState(prev =>
              updateActiveTabWorkspace(prev, ws => pushPaneView(ws, activeLeaf.id, '/menu')),
            );
            return;
          }
          if (navigate) {
            void navigate('/menu');
          }
          return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
    };
  }, [
    activeCanToggleTui,
    activeHasTuiStack,
    activeIsTuiPane,
    activeLeaf,
    activeLeafViewId,
    activeTab,
    activeWorkspace.activePaneId,
    disableMenuShortcut,
    dragState,
    initialDeepLinkRoute,
    isActiveMultiPane,
    navigate,
    onPrimaryPaneReturnToShell,
    primaryPane,
    renderPaneView,
    renamingTabId,
    setTabState,
    tabState.tabs.length,
  ]);

  const handleFocusPane = (paneId: string) => {
    if (activeWorkspace.activePaneId === paneId) {
      return;
    }
    setTabState(prev => updateActiveTabWorkspace(prev, ws => focusPaneById(ws, paneId, false)));
  };

  const handleSplitPane = (paneId: string, direction: SplitCreateDirection) => {
    setTabState(prev =>
      updateActiveTabWorkspace(prev, ws =>
        splitActivePane(focusPaneById(ws, paneId, false), direction),
      ),
    );
  };

  const handleRotatePane = (paneId: string) => {
    setTabState(prev =>
      updateActiveTabWorkspace(prev, ws => rotateActiveSplit(focusPaneById(ws, paneId, false))),
    );
  };

  const handleSwapPane = (paneId: string) => {
    setTabState(prev =>
      updateActiveTabWorkspace(prev, ws =>
        swapActivePaneWithNeighbor(focusPaneById(ws, paneId, false)),
      ),
    );
  };

  const handleDetachPane = (paneId: string) => {
    setTabState(prev => detachPaneToNewTab(prev, paneId));
  };

  const handleToggleZoom = (paneId: string) => {
    setTabState(prev =>
      updateActiveTabWorkspace(prev, ws => toggleZoomActivePane(focusPaneById(ws, paneId, false))),
    );
  };

  const handleClosePane = (paneId: string) => {
    setTabState(prev => updateActiveTabWorkspace(prev, ws => closePaneById(ws, paneId)));
  };

  const handleOpenTui = (paneId: string, target?: TerminalNavTarget) => {
    if (renderPaneView) {
      handleNavigateView(paneId, 'tui', target ?? 'in-pane');
      return;
    }
    if (!renderTui) {
      return;
    }
    setTabState(prev => updateActiveTabWorkspace(prev, ws => openTuiPane(ws, paneId, 'right')));
  };

  const handleCloseTuiPane = (paneId: string) => {
    setTabState(prev => {
      const currentTab = getActiveWorkspaceTab(prev);
      const leaves = listLeafPanes(currentTab.workspace.root);
      if (leaves.length > 1) {
        return updateActiveTabWorkspace(prev, ws => closePaneById(ws, paneId));
      }
      if (leaves[0]?.id === paneId) {
        return closeWorkspaceTab(prev, currentTab.id);
      }
      return prev;
    });
  };

  const handleAddTab = () => {
    setRenamingTabId(null);
    setTabState(prev => addWorkspaceTab(prev));
  };

  const handleSelectTab = (tabId: string) => {
    setRenamingTabId(null);
    setTabState(prev => selectWorkspaceTab(prev, tabId));
  };

  const handleCloseTab = (tabId: string) => {
    if (renamingTabId === tabId) {
      setRenamingTabId(null);
    }
    setTabState(prev => closeWorkspaceTab(prev, tabId));
  };

  const handleCloseCurrentTab = () => {
    setTabState(prev => closeWorkspaceTab(prev, prev.activeTabId));
  };

  const handleStartRename = (tabId: string, currentTitle: string) => {
    setRenamingTabId(tabId);
    setRenameDraft(currentTitle);
  };

  const handleCommitRename = () => {
    if (renamingTabId !== null) {
      const targetTabId = renamingTabId;
      const nextTitle = renameDraft;
      setRenamingTabId(null);
      setTabState(prev => renameWorkspaceTab(prev, targetTabId, nextTitle));
    }
  };

  const handleCancelRename = () => {
    setRenamingTabId(null);
  };

  const handleDragPointerDown = (
    paneId: string,
    allowDetachTab: boolean,
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (event.button !== 0 || !isActiveMultiPane || activeZoomedPaneId) {
      return;
    }
    dragOriginRef.current = {
      paneId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      allowDetachTab,
      activated: false,
      lastTarget: null,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleDragPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const origin = dragOriginRef.current;
    if (!origin || origin.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - origin.startX;
    const dy = event.clientY - origin.startY;
    if (!origin.activated && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
      return;
    }
    origin.activated = true;
    const rect = paneAreaRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const target = computePaneDropTarget(
      activeWorkspace.root,
      origin.paneId,
      { x: event.clientX, y: event.clientY },
      rect,
      { allowDetachTab: origin.allowDetachTab },
    );
    origin.lastTarget = target;
    setDragState({ sourcePaneId: origin.paneId, target });
  };

  const clearDrag = () => {
    dragOriginRef.current = null;
    setDragState(null);
  };

  const handleDragPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const origin = dragOriginRef.current;
    if (!origin || origin.pointerId !== event.pointerId) {
      return;
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const target = origin.lastTarget;
    clearDrag();

    if (!target) {
      return;
    }
    if (target.zone === 'detach-tab') {
      setTabState(prev => detachPaneToNewTab(prev, origin.paneId));
    } else {
      setTabState(prev =>
        updateActiveTabWorkspace(prev, ws =>
          dockPane(ws, origin.paneId, target.targetId, target.zone),
        ),
      );
    }
  };

  const handleDividerPointerDown = (
    divider: SplitDividerRect,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (event.button !== 0 || activeZoomedPaneId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dividerDragRef.current = {
      splitId: divider.id,
      direction: divider.direction,
      pointerId: event.pointerId,
      containerStart: divider.containerStart,
      containerSpan: divider.containerSpan,
      initialRatio: divider.ratio,
    };
    setResizingSplitId(divider.id);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleDividerPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const origin = dividerDragRef.current;
    if (!origin || origin.pointerId !== event.pointerId) {
      return;
    }
    const rect = paneAreaRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0 || origin.containerSpan <= 0) {
      return;
    }
    const normPos =
      origin.direction === 'vertical'
        ? (event.clientX - rect.left) / rect.width
        : (event.clientY - rect.top) / rect.height;
    const nextRatio = (normPos - origin.containerStart) / origin.containerSpan;
    setTabState(prev =>
      updateActiveTabWorkspace(prev, ws => setSplitRatio(ws, origin.splitId, nextRatio)),
    );
  };

  const clearDividerDrag = (event?: ReactPointerEvent<HTMLButtonElement>) => {
    const origin = dividerDragRef.current;
    if (event && origin && origin.pointerId !== event.pointerId) {
      return;
    }
    if (event && origin) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    dividerDragRef.current = null;
    setResizingSplitId(null);
  };

  const handleDividerDoubleClick = (splitId: string) => {
    setTabState(prev => updateActiveTabWorkspace(prev, ws => setSplitRatio(ws, splitId, 0.5)));
  };

  const handleDividerKeyDown = (
    divider: SplitDividerRect,
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    const isVertical = divider.direction === 'vertical';
    if ((isVertical && event.key === 'ArrowLeft') || (!isVertical && event.key === 'ArrowUp')) {
      event.preventDefault();
      setTabState(prev =>
        updateActiveTabWorkspace(prev, ws =>
          setSplitRatio(ws, divider.id, divider.ratio - DIVIDER_KEY_STEP),
        ),
      );
      return;
    }
    if ((isVertical && event.key === 'ArrowRight') || (!isVertical && event.key === 'ArrowDown')) {
      event.preventDefault();
      setTabState(prev =>
        updateActiveTabWorkspace(prev, ws =>
          setSplitRatio(ws, divider.id, divider.ratio + DIVIDER_KEY_STEP),
        ),
      );
      return;
    }
    if (event.key === 'Home' || event.key === 'Enter' || event.key === '0') {
      event.preventDefault();
      setTabState(prev => updateActiveTabWorkspace(prev, ws => setSplitRatio(ws, divider.id, 0.5)));
    }
  };

  const dropTarget = dragState?.target ?? null;

  return (
    <div
      className={styles.workspace}
      data-pane-count={activeLeaves.length}
      data-tab-count={tabState.tabs.length}
      data-active-tab={activeTab.id}
      data-zoomed={activeZoomedPaneId ? 'true' : 'false'}
    >
      <TabStrip
        tabs={tabState.tabs}
        activeTabId={tabState.activeTabId}
        primaryPane={primaryPane}
        renamingTabId={renamingTabId}
        renameDraft={renameDraft}
        isDetachPreview={dropTarget?.zone === 'detach-tab'}
        onSelectTab={handleSelectTab}
        onAddTab={handleAddTab}
        onCloseTab={handleCloseTab}
        onStartRename={handleStartRename}
        onChangeRenameDraft={setRenameDraft}
        onCommitRename={handleCommitRename}
        onCancelRename={handleCancelRename}
      />

      <div ref={paneAreaRef} className={styles.paneArea} data-pane-area='true'>
        {tabState.tabs.map(tab => {
          const isCurrentTab = tab.id === activeTab.id;
          const ws = tab.workspace;
          const leaves = listLeafPanes(ws.root);
          const isMultiPane = leaves.length > 1;
          const canCloseThisTab = tabState.tabs.length > 1;
          const zoomedPaneId =
            ws.zoomedPaneId && findLeafPane(ws.root, ws.zoomedPaneId) ? ws.zoomedPaneId : null;
          const rectsById = new Map<
            string,
            { x: number; y: number; width: number; height: number }
          >();
          for (const rect of computeLeafRects(ws.root)) {
            rectsById.set(rect.id, rect);
          }
          const dividers = zoomedPaneId ? [] : computeSplitDividers(ws.root);

          return (
            <div
              key={tab.id}
              className={styles.tabPanel}
              role='tabpanel'
              data-tab-panel={tab.id}
              data-tab-active={isCurrentTab ? 'true' : 'false'}
            >
              {leaves.map(pane => {
                const isZoomed = pane.id === zoomedPaneId;
                const isHidden = Boolean(zoomedPaneId) && !isZoomed;
                const isPaneActive = isCurrentTab && pane.id === ws.activePaneId;
                const isDraggingPane = isCurrentTab && dragState?.sourcePaneId === pane.id;
                const rect = isZoomed
                  ? { x: 0, y: 0, width: 1, height: 1 }
                  : (rectsById.get(pane.id) ?? { x: 0, y: 0, width: 1, height: 1 });
                const paneStack = pane.tuiStack ?? [];
                const paneNav: PaneNavigationContextValue | null = isDockedMode
                  ? {
                      paneId: pane.id,
                      ttyNumber: pane.ttyNumber,
                      isActive: isPaneActive,
                      isSinglePane: !isMultiPane,
                      docked: true,
                      stack: paneStack,
                      canGoBack: paneStack.length > 0,
                      push: viewId => handleNavigateView(pane.id, viewId, 'in-pane'),
                      pop: () => handlePopPaneView(pane.id),
                      exitTui: () => handleExitPaneTui(pane.id),
                      openInSplit: viewId => handleNavigateView(pane.id, viewId, 'split'),
                      openInTab: viewId => handleNavigateView(pane.id, viewId, 'tab'),
                    }
                  : null;

                return (
                  <div
                    key={pane.id}
                    className={styles.paneSlot}
                    data-hidden={isHidden ? 'true' : 'false'}
                    style={
                      {
                        '--sf-pane-x': rect.x,
                        '--sf-pane-y': rect.y,
                        '--sf-pane-w': rect.width,
                        '--sf-pane-h': rect.height,
                      } as CSSProperties
                    }
                  >
                    <PaneReadlineScope paneId={pane.id} registerHandle={registerTerminalHandle}>
                      {primaryPane && isPrimaryHostPane(tab.pinned, pane.pinned) ? (
                        <PrimaryPaneView
                          pane={pane}
                          primaryPane={primaryPane}
                          isActive={isPaneActive}
                          isMultiPane={isMultiPane}
                          canCloseTab={canCloseThisTab}
                          isZoomed={isZoomed}
                          isDragging={isDraggingPane}
                          focusToken={ws.focusToken}
                          paneNav={paneNav}
                          renderPaneView={renderPaneView}
                          initialDeepLinkRoute={initialDeepLinkRoute}
                          onFocus={handleFocusPane}
                          onSplit={handleSplitPane}
                          onRotate={handleRotatePane}
                          onSwap={handleSwapPane}
                          onDetach={handleDetachPane}
                          onToggleZoom={handleToggleZoom}
                          onClose={handleClosePane}
                          onNewTab={handleAddTab}
                          onCloseCurrentTab={handleCloseCurrentTab}
                          onOpenTui={handleOpenTui}
                          onNavigateView={renderPaneView ? handleNavigateView : undefined}
                          onDragPointerDown={handleDragPointerDown}
                          onDragPointerMove={handleDragPointerMove}
                          onDragPointerUp={handleDragPointerUp}
                          onDragPointerCancel={clearDrag}
                        />
                      ) : pane.kind === 'tui' && renderTui ? (
                        <TuiLeafView
                          pane={pane}
                          isActive={isPaneActive}
                          isMultiPane={isMultiPane}
                          isZoomed={isZoomed}
                          isDragging={isDraggingPane}
                          focusToken={ws.focusToken}
                          renderTui={renderTui}
                          onFocus={handleFocusPane}
                          onSplit={handleSplitPane}
                          onRotate={handleRotatePane}
                          onDetach={handleDetachPane}
                          onToggleZoom={handleToggleZoom}
                          onClose={handleClosePane}
                          onCloseTui={handleCloseTuiPane}
                          onDragPointerDown={handleDragPointerDown}
                          onDragPointerMove={handleDragPointerMove}
                          onDragPointerUp={handleDragPointerUp}
                          onDragPointerCancel={clearDrag}
                        />
                      ) : (
                        <TerminalLeafView
                          pane={pane}
                          terminal={terminal}
                          terminalForms={terminalForms}
                          isActive={isPaneActive}
                          isMultiPane={isMultiPane}
                          canCloseTab={canCloseThisTab}
                          isZoomed={isZoomed}
                          isDragging={isDraggingPane}
                          focusToken={ws.focusToken}
                          navigate={navigate}
                          paneNav={paneNav}
                          renderPaneView={renderPaneView}
                          onFocus={handleFocusPane}
                          onSplit={handleSplitPane}
                          onRotate={handleRotatePane}
                          onSwap={handleSwapPane}
                          onDetach={handleDetachPane}
                          onToggleZoom={handleToggleZoom}
                          onClose={handleClosePane}
                          onNewTab={handleAddTab}
                          onCloseCurrentTab={handleCloseCurrentTab}
                          onOpenTui={handleOpenTui}
                          onNavigateView={renderPaneView ? handleNavigateView : undefined}
                          onDragPointerDown={handleDragPointerDown}
                          onDragPointerMove={handleDragPointerMove}
                          onDragPointerUp={handleDragPointerUp}
                          onDragPointerCancel={clearDrag}
                        />
                      )}
                    </PaneReadlineScope>
                  </div>
                );
              })}

              {dividers.map(divider => {
                const isResizing = isCurrentTab && resizingSplitId === divider.id;
                const percent = Math.round(divider.ratio * 100);
                return (
                  <WorkspaceTooltip
                    key={divider.id}
                    label='Drag to resize split · double-click to equalize'
                  >
                    <button
                      type='button'
                      aria-label={
                        divider.direction === 'vertical'
                          ? `Resize vertical split (${percent}%)`
                          : `Resize horizontal split (${percent}%)`
                      }
                      className={styles.splitDivider}
                      data-split-divider={divider.id}
                      data-direction={divider.direction}
                      data-resizing={isResizing ? 'true' : 'false'}
                      style={
                        {
                          '--sf-pane-x': divider.x,
                          '--sf-pane-y': divider.y,
                          '--sf-pane-w': divider.direction === 'horizontal' ? divider.length : 1,
                          '--sf-pane-h': divider.direction === 'vertical' ? divider.length : 1,
                        } as CSSProperties
                      }
                      onPointerDown={event => handleDividerPointerDown(divider, event)}
                      onPointerMove={handleDividerPointerMove}
                      onPointerUp={event => clearDividerDrag(event)}
                      onPointerCancel={() => clearDividerDrag()}
                      onDoubleClick={() => handleDividerDoubleClick(divider.id)}
                      onKeyDown={event => handleDividerKeyDown(divider, event)}
                    />
                  </WorkspaceTooltip>
                );
              })}
            </div>
          );
        })}

        {dropTarget ? (
          <div className={styles.dropOverlay} data-drop-overlay='true'>
            <div
              className={styles.dropPreview}
              data-drop-zone={dropTarget.zone}
              style={
                {
                  '--sf-pane-x': dropTarget.previewRect.x,
                  '--sf-pane-y': dropTarget.previewRect.y,
                  '--sf-pane-w': dropTarget.previewRect.width,
                  '--sf-pane-h': dropTarget.previewRect.height,
                } as CSSProperties
              }
            >
              <span className={styles.dropLabel}>{dropTarget.label}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function TerminalWorkspace(props: TerminalWorkspaceProps) {
  const embeddedCtx = useContext(EmbeddedTerminalPaneContext);

  if (embeddedCtx && !props.primaryPane) {
    return (
      <TerminalLeafContent
        pane={embeddedCtx.pane}
        terminal={props.terminal}
        terminalForms={props.terminalForms}
        isActive={embeddedCtx.isActive}
        isMultiPane={embeddedCtx.isMultiPane}
        canCloseTab={embeddedCtx.canCloseTab}
        focusToken={embeddedCtx.focusToken}
        navigate={props.navigate}
        onFocus={embeddedCtx.onFocus}
        onSplit={embeddedCtx.onSplit}
        onRotate={embeddedCtx.onRotate}
        onSwap={embeddedCtx.onSwap}
        onDetach={embeddedCtx.onDetach}
        onToggleZoom={embeddedCtx.onToggleZoom}
        onClose={embeddedCtx.onClose}
        onNewTab={embeddedCtx.onNewTab}
        onCloseCurrentTab={embeddedCtx.onCloseCurrentTab}
        onOpenTui={embeddedCtx.onOpenTui}
        onNavigateView={embeddedCtx.onNavigateView}
      />
    );
  }

  return <StandaloneTerminalWorkspace {...props} />;
}
