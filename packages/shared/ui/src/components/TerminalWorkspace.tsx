import type { TerminalProfileData } from '@aklapper/core';
import {
  createContext,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Button, Toolbar } from '../elements/base';
import { buildZshCommandHandlers } from './buildZshCommands';
import { type TerminalFormConfig } from './terminalFormSession';
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
  matchGhosttyShortcut,
  moveActiveSplit,
  type PaneDropTarget,
  renameWorkspaceTab,
  resizeActiveSplit,
  rotateActiveSplit,
  selectRelativeWorkspaceTab,
  selectWorkspaceTab,
  selectWorkspaceTabByIndex,
  setPaneTuiOpen,
  setSplitRatio,
  splitActivePane,
  type SplitCreateDirection,
  type SplitDirection,
  type SplitDividerRect,
  type TerminalLeafPane,
  type TerminalTabbedWorkspaceState,
  type TerminalWorkspaceTab,
  toggleZoomActivePane,
  updateActiveTabWorkspace,
} from './terminalPaneTree';
import { ZshP10kTerminal, type ZshCommandHandler } from './ZshP10kTerminal';

import styles from './TerminalWorkspace.module.css';

export interface TerminalPaneTuiContext {
  readonly paneId: string;
  readonly ttyNumber: number;
  readonly isSinglePane: boolean;
  readonly closeTui: () => void;
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
  readonly onSetTuiOpen: (paneId: string, open: boolean) => void;
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

const PaneActiveContext = createContext<boolean>(true);
const EmbeddedTerminalPaneContext = createContext<EmbeddedTerminalPaneContextValue | null>(null);

export function useIsPaneActive(): boolean {
  return useContext(PaneActiveContext);
}

const SPLIT_HELP_APPENDIX = [
  '',
  'Split panes & tabs (Ghostty / ghostty-union keybindings & commands):',
  '  Ctrl+Shift+} / Ctrl+Shift+O / Cmd+D (or "split" / "vsplit") — split terminal right',
  '  Ctrl+Shift+{ / Ctrl+Shift+E / Cmd+Shift+D (or "hsplit")     — split terminal down',
  '  Ctrl+Alt+Arrows / Cmd+Alt+Arrows (or Cmd+] / Cmd+[)         — focus neighbor pane',
  '  Alt+Shift+Arrows / drag pane divider (double-click=50/50)   — resize active split',
  '  Ctrl+Alt+Shift+Arrows (or "swap" / drag pane titlebar)      — swap or dock split pane',
  '  Ctrl+Shift+R / Ctrl+Alt+Shift+R (or "rotate")               — rotate split orientation',
  '  Ctrl+Shift+Enter / Cmd+Shift+Enter (or "zoom")              — toggle active pane zoom',
  '  Ctrl+Alt+Shift+E / Ctrl+Shift+= / Cmd+Shift+=               — equalize split sizes',
  '  Ctrl+Shift+T / Alt+Shift+T (or "tab")                       — open a new tab',
  '  Ctrl+Alt+Shift+T (or "detach" / drag pane to tab strip)     — move split to new tab',
  '  Ctrl+Shift+A / Alt+Shift+A (or double-click tab)            — rename active tab',
  '  Ctrl+Tab / Alt+] / Alt+[ / Alt+1..9                         — switch tabs',
  '  Ctrl+Shift+W / Cmd+Shift+W / Alt+Shift+W (or "exit")        — close active pane or tab',
].join('\n');

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
  if (primaryPane && tab.id === 'tab-1' && !primaryPane.embeddedTerminal) {
    return primaryPane.title;
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
          const canClose = tabs.length > 1 && !tab.pinned;
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
                <button
                  type='button'
                  role='tab'
                  aria-selected={isActive}
                  className={styles.tabLabelButton}
                  title='Click to switch · double-click to rename'
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

      <Button.Root
        type='button'
        size='xs'
        className={styles.newTabBtn}
        aria-label='New terminal tab'
        title='New Tab (Ctrl+Shift+T / Alt+Shift+T)'
        onClick={onAddTab}
      >
        <Button.Label>+</Button.Label>
      </Button.Root>
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
      <span
        className={styles.paneTitle}
        data-draggable={canDrag ? 'true' : 'false'}
        data-pane-drag-handle={paneId}
        title={canDrag ? 'Drag to swap, dock, or drop onto tab strip to detach' : undefined}
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

interface TerminalLeafContentProps {
  pane: TerminalLeafPane;
  terminal: TerminalProfileData;
  terminalForms?: Readonly<Record<string, TerminalFormConfig>>;
  isActive: boolean;
  isMultiPane: boolean;
  canCloseTab: boolean;
  focusToken: number;
  navigate?: (to: string) => void | Promise<void>;
  renderTui?: (context: TerminalPaneTuiContext) => ReactNode;
  onFocus: (paneId: string) => void;
  onSplit: (paneId: string, direction: SplitCreateDirection) => void;
  onRotate: (paneId: string) => void;
  onSwap: (paneId: string) => void;
  onDetach: (paneId: string) => void;
  onToggleZoom: (paneId: string) => void;
  onClose: (paneId: string) => void;
  onNewTab: () => void;
  onCloseCurrentTab: () => void;
  onSetTuiOpen: (paneId: string, open: boolean) => void;
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
  renderTui,
  onFocus,
  onSplit,
  onRotate,
  onSwap,
  onDetach,
  onToggleZoom,
  onClose,
  onNewTab,
  onCloseCurrentTab,
  onSetTuiOpen,
}: TerminalLeafContentProps) {
  const commands = useMemo<Readonly<Record<string, ZshCommandHandler>>>(() => {
    const base = buildZshCommandHandlers(terminal.commands, {
      navigate,
      openTui: () => onSetTuiOpen(pane.id, true),
    });
    const baseHelp = base['help'];

    return {
      ...base,
      help: (args, raw) => {
        const res = baseHelp ? baseHelp(args, raw) : { output: '' };
        return {
          ...res,
          output: res.output ? `${res.output}\n${SPLIT_HELP_APPENDIX}` : SPLIT_HELP_APPENDIX.trim(),
        };
      },
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
        if (pane.tuiOpen) {
          onSetTuiOpen(pane.id, false);
          return { output: `closed TUI in tty${pane.ttyNumber}` };
        }
        if (isMultiPane && !pane.pinned) {
          onClose(pane.id);
          return { output: `closing tty${pane.ttyNumber} ...` };
        }
        if (!isMultiPane && canCloseTab && !pane.pinned) {
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
    onNewTab,
    onRotate,
    onSetTuiOpen,
    onSplit,
    onSwap,
    onToggleZoom,
    pane.id,
    pane.pinned,
    pane.ttyNumber,
    pane.tuiOpen,
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
        terminalForms={terminalForms}
        quickCommands={terminal.quickCommands}
        initialEntries={pane.ttyNumber === 1 ? terminal.initialEntries : []}
        placeholder={terminal.placeholder}
        focusOnMount={isActive}
        isActive={isActive}
        focusToken={focusToken}
        inputLabel={inputLabel}
        ariaLabel={`Interactive Terminal ${ttyLabel}`}
        onFocusPane={() => onFocus(pane.id)}
        onEscape={() => onSetTuiOpen(pane.id, false)}
      />

      {pane.tuiOpen && renderTui ? (
        <div className={styles.tuiOverlay}>
          {renderTui({
            paneId: pane.id,
            ttyNumber: pane.ttyNumber,
            isSinglePane: !isMultiPane,
            closeTui: () => onSetTuiOpen(pane.id, false),
          })}
        </div>
      ) : null}
    </div>
  );
}

interface TerminalLeafViewProps extends TerminalLeafContentProps {
  isZoomed: boolean;
  isDragging: boolean;
  onDragPointerDown?: (
    paneId: string,
    canDetach: boolean,
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  onDragPointerMove?: (event: ReactPointerEvent<HTMLElement>) => void;
  onDragPointerUp?: (event: ReactPointerEvent<HTMLElement>) => void;
  onDragPointerCancel?: () => void;
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
  renderTui,
  onFocus,
  onSplit,
  onRotate,
  onSwap,
  onDetach,
  onToggleZoom,
  onClose,
  onNewTab,
  onCloseCurrentTab,
  onSetTuiOpen,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerUp,
  onDragPointerCancel,
}: TerminalLeafViewProps) {
  const ttyLabel = `tty${pane.ttyNumber}`;

  return (
    <PaneActiveContext.Provider value={isActive}>
      <div
        className={styles.pane}
        data-pane-id={pane.id}
        data-pane-tty={ttyLabel}
        data-active={isActive ? 'true' : 'false'}
        data-multi={isMultiPane ? 'true' : 'false'}
        data-dragging={isDragging ? 'true' : 'false'}
        onPointerDown={() => onFocus(pane.id)}
      >
        {isMultiPane ? (
          <PaneChromeBar
            paneId={pane.id}
            title={ttyLabel}
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

        <TerminalLeafContent
          pane={pane}
          terminal={terminal}
          terminalForms={terminalForms}
          isActive={isActive}
          isMultiPane={isMultiPane}
          canCloseTab={canCloseTab}
          focusToken={focusToken}
          navigate={navigate}
          renderTui={renderTui}
          onFocus={onFocus}
          onSplit={onSplit}
          onRotate={onRotate}
          onSwap={onSwap}
          onDetach={onDetach}
          onToggleZoom={onToggleZoom}
          onClose={onClose}
          onNewTab={onNewTab}
          onCloseCurrentTab={onCloseCurrentTab}
          onSetTuiOpen={onSetTuiOpen}
        />
      </div>
    </PaneActiveContext.Provider>
  );
}

interface PrimaryPaneViewProps {
  pane: TerminalLeafPane;
  primaryPane: TerminalWorkspacePrimaryPane;
  isActive: boolean;
  isMultiPane: boolean;
  canCloseTab: boolean;
  isZoomed: boolean;
  isDragging: boolean;
  focusToken: number;
  onFocus: (paneId: string) => void;
  onSplit: (paneId: string, direction: SplitCreateDirection) => void;
  onRotate: (paneId: string) => void;
  onSwap: (paneId: string) => void;
  onDetach: (paneId: string) => void;
  onToggleZoom: (paneId: string) => void;
  onClose: (paneId: string) => void;
  onNewTab: () => void;
  onCloseCurrentTab: () => void;
  onSetTuiOpen: (paneId: string, open: boolean) => void;
  onDragPointerDown?: (
    paneId: string,
    canDetach: boolean,
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  onDragPointerMove?: (event: ReactPointerEvent<HTMLElement>) => void;
  onDragPointerUp?: (event: ReactPointerEvent<HTMLElement>) => void;
  onDragPointerCancel?: () => void;
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
  onFocus,
  onSplit,
  onRotate,
  onSwap,
  onDetach,
  onToggleZoom,
  onClose,
  onNewTab,
  onCloseCurrentTab,
  onSetTuiOpen,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerUp,
  onDragPointerCancel,
}: PrimaryPaneViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const embeddedContextValue = useMemo<EmbeddedTerminalPaneContextValue>(
    () => ({
      pane,
      isActive,
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
      onSetTuiOpen,
    }),
    [
      pane,
      isActive,
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
      onSetTuiOpen,
    ],
  );

  // Move DOM focus back into a non-terminal primary pane when switched via Ghostty keyboard navigation.
  useEffect(() => {
    if (!isActive || focusToken <= 1 || primaryPane.embeddedTerminal) {
      return;
    }
    const container = scrollContainerRef.current;
    if (container && !container.contains(document.activeElement)) {
      container.focus({ preventScroll: true });
    }
  }, [focusToken, isActive, primaryPane.embeddedTerminal]);

  const paneLabel = primaryPane.embeddedTerminal ? `tty${pane.ttyNumber}` : primaryPane.title;
  const bodyNode = primaryPane.embeddedTerminal ? (
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

  return (
    <PaneActiveContext.Provider value={isActive}>
      <div
        className={styles.pane}
        data-pane-id={pane.id}
        data-pane-tty={paneLabel}
        data-pane-kind={primaryPane.embeddedTerminal ? 'terminal' : 'primary'}
        data-active={isActive ? 'true' : 'false'}
        data-multi={isMultiPane ? 'true' : 'false'}
        data-dragging={isDragging ? 'true' : 'false'}
        onPointerDown={() => onFocus(pane.id)}
      >
        {isMultiPane ? (
          <PaneChromeBar
            paneId={pane.id}
            title={paneLabel}
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

        {bodyNode}
      </div>
    </PaneActiveContext.Provider>
  );
}

function StandaloneTerminalWorkspace({
  terminal,
  terminalForms,
  navigate,
  renderTui,
  primaryPane,
  disableMenuShortcut = false,
}: TerminalWorkspaceProps) {
  const [tabState, setTabState] = useState<TerminalTabbedWorkspaceState>(() =>
    createInitialTabbedWorkspaceState({ pinnedPrimary: Boolean(primaryPane) }),
  );
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [dragState, setDragState] = useState<ActiveDragState | null>(null);
  const [resizingSplitId, setResizingSplitId] = useState<string | null>(null);

  const paneAreaRef = useRef<HTMLDivElement | null>(null);
  const dragOriginRef = useRef<DragOrigin | null>(null);
  const dividerDragRef = useRef<DividerDragOrigin | null>(null);

  const activeTab = getActiveWorkspaceTab(tabState);
  const activeWorkspace = activeTab.workspace;
  const activeLeaves = useMemo(() => listLeafPanes(activeWorkspace.root), [activeWorkspace.root]);
  const isActiveMultiPane = activeLeaves.length > 1;
  const activeLeaf = findLeafPane(activeWorkspace.root, activeWorkspace.activePaneId);
  const activeIsTerminalPane =
    activeTab.id !== 'tab-1' ||
    activeLeaf?.id !== 'pane-1' ||
    !primaryPane ||
    Boolean(primaryPane.embeddedTerminal);
  const activeTuiOpen = activeIsTerminalPane && Boolean(activeLeaf?.tuiOpen);
  const activeZoomedPaneId =
    activeWorkspace.zoomedPaneId && findLeafPane(activeWorkspace.root, activeWorkspace.zoomedPaneId)
      ? activeWorkspace.zoomedPaneId
      : null;

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || renamingTabId !== null) {
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

      if (event.key === 'Escape' && !event.defaultPrevented && activeTuiOpen) {
        event.preventDefault();
        setTabState(prev =>
          updateActiveTabWorkspace(prev, ws => setPaneTuiOpen(ws, ws.activePaneId, false)),
        );
        return;
      }

      const action = matchGhosttyShortcut(event);
      if (!action) {
        return;
      }

      if (action.type === 'toggle-tui' && !activeIsTerminalPane) {
        return;
      }
      if (action.type === 'open-menu' && (disableMenuShortcut || !navigate)) {
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

      event.preventDefault();
      event.stopPropagation();

      if (event.repeat && action.type !== 'resize') {
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
          setTabState(prev =>
            updateActiveTabWorkspace(prev, ws => setPaneTuiOpen(ws, ws.activePaneId, 'toggle')),
          );
          return;
        case 'open-menu':
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
    activeIsTerminalPane,
    activeLeaf?.pinned,
    activeTab,
    activeTuiOpen,
    disableMenuShortcut,
    dragState,
    isActiveMultiPane,
    navigate,
    primaryPane,
    renamingTabId,
    tabState.tabs.length,
  ]);

  const handleFocusPane = (paneId: string) => {
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
      updateActiveTabWorkspace(prev, ws => {
        const focused = focusPaneById(ws, paneId, false);
        const swappedRight = moveActiveSplit(focused, 'right');
        if (swappedRight !== focused) {
          return swappedRight;
        }
        const swappedLeft = moveActiveSplit(focused, 'left');
        if (swappedLeft !== focused) {
          return swappedLeft;
        }
        const swappedDown = moveActiveSplit(focused, 'down');
        if (swappedDown !== focused) {
          return swappedDown;
        }
        return moveActiveSplit(focused, 'up');
      }),
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

  const handleSetPaneTuiOpen = (paneId: string, open: boolean) => {
    setTabState(prev => updateActiveTabWorkspace(prev, ws => setPaneTuiOpen(ws, paneId, open)));
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
          const canCloseThisTab = tabState.tabs.length > 1 && !tab.pinned;
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
                    {primaryPane && tab.id === 'tab-1' && pane.id === 'pane-1' ? (
                      <PrimaryPaneView
                        pane={pane}
                        primaryPane={primaryPane}
                        isActive={isPaneActive}
                        isMultiPane={isMultiPane}
                        canCloseTab={canCloseThisTab}
                        isZoomed={isZoomed}
                        isDragging={isDraggingPane}
                        focusToken={ws.focusToken}
                        onFocus={handleFocusPane}
                        onSplit={handleSplitPane}
                        onRotate={handleRotatePane}
                        onSwap={handleSwapPane}
                        onDetach={handleDetachPane}
                        onToggleZoom={handleToggleZoom}
                        onClose={handleClosePane}
                        onNewTab={handleAddTab}
                        onCloseCurrentTab={handleCloseCurrentTab}
                        onSetTuiOpen={handleSetPaneTuiOpen}
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
                        renderTui={renderTui}
                        onFocus={handleFocusPane}
                        onSplit={handleSplitPane}
                        onRotate={handleRotatePane}
                        onSwap={handleSwapPane}
                        onDetach={handleDetachPane}
                        onToggleZoom={handleToggleZoom}
                        onClose={handleClosePane}
                        onNewTab={handleAddTab}
                        onCloseCurrentTab={handleCloseCurrentTab}
                        onSetTuiOpen={handleSetPaneTuiOpen}
                        onDragPointerDown={handleDragPointerDown}
                        onDragPointerMove={handleDragPointerMove}
                        onDragPointerUp={handleDragPointerUp}
                        onDragPointerCancel={clearDrag}
                      />
                    )}
                  </div>
                );
              })}

              {dividers.map(divider => {
                const isResizing = isCurrentTab && resizingSplitId === divider.id;
                const percent = Math.round(divider.ratio * 100);
                return (
                  <button
                    key={divider.id}
                    type='button'
                    aria-label={
                      divider.direction === 'vertical'
                        ? `Resize vertical split (${percent}%)`
                        : `Resize horizontal split (${percent}%)`
                    }
                    title='Drag to resize split · double-click to equalize'
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
        renderTui={props.renderTui}
        onFocus={embeddedCtx.onFocus}
        onSplit={embeddedCtx.onSplit}
        onRotate={embeddedCtx.onRotate}
        onSwap={embeddedCtx.onSwap}
        onDetach={embeddedCtx.onDetach}
        onToggleZoom={embeddedCtx.onToggleZoom}
        onClose={embeddedCtx.onClose}
        onNewTab={embeddedCtx.onNewTab}
        onCloseCurrentTab={embeddedCtx.onCloseCurrentTab}
        onSetTuiOpen={embeddedCtx.onSetTuiOpen}
      />
    );
  }

  return <StandaloneTerminalWorkspace {...props} />;
}
