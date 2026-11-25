import type { TerminalProfileData } from '@aklapper/core';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  addWorkspaceTab,
  closeActivePaneOrTab,
  closePaneById,
  closeWorkspaceTab,
  computeLeafRects,
  computePaneDropTarget,
  computeSplitDividers,
  createInitialTabbedWorkspaceState,
  createInitialWorkspaceState,
  detachPaneToNewTab,
  dockPane,
  equalizeAllSplits,
  findLeafPane,
  findTuiPane,
  focusDirectionalPane,
  focusPaneById,
  focusRelativePane,
  getActiveWorkspaceTab,
  listLeafPanes,
  matchWorkspaceShortcut,
  moveActiveSplit,
  openTuiPane,
  renameWorkspaceTab,
  resizeActiveSplit,
  rotateActiveSplit,
  selectRelativeWorkspaceTab,
  selectWorkspaceTab,
  selectWorkspaceTabByIndex,
  Select,
  setPaneTuiOpen,
  setSplitRatio,
  splitActivePane,
  swapPanes,
  TerminalWorkspace,
  toggleTuiPane,
  toggleZoomActivePane,
  Tooltip,
  TuiWindow,
} from '../src';

const TERMINAL_FIXTURE: TerminalProfileData = {
  slug: 'portal-home',
  bannerTitle: 'Solar Forge Terminal // tty1',
  bannerMeta: 'tty1 · interactive shell',
  osLabel: '⚡',
  directory: '~/projects/aklapper',
  vcsBranch: 'portfolio_v2',
  vcsState: 'clean',
  contextLabel: 'guest@andrew-k.us',
  placeholder: 'type a command',
  quickCommands: ['help', 'tui', 'clear'],
  initialEntries: [
    {
      command: 'ls -la',
      output: 'menu/ tui/ cadence/',
      status: 'ok',
      durationLabel: '4ms',
      timestamp: '00:00:00',
      sortOrder: 0,
    },
  ],
  commands: [
    {
      name: 'help',
      description: 'list commands',
      kind: 'static',
      output: 'Available terminal commands:\n  tui — open launcher',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 1,
    },
    {
      name: 'whoami',
      description: 'session user',
      kind: 'static',
      output: 'guest@andrew-k.us (tty1)',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 2,
    },
    {
      name: 'tui',
      description: 'open tui',
      kind: 'tui',
      output: 'opening TUI launcher ...',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 3,
    },
    {
      name: 'menu',
      description: 'open menu',
      kind: 'navigate',
      output: 'opening /menu ...',
      targetRoute: '/menu',
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 4,
    },
    {
      name: 'clear',
      description: 'clear scrollback',
      kind: 'clear',
      output: '',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 5,
    },
  ],
};

function makeKey(
  overrides: Partial<{
    key: string;
    code: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
  }>,
) {
  return {
    key: '',
    code: '',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...overrides,
  };
}

