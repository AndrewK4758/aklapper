import type { TerminalProfileData } from '@aklapper/core';
import {
  createContext,
  type CSSProperties,
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
  closePaneById,
  computeLeafRects,
  createInitialWorkspaceState,
  equalizeAllSplits,
  findLeafPane,
  focusDirectionalPane,
  focusPaneById,
  focusRelativePane,
  listLeafPanes,
  matchGhosttyShortcut,
  resizeActiveSplit,
  setPaneTuiOpen,
  splitActivePane,
  type SplitCreateDirection,
  type TerminalLeafPane,
  type TerminalWorkspaceState,
  toggleZoomActivePane,
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
  readonly focusToken: number;
  readonly onFocus: (paneId: string) => void;
  readonly onSplit: (paneId: string, direction: SplitCreateDirection) => void;
  readonly onToggleZoom: (paneId: string) => void;
  readonly onClose: (paneId: string) => void;
  readonly onSetTuiOpen: (paneId: string, open: boolean) => void;
}

const PaneActiveContext = createContext<boolean>(true);
const EmbeddedTerminalPaneContext = createContext<EmbeddedTerminalPaneContextValue | null>(null);

export function useIsPaneActive(): boolean {
  return useContext(PaneActiveContext);
}

const SPLIT_HELP_APPENDIX = [
  '',
  'Split panes (Ghostty keybindings & commands):',
  '  Ctrl+Shift+} / Ctrl+Shift+O / Cmd+D (or "split" / "vsplit") — split terminal right',
  '  Ctrl+Shift+{ / Ctrl+Shift+E / Cmd+Shift+D (or "hsplit")     — split terminal down',
  '  Ctrl+Alt+Arrows / Cmd+Alt+Arrows (or Cmd+] / Cmd+[)         — focus neighbor pane',
  '  Alt+Shift+Arrows / Ctrl+Cmd+Arrows                          — resize active split',
  '  Ctrl+Shift+Enter / Cmd+Shift+Enter (or "zoom")              — toggle active pane zoom',
  '  Ctrl+Alt+Shift+E / Ctrl+Shift+= / Cmd+Shift+=               — equalize split sizes',
  '  Ctrl+Shift+W / Cmd+Shift+W (or "exit")                      — close active split pane',
].join('\n');

interface PaneChromeBarProps {
  paneId: string;
  title: string;
  isZoomed: boolean;
  canClose: boolean;
  onSplit: (paneId: string, direction: SplitCreateDirection) => void;
  onToggleZoom: (paneId: string) => void;
  onClose: (paneId: string) => void;
}

function PaneChromeBar({
  paneId,
  title,
  isZoomed,
  canClose,
  onSplit,
  onToggleZoom,
  onClose,
}: PaneChromeBarProps) {
  return (
    <div className={styles.paneBar}>
      <span className={styles.paneTitle}>
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
  focusToken: number;
  navigate?: (to: string) => void | Promise<void>;
  renderTui?: (context: TerminalPaneTuiContext) => ReactNode;
  onFocus: (paneId: string) => void;
  onSplit: (paneId: string, direction: SplitCreateDirection) => void;
  onToggleZoom: (paneId: string) => void;
  onClose: (paneId: string) => void;
  onSetTuiOpen: (paneId: string, open: boolean) => void;
}

function TerminalLeafContent({
  pane,
  terminal,
  terminalForms,
  isActive,
  isMultiPane,
  focusToken,
  navigate,
  renderTui,
  onFocus,
  onSplit,
  onToggleZoom,
  onClose,
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
        return { output: `tty${pane.ttyNumber} is the primary session (open another split first)` };
      },
    };
  }, [
    isMultiPane,
    navigate,
    onClose,
    onSetTuiOpen,
    onSplit,
    onToggleZoom,
    pane.id,
    pane.pinned,
    pane.ttyNumber,
    pane.tuiOpen,
    terminal.commands,
  ]);

  const ttyLabel = `tty${pane.ttyNumber}`;
  const inputLabel =
    !isMultiPane || isActive ? 'Terminal command input' : `Terminal command input (${ttyLabel})`;

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
        focusOnMount
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
}

function TerminalLeafView({
  pane,
  terminal,
  terminalForms,
  isActive,
  isMultiPane,
  isZoomed,
  focusToken,
  navigate,
  renderTui,
  onFocus,
  onSplit,
  onToggleZoom,
  onClose,
  onSetTuiOpen,
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
        onPointerDown={() => onFocus(pane.id)}
      >
        {isMultiPane ? (
          <PaneChromeBar
            paneId={pane.id}
            title={ttyLabel}
            isZoomed={isZoomed}
            canClose={!pane.pinned}
            onSplit={onSplit}
            onToggleZoom={onToggleZoom}
            onClose={onClose}
          />
        ) : null}

        <TerminalLeafContent
          pane={pane}
          terminal={terminal}
          terminalForms={terminalForms}
          isActive={isActive}
          isMultiPane={isMultiPane}
          focusToken={focusToken}
          navigate={navigate}
          renderTui={renderTui}
          onFocus={onFocus}
          onSplit={onSplit}
          onToggleZoom={onToggleZoom}
          onClose={onClose}
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
  isZoomed: boolean;
  focusToken: number;
  onFocus: (paneId: string) => void;
  onSplit: (paneId: string, direction: SplitCreateDirection) => void;
  onToggleZoom: (paneId: string) => void;
  onClose: (paneId: string) => void;
  onSetTuiOpen: (paneId: string, open: boolean) => void;
}

function PrimaryPaneView({
  pane,
  primaryPane,
  isActive,
  isMultiPane,
  isZoomed,
  focusToken,
  onFocus,
  onSplit,
  onToggleZoom,
  onClose,
  onSetTuiOpen,
}: PrimaryPaneViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const embeddedContextValue = useMemo<EmbeddedTerminalPaneContextValue>(
    () => ({
      pane,
      isActive,
      isMultiPane,
      focusToken,
      onFocus,
      onSplit,
      onToggleZoom,
      onClose,
      onSetTuiOpen,
    }),
    [
      pane,
      isActive,
      isMultiPane,
      focusToken,
      onFocus,
      onSplit,
      onToggleZoom,
      onClose,
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
        onPointerDown={() => onFocus(pane.id)}
      >
        {isMultiPane ? (
          <PaneChromeBar
            paneId={pane.id}
            title={paneLabel}
            isZoomed={isZoomed}
            canClose={!pane.pinned}
            onSplit={onSplit}
            onToggleZoom={onToggleZoom}
            onClose={onClose}
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
  const [workspace, setWorkspace] = useState<TerminalWorkspaceState>(() =>
    createInitialWorkspaceState({ pinnedPrimary: Boolean(primaryPane) }),
  );

  const leaves = useMemo(() => listLeafPanes(workspace.root), [workspace.root]);
  const isMultiPane = leaves.length > 1;
  const activeLeaf = findLeafPane(workspace.root, workspace.activePaneId);
  const activeIsTerminalPane =
    activeLeaf?.id !== 'pane-1' || !primaryPane || Boolean(primaryPane.embeddedTerminal);
  const activeTuiOpen = activeIsTerminalPane && Boolean(activeLeaf?.tuiOpen);
  const zoomedPaneId =
    workspace.zoomedPaneId && findLeafPane(workspace.root, workspace.zoomedPaneId)
      ? workspace.zoomedPaneId
      : null;

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) {
        return;
      }

      if (event.key === 'Escape' && !event.defaultPrevented && activeTuiOpen) {
        event.preventDefault();
        setWorkspace(prev => setPaneTuiOpen(prev, prev.activePaneId, false));
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
      if (action.type === 'resize' && !isMultiPane) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (event.repeat && action.type !== 'resize') {
        return;
      }

      switch (action.type) {
        case 'split':
          setWorkspace(prev => splitActivePane(prev, action.direction));
          return;
        case 'focus-relative':
          setWorkspace(prev => focusRelativePane(prev, action.delta));
          return;
        case 'focus-direction':
          setWorkspace(prev => focusDirectionalPane(prev, action.direction));
          return;
        case 'resize':
          setWorkspace(prev => resizeActiveSplit(prev, action.direction));
          return;
        case 'toggle-zoom':
          setWorkspace(prev => toggleZoomActivePane(prev));
          return;
        case 'equalize':
          setWorkspace(prev => equalizeAllSplits(prev));
          return;
        case 'close-pane':
          setWorkspace(prev => closePaneById(prev, prev.activePaneId));
          return;
        case 'toggle-tui':
          setWorkspace(prev => setPaneTuiOpen(prev, prev.activePaneId, 'toggle'));
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
  }, [activeIsTerminalPane, activeTuiOpen, disableMenuShortcut, isMultiPane, navigate]);

  const handleFocusPane = (paneId: string) => {
    setWorkspace(prev => focusPaneById(prev, paneId, false));
  };

  const handleSplitPane = (paneId: string, direction: SplitCreateDirection) => {
    setWorkspace(prev => splitActivePane(focusPaneById(prev, paneId, false), direction));
  };

  const handleToggleZoom = (paneId: string) => {
    setWorkspace(prev => toggleZoomActivePane(focusPaneById(prev, paneId, false)));
  };

  const handleClosePane = (paneId: string) => {
    setWorkspace(prev => closePaneById(prev, paneId));
  };

  const handleSetPaneTuiOpen = (paneId: string, open: boolean) => {
    setWorkspace(prev => setPaneTuiOpen(prev, paneId, open));
  };

  const rectsById = useMemo(() => {
    const map = new Map<string, { x: number; y: number; width: number; height: number }>();
    for (const rect of computeLeafRects(workspace.root)) {
      map.set(rect.id, rect);
    }
    return map;
  }, [workspace.root]);

  return (
    <div
      className={styles.workspace}
      data-pane-count={leaves.length}
      data-zoomed={zoomedPaneId ? 'true' : 'false'}
    >
      {leaves.map(pane => {
        const isZoomed = pane.id === zoomedPaneId;
        const isHidden = Boolean(zoomedPaneId) && !isZoomed;
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
            {primaryPane && pane.id === 'pane-1' ? (
              <PrimaryPaneView
                pane={pane}
                primaryPane={primaryPane}
                isActive={pane.id === workspace.activePaneId}
                isMultiPane={isMultiPane}
                isZoomed={isZoomed}
                focusToken={workspace.focusToken}
                onFocus={handleFocusPane}
                onSplit={handleSplitPane}
                onToggleZoom={handleToggleZoom}
                onClose={handleClosePane}
                onSetTuiOpen={handleSetPaneTuiOpen}
              />
            ) : (
              <TerminalLeafView
                pane={pane}
                terminal={terminal}
                terminalForms={terminalForms}
                isActive={pane.id === workspace.activePaneId}
                isMultiPane={isMultiPane}
                isZoomed={isZoomed}
                focusToken={workspace.focusToken}
                navigate={navigate}
                renderTui={renderTui}
                onFocus={handleFocusPane}
                onSplit={handleSplitPane}
                onToggleZoom={handleToggleZoom}
                onClose={handleClosePane}
                onSetTuiOpen={handleSetPaneTuiOpen}
              />
            )}
          </div>
        );
      })}
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
        focusToken={embeddedCtx.focusToken}
        navigate={props.navigate}
        renderTui={props.renderTui}
        onFocus={embeddedCtx.onFocus}
        onSplit={embeddedCtx.onSplit}
        onToggleZoom={embeddedCtx.onToggleZoom}
        onClose={embeddedCtx.onClose}
        onSetTuiOpen={embeddedCtx.onSetTuiOpen}
      />
    );
  }

  return <StandaloneTerminalWorkspace {...props} />;
}