describe('terminalPaneTree', () => {
  it('supports splitting, directional focus, relative cycling, resizing, equalizing, zooming, and closing', () => {
    let state = createInitialWorkspaceState();
    expect(listLeafPanes(state.root)).toHaveLength(1);

    // Split right: pane-1 | pane-2 (active: pane-2)
    state = splitActivePane(state, 'right');
    expect(listLeafPanes(state.root).map(p => p.id)).toEqual(['pane-1', 'pane-2']);
    expect(state.activePaneId).toBe('pane-2');

    // Split down on right side: pane-1 | (pane-2 / pane-3) (active: pane-3)
    state = splitActivePane(state, 'down');
    expect(listLeafPanes(state.root).map(p => p.id)).toEqual(['pane-1', 'pane-2', 'pane-3']);
    expect(state.activePaneId).toBe('pane-3');

    // Directional focus up goes from pane-3 -> pane-2; left goes from pane-2 -> pane-1
    state = focusDirectionalPane(state, 'up');
    expect(state.activePaneId).toBe('pane-2');
    state = focusDirectionalPane(state, 'left');
    expect(state.activePaneId).toBe('pane-1');
    state = focusDirectionalPane(state, 'right');
    expect(['pane-2', 'pane-3']).toContain(state.activePaneId);

    // Relative cycling wraps cleanly
    state = focusRelativePane(state, 1);
    const afterNext = state.activePaneId;
    state = focusRelativePane(state, -1);
    expect(state.activePaneId).not.toBe(afterNext);

    // Resize active split and equalize back to 0.5
    state = resizeActiveSplit(state, 'right', 0.1);
    expect(state.root).toMatchObject({ type: 'split', ratio: 0.6 });
    state = equalizeAllSplits(state);
    expect(state.root).toMatchObject({ type: 'split', ratio: 0.5 });

    // Zoom toggle
    state = toggleZoomActivePane(state);
    expect(state.zoomedPaneId).toBe(state.activePaneId);
    state = toggleZoomActivePane(state);
    expect(state.zoomedPaneId).toBeNull();

    // Independent per-pane TUI state
    state = setPaneTuiOpen(state, 'pane-1', true);
    expect(findLeafPane(state.root, 'pane-1')?.tuiOpen).toBe(true);
    expect(findLeafPane(state.root, 'pane-2')?.tuiOpen).toBe(false);

    // Closing collapses tree and refuses to close final pane
    state = closePaneById(state, 'pane-3');
    state = closePaneById(state, 'pane-2');
    expect(listLeafPanes(state.root).map(p => p.id)).toEqual(['pane-1']);
    state = closePaneById(state, 'pane-1');
    expect(listLeafPanes(state.root).map(p => p.id)).toEqual(['pane-1']);
  });

  it('matches macOS, Linux, and browser-safe workspace split/tab keybindings', () => {
    expect(matchWorkspaceShortcut(makeKey({ key: 'd', metaKey: true }))).toEqual({
      type: 'split',
      direction: 'right',
    });
    expect(matchWorkspaceShortcut(makeKey({ key: 'O', ctrlKey: true, shiftKey: true }))).toEqual({
      type: 'split',
      direction: 'right',
    });
    expect(
      matchWorkspaceShortcut(
        makeKey({ key: '}', code: 'BracketRight', ctrlKey: true, shiftKey: true }),
      ),
    ).toEqual({
      type: 'split',
      direction: 'right',
    });
    expect(
      matchWorkspaceShortcut(
        makeKey({ key: ']', code: 'BracketRight', ctrlKey: true, shiftKey: true }),
      ),
    ).toEqual({
      type: 'split',
      direction: 'right',
    });
    expect(matchWorkspaceShortcut(makeKey({ key: 'd', metaKey: true, shiftKey: true }))).toEqual({
      type: 'split',
      direction: 'down',
    });
    expect(matchWorkspaceShortcut(makeKey({ key: 'E', ctrlKey: true, shiftKey: true }))).toEqual({
      type: 'split',
      direction: 'down',
    });
    expect(
      matchWorkspaceShortcut(
        makeKey({ key: '{', code: 'BracketLeft', ctrlKey: true, shiftKey: true }),
      ),
    ).toEqual({
      type: 'split',
      direction: 'down',
    });
    expect(
      matchWorkspaceShortcut(
        makeKey({ key: '[', code: 'BracketLeft', ctrlKey: true, shiftKey: true }),
      ),
    ).toEqual({
      type: 'split',
      direction: 'down',
    });
    expect(matchWorkspaceShortcut(makeKey({ key: ']', metaKey: true }))).toEqual({
      type: 'focus-relative',
      delta: 1,
    });
    expect(matchWorkspaceShortcut(makeKey({ key: '[', metaKey: true }))).toEqual({
      type: 'focus-relative',
      delta: -1,
    });
    expect(
      matchWorkspaceShortcut(makeKey({ key: 'ArrowLeft', ctrlKey: true, altKey: true })),
    ).toEqual({
      type: 'focus-direction',
      direction: 'left',
    });
    expect(
      matchWorkspaceShortcut(makeKey({ key: 'ArrowRight', metaKey: true, altKey: true })),
    ).toEqual({
      type: 'focus-direction',
      direction: 'right',
    });
    expect(
      matchWorkspaceShortcut(makeKey({ key: 'ArrowRight', altKey: true, shiftKey: true })),
    ).toEqual({
      type: 'resize',
      direction: 'right',
    });
    expect(
      matchWorkspaceShortcut(makeKey({ key: 'ArrowUp', altKey: true, shiftKey: true })),
    ).toEqual({
      type: 'resize',
      direction: 'up',
    });
    expect(
      matchWorkspaceShortcut(makeKey({ key: 'Enter', metaKey: true, shiftKey: true })),
    ).toEqual({
      type: 'toggle-zoom',
    });
    expect(matchWorkspaceShortcut(makeKey({ key: '+', ctrlKey: true, shiftKey: true }))).toEqual({
      type: 'equalize',
    });
    expect(
      matchWorkspaceShortcut(
        makeKey({ key: 'E', code: 'KeyE', ctrlKey: true, altKey: true, shiftKey: true }),
      ),
    ).toEqual({
      type: 'equalize',
    });
    expect(matchWorkspaceShortcut(makeKey({ key: 'W', ctrlKey: true, shiftKey: true }))).toEqual({
      type: 'close-pane',
    });
    expect(matchWorkspaceShortcut(makeKey({ key: 't', altKey: true }))).toEqual({
      type: 'toggle-tui',
    });
    expect(matchWorkspaceShortcut(makeKey({ key: 'm', altKey: true }))).toEqual({
      type: 'open-menu',
    });
    expect(
      matchWorkspaceShortcut(
        makeKey({ key: 'ArrowLeft', ctrlKey: true, altKey: true, shiftKey: true }),
      ),
    ).toEqual({
      type: 'move-split',
      direction: 'left',
    });
    expect(matchWorkspaceShortcut(makeKey({ key: 'R', ctrlKey: true, shiftKey: true }))).toEqual({
      type: 'rotate-split',
    });
    expect(
      matchWorkspaceShortcut(makeKey({ key: 'R', ctrlKey: true, altKey: true, shiftKey: true })),
    ).toEqual({
      type: 'rotate-split',
    });
    expect(
      matchWorkspaceShortcut(makeKey({ key: 'T', ctrlKey: true, altKey: true, shiftKey: true })),
    ).toEqual({
      type: 'detach-pane',
    });
    expect(matchWorkspaceShortcut(makeKey({ key: 'T', ctrlKey: true, shiftKey: true }))).toEqual({
      type: 'new-tab',
    });
    expect(matchWorkspaceShortcut(makeKey({ key: 'T', altKey: true, shiftKey: true }))).toEqual({
      type: 'new-tab',
    });
    expect(matchWorkspaceShortcut(makeKey({ key: 'A', ctrlKey: true, shiftKey: true }))).toEqual({
      type: 'rename-tab',
    });
    expect(matchWorkspaceShortcut(makeKey({ key: 'A', altKey: true, shiftKey: true }))).toEqual({
      type: 'rename-tab',
    });
    expect(matchWorkspaceShortcut(makeKey({ key: 'Tab', ctrlKey: true }))).toEqual({
      type: 'focus-tab-relative',
      delta: 1,
    });
    expect(matchWorkspaceShortcut(makeKey({ key: 'Tab', ctrlKey: true, shiftKey: true }))).toEqual({
      type: 'focus-tab-relative',
      delta: -1,
    });
    expect(matchWorkspaceShortcut(makeKey({ key: 'PageDown', ctrlKey: true }))).toEqual({
      type: 'focus-tab-relative',
      delta: 1,
    });
    expect(matchWorkspaceShortcut(makeKey({ key: 'PageUp', ctrlKey: true }))).toEqual({
      type: 'focus-tab-relative',
      delta: -1,
    });
    expect(matchWorkspaceShortcut(makeKey({ key: ']', altKey: true }))).toEqual({
      type: 'focus-tab-relative',
      delta: 1,
    });
    expect(matchWorkspaceShortcut(makeKey({ key: '[', altKey: true }))).toEqual({
      type: 'focus-tab-relative',
      delta: -1,
    });
    expect(matchWorkspaceShortcut(makeKey({ key: '1', altKey: true }))).toEqual({
      type: 'focus-tab-index',
      index: 0,
    });
    expect(matchWorkspaceShortcut(makeKey({ key: '9', altKey: true }))).toEqual({
      type: 'focus-tab-index',
      index: 'last',
    });
  });

  it('supports swapping, docking across all drop zones, directional moving, and split orientation rotation', () => {
    let state = createInitialWorkspaceState();
    state = splitActivePane(state, 'right'); // pane-1 | pane-2 (active: pane-2)
    state = splitActivePane(state, 'down'); // pane-1 | (pane-2 / pane-3) (active: pane-3)

    // Swap pane-3 and pane-1
    state = swapPanes(state, 'pane-3', 'pane-1');
    expect(state.activePaneId).toBe('pane-3');
    expect(listLeafPanes(state.root).map(p => p.id)).toEqual(['pane-3', 'pane-2', 'pane-1']);

    // Dock pane-3 to top edge of pane-2
    state = dockPane(state, 'pane-3', 'pane-2', 'top');
    const afterTopDock = computeLeafRects(state.root);
    const pane3Rect = afterTopDock.find(r => r.id === 'pane-3')!;
    const pane2Rect = afterTopDock.find(r => r.id === 'pane-2')!;
    expect(pane3Rect.y).toBeLessThan(pane2Rect.y);

    // Dock pane-3 to root-left (full height on left)
    state = dockPane(state, 'pane-3', null, 'root-left');
    const afterRootLeft = computeLeafRects(state.root);
    const pane3FullLeft = afterRootLeft.find(r => r.id === 'pane-3')!;
    expect(pane3FullLeft).toMatchObject({ x: 0, y: 0, width: 0.5, height: 1 });

    // moveActiveSplit right swaps pane-3 with its neighbor; moveActiveSplit up from full-height left docks root-top
    state = moveActiveSplit(state, 'right');
    expect(computeLeafRects(state.root).find(r => r.id === 'pane-3')?.x).toBeGreaterThan(0);
    state = moveActiveSplit(state, 'up');
    const afterMoveUp = computeLeafRects(state.root);
    expect(afterMoveUp.find(r => r.id === 'pane-3')?.y).toBe(0);

    // Rotate active split flips parent split orientation
    let pair = splitActivePane(createInitialWorkspaceState(), 'right');
    expect(pair.root).toMatchObject({ type: 'split', direction: 'vertical' });
    pair = rotateActiveSplit(pair);
    expect(pair.root).toMatchObject({ type: 'split', direction: 'horizontal' });
    pair = rotateActiveSplit(pair);
    expect(pair.root).toMatchObject({ type: 'split', direction: 'vertical' });
  });

  it('computes workspace drop zones for detach-tab, root margins, center-swap, and 25% edges', () => {
    let state = splitActivePane(createInitialWorkspaceState(), 'right');
    state = splitActivePane(state, 'down'); // pane-1 (left half) | (pane-2 top-right / pane-3 bottom-right)
    const rect = { left: 100, top: 100, width: 800, height: 600 };

    // Above pane area within detach band -> detach-tab
    expect(
      computePaneDropTarget(state.root, 'pane-2', { x: 400, y: 80 }, rect, {
        allowDetachTab: true,
      }),
    ).toMatchObject({ zone: 'detach-tab', targetId: null });

    // Without allowDetachTab -> null above pane area
    expect(
      computePaneDropTarget(state.root, 'pane-2', { x: 400, y: 80 }, rect, {
        allowDetachTab: false,
      }),
    ).toBeNull();

    // Outer 18px left margin -> root-left
    expect(computePaneDropTarget(state.root, 'pane-2', { x: 105, y: 400 }, rect)).toMatchObject({
      zone: 'root-left',
      targetId: null,
    });

    // Center of pane-1 (x in 100..500, y in 100..700 -> center at 300, 400) -> center-swap
    expect(computePaneDropTarget(state.root, 'pane-2', { x: 300, y: 400 }, rect)).toMatchObject({
      zone: 'center-swap',
      targetId: 'pane-1',
    });

    // Top 25% edge inside pane-1 (past 18px root margin) -> top
    expect(computePaneDropTarget(state.root, 'pane-2', { x: 300, y: 140 }, rect)).toMatchObject({
      zone: 'top',
      targetId: 'pane-1',
    });

    // Dragging over self -> null
    expect(computePaneDropTarget(state.root, 'pane-2', { x: 700, y: 250 }, rect)).toBeNull();
  });

  it('manages multi-tab workspace lifecycle with MRU close restoration, rename, pinned tab guard, and split detachment', () => {
    let tabs = createInitialTabbedWorkspaceState({ pinnedPrimary: true });
    expect(tabs.tabs).toHaveLength(1);
    expect(getActiveWorkspaceTab(tabs).pinned).toBe(true);

    // Add tab-2 and tab-3; switch back to tab-1, then tab-3, then close tab-3 -> MRU returns to tab-1
    tabs = addWorkspaceTab(tabs);
    tabs = addWorkspaceTab(tabs);
    expect(tabs.tabs.map(t => t.id)).toEqual(['tab-1', 'tab-2', 'tab-3']);
    tabs = selectWorkspaceTab(tabs, 'tab-1');
    tabs = selectWorkspaceTabByIndex(tabs, 'last');
    expect(tabs.activeTabId).toBe('tab-3');
    tabs = closeWorkspaceTab(tabs, 'tab-3');
    expect(tabs.activeTabId).toBe('tab-1');

    // Relative tab cycling wraps cleanly
    tabs = selectRelativeWorkspaceTab(tabs, 1);
    expect(tabs.activeTabId).toBe('tab-2');
    tabs = selectRelativeWorkspaceTab(tabs, 1);
    expect(tabs.activeTabId).toBe('tab-1');

    // Rename tab-2
    tabs = renameWorkspaceTab(tabs, 'tab-2', 'build-logs');
    expect(tabs.tabs.find(t => t.id === 'tab-2')?.title).toBe('build-logs');

    // Pinned tab-1 cannot be closed directly or via closeActivePaneOrTab
    const afterPinnedAttempt = closeActivePaneOrTab(tabs);
    expect(afterPinnedAttempt.tabs).toHaveLength(2);
    expect(afterPinnedAttempt.tabs[0]?.id).toBe('tab-1');

    // Split inside tab-1, then detach pane-2 to a new tab
    tabs = {
      ...tabs,
      tabs: tabs.tabs.map(t =>
        t.id === 'tab-1' ? { ...t, workspace: splitActivePane(t.workspace, 'right') } : t,
      ),
    };
    const spawnedId = getActiveWorkspaceTab(tabs).workspace.activePaneId;
    tabs = detachPaneToNewTab(tabs, spawnedId);
    expect(tabs.tabs).toHaveLength(3);
    expect(listLeafPanes(tabs.tabs[0]!.workspace.root)).toHaveLength(1);
    expect(listLeafPanes(getActiveWorkspaceTab(tabs).workspace.root)).toHaveLength(1);

    // closeActivePaneOrTab closes the detached single-pane tab
    tabs = closeActivePaneOrTab(tabs);
    expect(tabs.tabs).toHaveLength(2);
  });

  it('opens, focuses, and toggles a snapped TUI split pane beside the anchor pane without duplicating', () => {
    let state = createInitialWorkspaceState();
    expect(findTuiPane(state.root)).toBeNull();

    // Opening TUI splits right beside pane-1 and activates the new TUI pane
    state = openTuiPane(state, 'pane-1', 'right');
    const tuiLeaf = findTuiPane(state.root);
    expect(tuiLeaf).toMatchObject({ id: 'pane-2', kind: 'tui', tuiOpen: true });
    expect(state.activePaneId).toBe('pane-2');
    expect(computeLeafRects(state.root)).toEqual([
      { id: 'pane-1', x: 0, y: 0, width: 0.5, height: 1 },
      { id: 'pane-2', x: 0.5, y: 0, width: 0.5, height: 1 },
    ]);
    expect(computeSplitDividers(state.root)).toHaveLength(1);

    // Focus back on pane-1, then openTuiPane again focuses the existing TUI pane without spawning a 3rd pane
    state = focusPaneById(state, 'pane-1');
    expect(state.activePaneId).toBe('pane-1');
    const beforeToken = state.focusToken;
    state = openTuiPane(state, 'pane-1', 'right');
    expect(listLeafPanes(state.root)).toHaveLength(2);
    expect(state.activePaneId).toBe('pane-2');
    expect(state.focusToken).toBe(beforeToken + 1);

    // toggleTuiPane closes the TUI split pane when it is active and restores focus to pane-1
    state = toggleTuiPane(state);
    expect(findTuiPane(state.root)).toBeNull();
    expect(listLeafPanes(state.root).map(p => p.id)).toEqual(['pane-1']);
    expect(state.activePaneId).toBe('pane-1');

    // toggleTuiPane re-opens when closed, and focuses existing when inactive
    state = toggleTuiPane(state, 'pane-1', 'right');
    const reopenedId = findTuiPane(state.root)?.id;
    expect(reopenedId).toBe('pane-3');
    expect(state.activePaneId).toBe('pane-3');
    state = focusPaneById(state, 'pane-1');
    state = toggleTuiPane(state, 'pane-1', 'right');
    expect(state.activePaneId).toBe('pane-3');
    expect(listLeafPanes(state.root)).toHaveLength(2);
  });
});

describe('TerminalWorkspace', () => {
  it('opens split terminals via workspace keybindings, snaps TUI into a split pane, preserves scrollback across zoom, and closes panes', () => {
    const navigate = vi.fn<(to: string) => void>();
    const { container } = render(
      <TerminalWorkspace
        terminal={TERMINAL_FIXTURE}
        navigate={navigate}
        renderTui={({ ttyNumber, closeTui }) => (
          <TuiWindow title={`tui :: tty${ttyNumber}`} closeOnEscape={false} onClose={closeTui}>
            <div>Launcher pane {ttyNumber}</div>
          </TuiWindow>
        )}
      />,
    );

    const workspaceEl = container.querySelector('[data-pane-count]') as HTMLElement;
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');

    // Run a command in tty1 so we can verify its scrollback survives zoom/unzoom
    const pane1Input = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    fireEvent.change(pane1Input, { target: { value: 'whoami' } });
    fireEvent.submit(pane1Input.closest('form') as HTMLFormElement);
    expect(screen.getByText('guest@andrew-k.us (tty1)')).toBeTruthy();

    // Cmd+D splits right into tty2 and focuses tty2
    fireEvent.keyDown(window, { key: 'd', metaKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');

    const pane2 = container.querySelector('[data-pane-tty="tty2"]') as HTMLElement;
    expect(pane2.getAttribute('data-active')).toBe('true');

    // Running `tui` inside tty2 snaps a TUI split pane beside tty2 (3 panes total)
    const activeInput = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    fireEvent.change(activeInput, { target: { value: 'tui' } });
    fireEvent.submit(activeInput.closest('form') as HTMLFormElement);
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('3');
    const tuiPane = container.querySelector('[data-pane-kind="tui"]') as HTMLElement;
    expect(tuiPane).toBeTruthy();
    expect(tuiPane.getAttribute('data-active')).toBe('true');
    expect(within(tuiPane).getByText('Launcher pane 3')).toBeTruthy();

    // Switch back to tty1 via Ctrl+Alt+ArrowLeft; running `tui` again focuses existing TUI pane without duplicating
    fireEvent.keyDown(window, { key: 'ArrowLeft', ctrlKey: true, altKey: true });
    fireEvent.keyDown(window, { key: 'ArrowLeft', ctrlKey: true, altKey: true });
    const pane1 = container.querySelector('[data-pane-tty="tty1"]') as HTMLElement;
    expect(pane1.getAttribute('data-active')).toBe('true');

    const tty1Input = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    fireEvent.change(tty1Input, { target: { value: 'tui' } });
    fireEvent.submit(tty1Input.closest('form') as HTMLFormElement);
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('3');
    expect(tuiPane.getAttribute('data-active')).toBe('true');

    // Zoom the TUI pane via Ctrl+Shift+Enter, then unzoom and verify tty1 scrollback survived
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-zoomed')).toBe('true');
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-zoomed')).toBe('false');
    expect(within(pane1).getByText('guest@andrew-k.us (tty1)')).toBeTruthy();

    // Pressing Escape while the TUI pane is active closes the TUI split pane and returns to 2 panes
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');
    expect(container.querySelector('[data-pane-kind="tui"]')).toBeNull();

    // Alt+T opens a snapped TUI split pane and pressing Alt+T again closes it
    fireEvent.keyDown(window, { key: 't', altKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('3');
    expect(container.querySelector('[data-pane-kind="tui"]')).toBeTruthy();
    fireEvent.keyDown(window, { key: 't', altKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');
    expect(container.querySelector('[data-pane-kind="tui"]')).toBeNull();

    // Close active split pane (tty2) via Ctrl+Shift+W
    fireEvent.keyDown(window, { key: 'W', ctrlKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');

    // Help output renders directly from terminal.commands (DB-driven) with zero hardcoded Ghostty/zsh leakage
    const remainingInput = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    fireEvent.change(remainingInput, { target: { value: 'help' } });
    fireEvent.submit(remainingInput.closest('form') as HTMLFormElement);
    expect(screen.getByText(/Available terminal commands:/i)).toBeTruthy();
    expect(container.textContent).not.toMatch(/ghostty|\bzsh\b|p10k|powerlevel10k/i);

    // Alt+M still navigates to /menu
    fireEvent.keyDown(window, { key: 'm', altKey: true });
    expect(navigate).toHaveBeenCalledWith('/menu');
  });

  it('runs interactive contact form inline in terminal mode with fieldset headers, :back, Escape guard, Shift+Enter textarea, drag-and-drop file, review edit, and Postgres receipt', async () => {
    const { CONTACT_FORM_DEFINITION } = await import('@aklapper/core');
    const navigate = vi.fn<(to: string) => void>();
    const openTuiRoute = vi.fn<() => void>();
    const submit = vi.fn<(fd: FormData) => Promise<import('@aklapper/core').ContactActionResult>>(
      async fd => ({
        ok: true,
        submission: {
          id: '55555555-5555-4555-8555-555555555555',
          name: String(fd.get('name') ?? ''),
          email: String(fd.get('email') ?? ''),
          phone: (fd.get('phone') as string) || null,
          attachmentName: fd.get('file') instanceof File ? (fd.get('file') as File).name : null,
          attachmentSizeBytes:
            fd.get('file') instanceof File ? (fd.get('file') as File).size : null,
          attachmentSha256: fd.get('file') instanceof File ? 'a'.repeat(64) : null,
          createdAt: '2026-11-24T15:00:00.000Z',
        },
      }),
    );

    const { container } = render(
      <TerminalWorkspace
        terminal={TERMINAL_FIXTURE}
        navigate={navigate}
        terminalForms={{
          contact: {
            definition: CONTACT_FORM_DEFINITION,
            openTuiRoute,
            submit,
          },
        }}
      />,
    );

    const submitLine = (value: string) => {
      const el = screen.getByLabelText('Terminal command input') as
        | HTMLInputElement
        | HTMLTextAreaElement;
      fireEvent.change(el, { target: { value } });
      fireEvent.submit(el.closest('form') as HTMLFormElement);
    };

    // Start interactive `contact` — stays in terminal mode without navigating or opening TUI
    submitLine('contact');
    expect(navigate).not.toHaveBeenCalled();
    expect(openTuiRoute).not.toHaveBeenCalled();
    expect(container.querySelector('[data-form-mode="contact"]')).toBeTruthy();
    expect(screen.getByText(/┌─ 01 \/\/ Sender Identity/)).toBeTruthy();

    // Validation error on empty required Name
    submitLine('');
    expect(screen.getByText(/✖ Name is required/)).toBeTruthy();

    // Drag-and-drop file onto pane while on Name step attaches without wiping current input
    const nameInput = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Ada' } });
    const droppedFile = new File(['engine notes'], 'notes.txt', { type: 'text/plain' });
    const section = container.querySelector('section[data-form-mode="contact"]') as HTMLElement;
    fireEvent.drop(section, { dataTransfer: { files: [droppedFile] } });
    expect(screen.getByText(/▸ attached notes\.txt/i)).toBeTruthy();
    expect(nameInput.value).toBe('Ada');

    // Complete Name and Email, test :back, then Phone (optional skip)
    submitLine('Ada Lovelace');
    submitLine('ada@typo.example');
    submitLine(':back');
    expect(screen.getByText(/↩ Back to Email/i)).toBeTruthy();
    submitLine('ada@example.com');
    expect(screen.getByText(/├─ 01\.1 \/\/ Optional Callback Channel/)).toBeTruthy();
    submitLine('');

    // Message step switches to <textarea>, ignores Escape so draft survives, Enter submits
    expect(screen.getByText(/┌─ 02 \/\/ Message & Attachment/)).toBeTruthy();
    const textarea = screen.getByLabelText('Terminal command input') as HTMLTextAreaElement;
    expect(textarea.tagName).toBe('TEXTAREA');
    fireEvent.change(textarea, { target: { value: 'Line 1\nLine 2 message body' } });
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(textarea.value).toBe('Line 1\nLine 2 message body');
    fireEvent.keyDown(textarea, { key: 'Enter' });

    // File step shows existing dragged attachment and inline [attach file] button; Enter keeps it
    expect(screen.getByRole('button', { name: '[attach file]' })).toBeTruthy();
    submitLine('');

    // Review summary allows editing a field (`e email`) then confirming (`y`)
    expect(screen.getByText(/┌─ Review Transmission \/\/ Ready for PostgreSQL 19/)).toBeTruthy();
    submitLine('e email');
    submitLine('ada.final@example.com');
    submitLine('y');

    const receiptEl = await screen.findByText(/TRANSMISSION COMMITTED \/\/ POSTGRES 19/);
    expect(receiptEl.textContent).toContain('Ada Lovelace <ada.final@example.com>');
    expect(receiptEl.textContent).toContain('notes.txt');
    expect(submit).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-form-mode="contact"]')).toBeNull();
  });

  it('supports one-shot CLI flags, --help, --tui, Ctrl+C cancel, 422 DB error recovery, and split-pane isolation', async () => {
    const { CONTACT_FORM_DEFINITION } = await import('@aklapper/core');
    const openTuiRoute = vi.fn<() => void>();
    const submit = vi
      .fn<(fd: FormData) => Promise<import('@aklapper/core').ContactActionResult>>()
      .mockResolvedValueOnce({
        ok: false,
        source: 'database',
        formError: 'Database constraint rejected Email format.',
        fieldErrors: { email: ['Database constraint rejected Email format.'] },
      })
      .mockResolvedValueOnce({
        ok: true,
        submission: {
          id: '66666666-6666-4666-8666-666666666666',
          name: 'Grace Hopper',
          email: 'grace@example.com',
          phone: null,
          attachmentName: null,
          attachmentSizeBytes: null,
          attachmentSha256: null,
          createdAt: '2026-11-24T15:30:00.000Z',
        },
      });

    const { container } = render(
      <TerminalWorkspace
        terminal={TERMINAL_FIXTURE}
        terminalForms={{
          contact: {
            definition: CONTACT_FORM_DEFINITION,
            openTuiRoute,
            submit,
          },
        }}
      />,
    );

    const submitActive = (value: string) => {
      const el = screen.getByLabelText('Terminal command input', { exact: true }) as
        | HTMLInputElement
        | HTMLTextAreaElement;
      fireEvent.change(el, { target: { value } });
      fireEvent.submit(el.closest('form') as HTMLFormElement);
    };

    // --help prints usage; --tui opens TUI route
    submitActive('contact --help');
    expect(screen.getByText(/Usage: contact \[options]/i)).toBeTruthy();

    submitActive('contact --tui');
    expect(openTuiRoute).toHaveBeenCalledTimes(1);

    // One-shot flags hit mocked 422 DB error -> re-prompts ONLY failing `email` field
    submitActive(
      'contact --name "Grace Hopper" --email "grace@bad.example" --message "Testing 422 database error recovery."',
    );
    expect(
      await screen.findByText(/\[database] Database constraint rejected Email format\./),
    ).toBeTruthy();
    const retryInput = screen.getByLabelText('Terminal command input', {
      exact: true,
    }) as HTMLInputElement;
    expect(retryInput.getAttribute('data-form-field')).toBe('email');

    // Fix email -> review -> send -> 201 receipt
    submitActive('grace@example.com');
    submitActive('y');
    expect(await screen.findByText(/TRANSMISSION COMMITTED \/\/ POSTGRES 19/)).toBeTruthy();
    expect(submit).toHaveBeenCalledTimes(2);

    // Split pane isolation: start `contact` in tty2 only; tty1 stays in normal shell mode; Ctrl+C cancels tty2
    fireEvent.keyDown(window, { key: 'd', metaKey: true });
    submitActive('contact');
    const pane1 = container.querySelector('[data-pane-tty="tty1"]') as HTMLElement;
    const pane2 = container.querySelector('[data-pane-tty="tty2"]') as HTMLElement;
    expect(pane1.querySelector('[data-form-mode="contact"]')).toBeNull();
    expect(pane2.querySelector('[data-form-mode="contact"]')).toBeTruthy();

    const pane2Input = within(pane2).getByLabelText('Terminal command input', {
      exact: true,
    }) as HTMLInputElement;
    fireEvent.keyDown(pane2Input, { key: 'c', ctrlKey: true });
    expect(within(pane2).getByText('Transmission cancelled.')).toBeTruthy();
    expect(pane2.querySelector('[data-form-mode="contact"]')).toBeNull();
  });

  it('splits a separate terminal pane from a TUI primary view, isolates Escape to the active pane, and protects the pinned route pane', () => {
    const onClosePrimaryTui = vi.fn<() => void>();
    const { container } = render(
      <TerminalWorkspace
        terminal={TERMINAL_FIXTURE}
        renderTui={({ ttyNumber, closeTui }) => (
          <TuiWindow title={`overlay :: tty${ttyNumber}`} closeOnEscape={false} onClose={closeTui}>
            <div>Overlay inside tty{ttyNumber}</div>
          </TuiWindow>
        )}
        primaryPane={{
          title: 'tui :: /contact',
          content: (
            <TuiWindow title='Contact TUI' onClose={onClosePrimaryTui}>
              <div>Contact Form Surface</div>
            </TuiWindow>
          ),
        }}
      />,
    );

    const workspaceEl = container.querySelector('[data-pane-count]') as HTMLElement;
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');
    expect(screen.getByText('Contact Form Surface')).toBeTruthy();

    // Physical KeyD (e.g. macOS Option+Shift+D) splits right from the TUI view
    fireEvent.keyDown(window, { key: 'Î', code: 'KeyD', altKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');
    expect(screen.getByText('Contact Form Surface')).toBeTruthy();

    const pane2 = container.querySelector('[data-pane-tty="tty2"]') as HTMLElement;
    expect(pane2.getAttribute('data-active')).toBe('true');

    // Pressing Escape while tty2 is focused does NOT close the primary TUI window in pane-1
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClosePrimaryTui).not.toHaveBeenCalled();

    // Spawned tty2 pane can snap open a TUI split pane via Alt+T and close ONLY that TUI pane on Escape
    fireEvent.keyDown(window, { key: 't', altKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('3');
    const tuiPane = container.querySelector('[data-pane-kind="tui"]') as HTMLElement;
    expect(tuiPane).toBeTruthy();
    expect(within(tuiPane).getByText('Overlay inside tty3')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');
    expect(container.querySelector('[data-pane-kind="tui"]')).toBeNull();
    expect(onClosePrimaryTui).not.toHaveBeenCalled();

    // Switch focus back to pane-1 via Ctrl+Alt+ArrowLeft; trying to close pinned pane-1 is ignored
    fireEvent.keyDown(window, { key: 'ArrowLeft', ctrlKey: true, altKey: true });
    const pane1 = container.querySelector('[data-pane-id="pane-1"]') as HTMLElement;
    expect(pane1.getAttribute('data-active')).toBe('true');
    fireEvent.keyDown(window, { key: 'W', ctrlKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');

    // Now Escape closes the primary TUI because pane-1 is active
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClosePrimaryTui).toHaveBeenCalledTimes(1);

    // Switch back to tty2 and close it via Cmd+Shift+W
    fireEvent.keyDown(window, { key: ']', metaKey: true });
    fireEvent.keyDown(window, { key: 'w', metaKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');
  });

  it('delegates splits and tui split panes cleanly without double-splitting when an embedded TerminalWorkspace mounts inside primaryPane', () => {
    const { container } = render(
      <TerminalWorkspace
        terminal={TERMINAL_FIXTURE}
        renderTui={({ closeTui }) => (
          <TuiWindow title='tui :: launcher' closeOnEscape={false} onClose={closeTui}>
            <div>Embedded Launcher Surface</div>
          </TuiWindow>
        )}
        primaryPane={{
          title: 'tty1',
          flush: true,
          embeddedTerminal: true,
          content: <TerminalWorkspace terminal={TERMINAL_FIXTURE} />,
        }}
      />,
    );

    const workspaces = container.querySelectorAll('[data-pane-count]');
    expect(workspaces).toHaveLength(1);
    const workspaceEl = workspaces[0] as HTMLElement;

    // Typing `tui` inside the embedded tty1 snaps open a TUI split pane in the outer workspace
    const input = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'tui' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');
    const tuiPane = container.querySelector('[data-pane-kind="tui"]') as HTMLElement;
    expect(tuiPane).toBeTruthy();
    expect(within(tuiPane).getByText('Embedded Launcher Surface')).toBeTruthy();

    // Detaching the TUI pane moves it to its own tab labeled `tui`; clicking TuiWindow close closes that tab
    fireEvent.keyDown(window, { key: 'T', ctrlKey: true, altKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('2');
    expect(screen.getByRole('tab', { name: 'tui' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close window' }));
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('1');
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');

    // One Cmd+D splits into exactly 2 panes (no nested double-handling)
    fireEvent.keyDown(window, { key: 'd', metaKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');
  });

  it('ignores tui command and Alt+T when renderTui is not provided', () => {
    const { container } = render(<TerminalWorkspace terminal={TERMINAL_FIXTURE} />);
    const workspaceEl = container.querySelector('[data-pane-count]') as HTMLElement;

    const input = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'tui' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');
    expect(container.querySelector('[data-pane-kind="tui"]')).toBeNull();

    fireEvent.keyDown(window, { key: 't', altKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');
    expect(container.querySelector('[data-pane-kind="tui"]')).toBeNull();
  });

  it('splits horizontally and vertically via Ctrl+Shift+} and Ctrl+Shift+{ on terminal and TUI windows, resizes with Alt+Shift+Arrow, and equalizes with Ctrl+Alt+Shift+E', () => {
    const { container } = render(
      <TerminalWorkspace
        terminal={TERMINAL_FIXTURE}
        primaryPane={{
          title: 'tui :: /menu',
          content: (
            <TuiWindow title='Menu TUI'>
              <div>Menu Surface</div>
            </TuiWindow>
          ),
        }}
      />,
    );

    const workspaceEl = container.querySelector('[data-pane-count]') as HTMLElement;
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');

    // Ctrl+Shift+} splits right (side-by-side) directly from the TUI window
    fireEvent.keyDown(window, {
      key: '}',
      code: 'BracketRight',
      ctrlKey: true,
      shiftKey: true,
    });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');

    // Key-repeat while holding Ctrl+Shift+} does not spawn duplicate panes
    fireEvent.keyDown(window, {
      key: '}',
      code: 'BracketRight',
      ctrlKey: true,
      shiftKey: true,
      repeat: true,
    });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');

    const slotsAfterRight = Array.from(container.querySelectorAll('[data-pane-id]')).map(
      el => el.parentElement as HTMLElement,
    );
    expect(slotsAfterRight[0]?.style.getPropertyValue('--sf-pane-w')).toBe('0.5');
    expect(slotsAfterRight[1]?.style.getPropertyValue('--sf-pane-x')).toBe('0.5');
    expect(slotsAfterRight[1]?.style.getPropertyValue('--sf-pane-w')).toBe('0.5');

    // Alt+Shift+ArrowRight resizes active vertical split; Ctrl+Alt+Shift+E equalizes back to 0.5
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true, shiftKey: true });
    expect(slotsAfterRight[0]?.style.getPropertyValue('--sf-pane-w')).toBe('0.55');
    fireEvent.keyDown(window, {
      key: 'E',
      code: 'KeyE',
      ctrlKey: true,
      altKey: true,
      shiftKey: true,
    });
    expect(slotsAfterRight[0]?.style.getPropertyValue('--sf-pane-w')).toBe('0.5');

    // Ctrl+Shift+{ splits the active terminal pane (tty2) vertically (stacked top/bottom)
    fireEvent.keyDown(window, {
      key: '{',
      code: 'BracketLeft',
      ctrlKey: true,
      shiftKey: true,
    });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('3');

    const pane2Slot = container.querySelector('[data-pane-tty="tty2"]')
      ?.parentElement as HTMLElement;
    const pane3Slot = container.querySelector('[data-pane-tty="tty3"]')
      ?.parentElement as HTMLElement;
    expect(pane2Slot.style.getPropertyValue('--sf-pane-y')).toBe('0');
    expect(pane2Slot.style.getPropertyValue('--sf-pane-h')).toBe('0.5');
    expect(pane3Slot.style.getPropertyValue('--sf-pane-y')).toBe('0.5');
    expect(pane3Slot.style.getPropertyValue('--sf-pane-h')).toBe('0.5');
  });

  it('creates, switches, renames, preserves scrollback across, and closes tabs while protecting a pinned primary tab', () => {
    const { container } = render(
      <TerminalWorkspace
        terminal={TERMINAL_FIXTURE}
        primaryPane={{
          title: 'tui :: /menu',
          content: (
            <TuiWindow title='Menu TUI'>
              <div>Pinned Menu Tab</div>
            </TuiWindow>
          ),
        }}
      />,
    );

    const workspaceEl = container.querySelector('[data-pane-count]') as HTMLElement;
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('1');
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-1');

    // Open tab-2 via + button and run a command so we can verify scrollback survives tab switches
    fireEvent.click(screen.getByRole('button', { name: 'New terminal tab' }));
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('2');
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-2');

    const tab2Input = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    fireEvent.change(tab2Input, { target: { value: 'whoami' } });
    fireEvent.submit(tab2Input.closest('form') as HTMLFormElement);
    const tab2Panel = container.querySelector('[data-tab-panel="tab-2"]') as HTMLElement;
    expect(within(tab2Panel).getByText('guest@andrew-k.us (tty1)')).toBeTruthy();

    // Open tab-3 via Ctrl+Shift+T, then rename via Ctrl+Shift+A (Escape cancels, then Enter commits)
    fireEvent.keyDown(window, { key: 'T', code: 'KeyT', ctrlKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('3');
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-3');

    fireEvent.keyDown(window, { key: 'A', code: 'KeyA', ctrlKey: true, shiftKey: true });
    const cancelInput = screen.getByLabelText('Rename tab') as HTMLInputElement;
    fireEvent.change(cancelInput, { target: { value: 'discarded' } });
    fireEvent.keyDown(cancelInput, { key: 'Escape' });
    expect(screen.queryByLabelText('Rename tab')).toBeNull();

    const tab3Button = container.querySelector(
      '[data-tab-id="tab-3"] [role="tab"]',
    ) as HTMLButtonElement;
    fireEvent.doubleClick(tab3Button);
    const renameInput = screen.getByLabelText('Rename tab') as HTMLInputElement;
    fireEvent.change(renameInput, { target: { value: 'ops-shell' } });
    fireEvent.keyDown(renameInput, { key: 'Enter' });
    expect(screen.getByRole('tab', { name: 'ops-shell' })).toBeTruthy();

    // Switch to tab-1 via Alt+1, verify pinned tab-1 cannot be closed via Ctrl+Shift+W
    fireEvent.keyDown(window, { key: '1', code: 'Digit1', altKey: true });
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-1');
    fireEvent.keyDown(window, { key: 'W', code: 'KeyW', ctrlKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('3');

    // Cycle to tab-2 via Alt+] and confirm scrollback survived tab switching
    fireEvent.keyDown(window, { key: ']', code: 'BracketRight', altKey: true });
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-2');
    expect(within(tab2Panel).getByText('guest@andrew-k.us (tty1)')).toBeTruthy();

    // Jump to last tab via Alt+9 and close it via `exit`, then close tab-2 via tab close button
    fireEvent.keyDown(window, { key: '9', code: 'Digit9', altKey: true });
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-3');
    const tab3Input = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    fireEvent.change(tab3Input, { target: { value: 'exit' } });
    fireEvent.submit(tab3Input.closest('form') as HTMLFormElement);
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('2');

    const closeTab2Btn = container.querySelector(
      '[data-tab-id="tab-2"] button[aria-label^="Close tab"]',
    ) as HTMLButtonElement;
    fireEvent.click(closeTab2Btn);
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('1');
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-1');
  });

  it('swaps splits with Ctrl+Alt+Shift+Arrow, rotates orientation with Ctrl+Shift+R only when split, and detaches panes to new tabs', () => {
    const { container } = render(<TerminalWorkspace terminal={TERMINAL_FIXTURE} />);
    const workspaceEl = container.querySelector('[data-pane-count]') as HTMLElement;

    // On a single unsplit pane, Ctrl+Shift+R must NOT call preventDefault (preserves browser reload)
    const singlePaneRotateEvent = new KeyboardEvent('keydown', {
      key: 'R',
      code: 'KeyR',
      ctrlKey: true,
      shiftKey: true,
      cancelable: true,
    });
    window.dispatchEvent(singlePaneRotateEvent);
    expect(singlePaneRotateEvent.defaultPrevented).toBe(false);

    // Split right: pane-1 (left) | pane-2 (right, active)
    fireEvent.keyDown(window, { key: '}', code: 'BracketRight', ctrlKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');

    const pane1Slot = () =>
      container.querySelector('[data-pane-tty="tty1"]')?.parentElement as HTMLElement;
    const pane2Slot = () =>
      container.querySelector('[data-pane-tty="tty2"]')?.parentElement as HTMLElement;
    expect(pane1Slot().style.getPropertyValue('--sf-pane-x')).toBe('0');
    expect(pane2Slot().style.getPropertyValue('--sf-pane-x')).toBe('0.5');

    // Ctrl+Alt+Shift+ArrowLeft swaps active pane-2 with pane-1
    fireEvent.keyDown(window, {
      key: 'ArrowLeft',
      ctrlKey: true,
      altKey: true,
      shiftKey: true,
    });
    expect(pane2Slot().style.getPropertyValue('--sf-pane-x')).toBe('0');
    expect(pane1Slot().style.getPropertyValue('--sf-pane-x')).toBe('0.5');

    // Ctrl+Shift+R rotates vertical split into horizontal split (stacked top/bottom)
    fireEvent.keyDown(window, { key: 'R', code: 'KeyR', ctrlKey: true, shiftKey: true });
    expect(pane2Slot().style.getPropertyValue('--sf-pane-w')).toBe('1');
    expect(pane2Slot().style.getPropertyValue('--sf-pane-h')).toBe('0.5');
    expect(pane1Slot().style.getPropertyValue('--sf-pane-y')).toBe('0.5');

    // Ctrl+Alt+Shift+T detaches active pane-2 into a new tab
    fireEvent.keyDown(window, {
      key: 'T',
      code: 'KeyT',
      ctrlKey: true,
      altKey: true,
      shiftKey: true,
    });
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('2');
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-2');
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');
  });

  it('supports pointer drag-and-drop swapping, edge docking, tab-strip detachment, and Escape cancellation', () => {
    const { container } = render(<TerminalWorkspace terminal={TERMINAL_FIXTURE} />);
    const workspaceEl = container.querySelector('[data-pane-count]') as HTMLElement;

    // Create 2 side-by-side panes: pane-1 (left 0..400) | pane-2 (right 400..800)
    fireEvent.keyDown(window, { key: '}', code: 'BracketRight', ctrlKey: true, shiftKey: true });
    const paneArea = container.querySelector('[data-pane-area="true"]') as HTMLElement;
    vi.spyOn(paneArea, 'getBoundingClientRect').mockReturnValue({
      x: 100,
      y: 100,
      left: 100,
      top: 100,
      right: 900,
      bottom: 700,
      width: 800,
      height: 600,
      toJSON: () => ({}),
    });

    const getDragHandle = (paneId: string) =>
      container.querySelector(`[data-pane-drag-handle="${paneId}"]`) as HTMLElement;
    const getSlot = (paneId: string) =>
      container.querySelector(`[data-pane-id="${paneId}"]`)?.parentElement as HTMLElement;

    // 1) Drag pane-2 to center of pane-1 (x=300, y=400) -> preview center-swap, drop swaps panes
    const handle2 = getDragHandle('pane-2');
    fireEvent.pointerDown(handle2, { button: 0, pointerId: 1, clientX: 600, clientY: 120 });
    fireEvent.pointerMove(handle2, { pointerId: 1, clientX: 300, clientY: 400 });
    expect(container.querySelector('[data-drop-zone="center-swap"]')).toBeTruthy();
    fireEvent.pointerUp(handle2, { pointerId: 1, clientX: 300, clientY: 400 });
    expect(container.querySelector('[data-drop-overlay="true"]')).toBeNull();
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-x')).toBe('0');
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-x')).toBe('0.5');

    // 2) Drag pane-2 to top edge of pane-1 (x=700, y=140) -> preview top, Escape cancels cleanly
    const handle2AfterSwap = getDragHandle('pane-2');
    fireEvent.pointerDown(handle2AfterSwap, {
      button: 0,
      pointerId: 2,
      clientX: 200,
      clientY: 120,
    });
    fireEvent.pointerMove(handle2AfterSwap, { pointerId: 2, clientX: 700, clientY: 140 });
    expect(container.querySelector('[data-drop-zone="top"]')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('[data-drop-overlay="true"]')).toBeNull();
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-x')).toBe('0');

    // 3) Drag pane-2 to top edge of pane-1 and drop -> docks pane-2 above pane-1 (height 0.5)
    fireEvent.pointerDown(handle2AfterSwap, {
      button: 0,
      pointerId: 3,
      clientX: 200,
      clientY: 120,
    });
    fireEvent.pointerMove(handle2AfterSwap, { pointerId: 3, clientX: 700, clientY: 140 });
    expect(container.querySelector('[data-drop-zone="top"]')).toBeTruthy();
    fireEvent.pointerUp(handle2AfterSwap, { pointerId: 3, clientX: 700, clientY: 140 });
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-y')).toBe('0');
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-h')).toBe('0.5');
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-y')).toBe('0.5');

    // 4) Drag pane-2 up into tab-strip detach band (y=80, above top=100) -> detaches to tab-2
    const handle2BeforeDetach = getDragHandle('pane-2');
    fireEvent.pointerDown(handle2BeforeDetach, {
      button: 0,
      pointerId: 4,
      clientX: 400,
      clientY: 120,
    });
    fireEvent.pointerMove(handle2BeforeDetach, { pointerId: 4, clientX: 400, clientY: 80 });
    expect(container.querySelector('[data-drop-zone="detach-tab"]')).toBeTruthy();
    expect(container.querySelector('[data-drop-detach="true"]')).toBeTruthy();
    fireEvent.pointerUp(handle2BeforeDetach, { pointerId: 4, clientX: 400, clientY: 80 });
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('2');
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-2');
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');
  });

  it('renders interactive horizontal and vertical split dividers with drag resize, non-collapsible clamping, Escape cancel, double-click equalize, keyboard resize, and zoom hiding', () => {
    // Pure tree geometry check for nested vertical + horizontal dividers
    let tree = splitActivePane(createInitialWorkspaceState(), 'right');
    tree = splitActivePane(tree, 'down');
    const pureDividers = computeSplitDividers(tree.root);
    expect(pureDividers).toHaveLength(2);
    expect(pureDividers[0]).toMatchObject({
      direction: 'vertical',
      x: 0.5,
      y: 0,
      length: 1,
      containerStart: 0,
      containerSpan: 1,
    });
    expect(pureDividers[1]).toMatchObject({
      direction: 'horizontal',
      x: 0.5,
      y: 0.5,
      length: 0.5,
      containerStart: 0,
      containerSpan: 1,
    });
    tree = setSplitRatio(tree, pureDividers[0]!.id, 0.99);
    expect(computeSplitDividers(tree.root)[0]?.ratio).toBe(0.8);
    tree = setSplitRatio(tree, pureDividers[0]!.id, 0.01);
    expect(computeSplitDividers(tree.root)[0]?.ratio).toBe(0.2);

    // UI integration with nested vertical + horizontal splits: pane-1 | (pane-2 / pane-3)
    const { container } = render(<TerminalWorkspace terminal={TERMINAL_FIXTURE} />);
    expect(container.querySelectorAll('[data-split-divider]')).toHaveLength(0);

    fireEvent.keyDown(window, { key: '}', code: 'BracketRight', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: '{', code: 'BracketLeft', ctrlKey: true, shiftKey: true });

    const paneArea = container.querySelector('[data-pane-area="true"]') as HTMLElement;
    vi.spyOn(paneArea, 'getBoundingClientRect').mockReturnValue({
      x: 100,
      y: 100,
      left: 100,
      top: 100,
      right: 1100,
      bottom: 700,
      width: 1000,
      height: 600,
      toJSON: () => ({}),
    });

    const verticalDivider = container.querySelector(
      '[data-split-divider][data-direction="vertical"]',
    ) as HTMLElement;
    const horizontalDivider = container.querySelector(
      '[data-split-divider][data-direction="horizontal"]',
    ) as HTMLElement;
    expect(verticalDivider).toBeTruthy();
    expect(horizontalDivider).toBeTruthy();
    expect(
      screen.getAllByRole('button', { name: /Resize (vertical|horizontal) split/i }),
    ).toHaveLength(2);

    const pane1Slot = () =>
      container.querySelector('[data-pane-id="pane-1"]')?.parentElement as HTMLElement;
    const pane2Slot = () =>
      container.querySelector('[data-pane-id="pane-2"]')?.parentElement as HTMLElement;

    // Drag vertical divider from x=600 (0.5) -> x=700 (0.6)
    fireEvent.pointerDown(verticalDivider, {
      button: 0,
      pointerId: 10,
      clientX: 600,
      clientY: 300,
    });
    expect(verticalDivider.getAttribute('data-resizing')).toBe('true');
    fireEvent.pointerMove(verticalDivider, { pointerId: 10, clientX: 700, clientY: 300 });
    expect(pane1Slot().style.getPropertyValue('--sf-pane-w')).toBe('0.6');
    fireEvent.pointerUp(verticalDivider, { pointerId: 10, clientX: 700, clientY: 300 });
    expect(verticalDivider.getAttribute('data-resizing')).toBe('false');

    // Drag vertical divider far past edge (non-collapsible clamp to 0.8), then press Escape to revert to 0.6
    fireEvent.pointerDown(verticalDivider, {
      button: 0,
      pointerId: 11,
      clientX: 700,
      clientY: 300,
    });
    fireEvent.pointerMove(verticalDivider, { pointerId: 11, clientX: 1090, clientY: 300 });
    expect(pane1Slot().style.getPropertyValue('--sf-pane-w')).toBe('0.8');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(pane1Slot().style.getPropertyValue('--sf-pane-w')).toBe('0.6');
    expect(verticalDivider.getAttribute('data-resizing')).toBe('false');

    // Drag horizontal divider from y=400 (0.5) -> y=490 (0.65), then double-click to equalize back to 0.5
    fireEvent.pointerDown(horizontalDivider, {
      button: 0,
      pointerId: 12,
      clientX: 800,
      clientY: 400,
    });
    fireEvent.pointerMove(horizontalDivider, { pointerId: 12, clientX: 800, clientY: 490 });
    expect(pane2Slot().style.getPropertyValue('--sf-pane-h')).toBe('0.65');
    fireEvent.pointerUp(horizontalDivider, { pointerId: 12, clientX: 800, clientY: 490 });
    fireEvent.doubleClick(horizontalDivider);
    expect(pane2Slot().style.getPropertyValue('--sf-pane-h')).toBe('0.5');

    // Keyboard ArrowRight / Home on focused vertical divider adjusts and equalizes cleanly
    fireEvent.keyDown(verticalDivider, { key: 'ArrowRight' });
    expect(pane1Slot().style.getPropertyValue('--sf-pane-w')).toBe('0.65');
    fireEvent.keyDown(verticalDivider, { key: 'Home' });
    expect(pane1Slot().style.getPropertyValue('--sf-pane-w')).toBe('0.5');

    // Zooming hides split dividers; unzooming restores them
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true, shiftKey: true });
    expect(container.querySelectorAll('[data-split-divider]')).toHaveLength(0);
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true, shiftKey: true });
    expect(container.querySelectorAll('[data-split-divider]')).toHaveLength(2);
  });

  it('renders styled Tooltip popups without native title attributes for workspace controls and omits drag tooltip when zoomed', async () => {
    const { container } = render(
      <Tooltip.Provider delay={0}>
        <TerminalWorkspace terminal={TERMINAL_FIXTURE} />
      </Tooltip.Provider>,
    );

    // Split right to expose pane drag handles and split divider
    fireEvent.keyDown(window, { key: '}', code: 'BracketRight', ctrlKey: true, shiftKey: true });

    const tabButton = screen.getByRole('tab');
    const newTabButton = screen.getByRole('button', { name: 'New terminal tab' });
    const dragHandle = container.querySelector('[data-pane-drag-handle="pane-1"]') as HTMLElement;
    const splitDivider = container.querySelector('[data-split-divider]') as HTMLElement;

    expect(dragHandle).not.toBeNull();
    expect(splitDivider).not.toBeNull();

    // None of the four controls should expose native HTML title attributes
    expect(tabButton.getAttribute('title')).toBeNull();
    expect(newTabButton.getAttribute('title')).toBeNull();
    expect(dragHandle.getAttribute('title')).toBeNull();
    expect(splitDivider.getAttribute('title')).toBeNull();

    // Tab label button tooltip on focus
    fireEvent.focus(tabButton);
    await waitFor(() => {
      expect(screen.getByText('Click to switch · double-click to rename')).toBeTruthy();
    });
    fireEvent.blur(tabButton);

    // New-tab button tooltip on focus
    fireEvent.focus(newTabButton);
    await waitFor(() => {
      expect(screen.getByText('New Tab (Alt+Shift+T)')).toBeTruthy();
    });
    fireEvent.blur(newTabButton);

    // Pane drag handle tooltip on pointer hover when draggable
    fireEvent.pointerMove(dragHandle);
    fireEvent.mouseEnter(dragHandle);
    await waitFor(() => {
      expect(screen.getByText('Drag to swap, dock, or drop onto tab strip to detach')).toBeTruthy();
    });
    fireEvent.mouseLeave(dragHandle);

    // Split divider tooltip on focus
    fireEvent.focus(splitDivider);
    await waitFor(() => {
      expect(screen.getByText('Drag to resize split · double-click to equalize')).toBeTruthy();
    });
    fireEvent.blur(splitDivider);

    // Zooming sets canDrag=false; drag handle should have no title and show no drag tooltip
    fireEvent.click(screen.getByRole('button', { name: 'Zoom tty1' }));
    const zoomedDragHandle = container.querySelector(
      '[data-pane-drag-handle="pane-1"]',
    ) as HTMLElement;
    expect(zoomedDragHandle).not.toBeNull();
    expect(zoomedDragHandle.getAttribute('data-draggable')).toBe('false');
    expect(zoomedDragHandle.getAttribute('title')).toBeNull();
    fireEvent.pointerMove(zoomedDragHandle);
    fireEvent.mouseEnter(zoomedDragHandle);
    expect(screen.queryByText('Drag to swap, dock, or drop onto tab strip to detach')).toBeNull();
  });

  it('allows Escape to exit TUI pane while passive Tooltip is open but blocks Escape while interactive Select popup is open', async () => {
    const { container } = render(
      <Tooltip.Provider delay={0}>
        <TerminalWorkspace
          terminal={TERMINAL_FIXTURE}
          renderPaneView={ctx => {
            if (ctx.viewId === 'tui') {
              return (
                <TuiWindow title='Interactive Select Pane' onClose={ctx.exitTui}>
                  <Select.Root defaultValue='one'>
                    <Select.Trigger data-testid='pane-select-trigger'>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner>
                        <Select.Popup>
                          <Select.List>
                            <Select.Item value='one'>
                              <Select.ItemText>Option One</Select.ItemText>
                            </Select.Item>
                          </Select.List>
                        </Select.Popup>
                      </Select.Positioner>
                    </Select.Portal>
                  </Select.Root>
                </TuiWindow>
              );
            }
            return null;
          }}
        />
      </Tooltip.Provider>,
    );

    const openTui = () => {
      const input = screen.getByLabelText('Terminal command input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'tui' } });
      fireEvent.submit(input.closest('form') as HTMLFormElement);
    };

    const pane1 = () => container.querySelector('[data-pane-id="pane-1"]') as HTMLElement;

    // 1. Open TUI and open interactive Select popup -> Escape closes popup without exiting TUI pane.
    openTui();
    expect(pane1().getAttribute('data-tui-depth')).toBe('1');
    const selectTrigger = screen.getByTestId('pane-select-trigger');
    fireEvent.click(selectTrigger);
    await screen.findByRole('listbox');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBeNull();
    });
    expect(pane1().getAttribute('data-tui-depth')).toBe('1');

    // 2. Focus passive Tooltip trigger (sets data-popup-open without aria-haspopup) -> Escape MUST still exit TUI pane.
    const newTabButton = screen.getByRole('button', { name: 'New terminal tab' });
    fireEvent.focus(newTabButton);
    await waitFor(() => {
      expect(screen.getByText('New Tab (Alt+Shift+T)')).toBeTruthy();
    });
    expect(newTabButton.getAttribute('data-popup-open')).not.toBeNull();
    expect(newTabButton.getAttribute('aria-haspopup')).toBeNull();

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(pane1().getAttribute('data-tui-depth')).toBe('0');
    });
  });
});
