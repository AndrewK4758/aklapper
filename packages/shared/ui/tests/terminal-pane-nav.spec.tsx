import { describe, expect, it } from 'vitest';

import {
  createInitialTabbedWorkspaceState,
  createInitialWorkspaceState,
  detachPaneToNewTab,
  exitPaneTui,
  findLeafPane,
  getActivePaneViewId,
  getActiveWorkspaceTab,
  listLeafPanes,
  openViewInSplit,
  openViewInTab,
  parseCliNavFlags,
  popPaneView,
  pushPaneView,
  splitActivePane,
} from '../src';

describe('terminalPaneNav', () => {
  it('pushes, deduplicates, pops, and exits a pane TUI navigation stack', () => {
    let ws = createInitialWorkspaceState();
    const initialPane = findLeafPane(ws.root, 'pane-1')!;
    expect(getActivePaneViewId(initialPane)).toBeNull();

    // Push launcher -> menu -> agensi
    ws = pushPaneView(ws, 'pane-1', 'tui');
    expect(findLeafPane(ws.root, 'pane-1')?.tuiStack).toEqual(['tui']);
    expect(getActivePaneViewId(findLeafPane(ws.root, 'pane-1')!)).toBe('tui');

    // Consecutive duplicate push is a no-op
    const deduped = pushPaneView(ws, 'pane-1', 'tui');
    expect(deduped).toBe(ws);

    ws = pushPaneView(ws, 'pane-1', '/menu');
    ws = pushPaneView(ws, 'pane-1', '/agensi');
    expect(findLeafPane(ws.root, 'pane-1')?.tuiStack).toEqual(['tui', '/menu', '/agensi']);
    expect(getActivePaneViewId(findLeafPane(ws.root, 'pane-1')!)).toBe('/agensi');

    // Pop one level at a time
    const tokenBeforePop = ws.focusToken;
    ws = popPaneView(ws, 'pane-1');
    expect(findLeafPane(ws.root, 'pane-1')?.tuiStack).toEqual(['tui', '/menu']);
    expect(ws.focusToken).toBe(tokenBeforePop);

    ws = popPaneView(ws, 'pane-1');
    expect(findLeafPane(ws.root, 'pane-1')?.tuiStack).toEqual(['tui']);

    // Popping last item returns to shell and increments focusToken
    ws = popPaneView(ws, 'pane-1');
    expect(findLeafPane(ws.root, 'pane-1')?.tuiStack).toEqual([]);
    expect(getActivePaneViewId(findLeafPane(ws.root, 'pane-1')!)).toBeNull();
    expect(ws.focusToken).toBe(tokenBeforePop + 1);

    // Popping empty stack is a no-op
    expect(popPaneView(ws, 'pane-1')).toBe(ws);

    // Exit clears entire stack straight to shell and increments focusToken
    ws = pushPaneView(ws, 'pane-1', 'tui');
    ws = pushPaneView(ws, 'pane-1', '/menu');
    ws = pushPaneView(ws, 'pane-1', '/agensi');
    const tokenBeforeExit = ws.focusToken;
    ws = exitPaneTui(ws, 'pane-1');
    expect(findLeafPane(ws.root, 'pane-1')?.tuiStack).toEqual([]);
    expect(ws.focusToken).toBe(tokenBeforeExit + 1);
    expect(exitPaneTui(ws, 'pane-1')).toBe(ws);
  });

  it('atomically focuses an unfocused pane when pushing, popping, or exiting on it', () => {
    let ws = createInitialWorkspaceState();
    ws = splitActivePane(ws, 'right'); // pane-1 | pane-2 (active: pane-2)
    ws = pushPaneView(ws, 'pane-2', '/menu');
    ws = pushPaneView(ws, 'pane-2', '/agensi');
    ws = { ...ws, activePaneId: 'pane-1' };

    ws = popPaneView(ws, 'pane-2');
    expect(ws.activePaneId).toBe('pane-2');
    expect(findLeafPane(ws.root, 'pane-2')?.tuiStack).toEqual(['/menu']);
    expect(findLeafPane(ws.root, 'pane-1')?.tuiStack ?? []).toEqual([]);

    ws = { ...ws, activePaneId: 'pane-1' };
    ws = exitPaneTui(ws, 'pane-2');
    expect(ws.activePaneId).toBe('pane-2');
    expect(findLeafPane(ws.root, 'pane-2')?.tuiStack).toEqual([]);
  });

  it('opens a view in a right split pane without mutating the originating pane stack', () => {
    let ws = createInitialWorkspaceState();
    ws = pushPaneView(ws, 'pane-1', 'tui');

    ws = openViewInSplit(ws, 'pane-1', '/agensi', 'right');
    const leaves = listLeafPanes(ws.root);
    expect(leaves).toHaveLength(2);
    expect(leaves[0]?.id).toBe('pane-1');
    expect(leaves[0]?.tuiStack).toEqual(['tui']);
    expect(leaves[1]?.id).toBe('pane-2');
    expect(leaves[1]?.tuiStack).toEqual(['/agensi']);
    expect(ws.activePaneId).toBe('pane-2');
  });

  it('opens a view in a new workspace tab seeded with the target view', () => {
    let tabbed = createInitialTabbedWorkspaceState();
    tabbed = openViewInTab(tabbed, '/cadence');

    expect(tabbed.tabs).toHaveLength(2);
    expect(tabbed.activeTabId).toBe('tab-2');
    const activeTab = getActiveWorkspaceTab(tabbed);
    const activeLeaf = findLeafPane(activeTab.workspace.root, activeTab.workspace.activePaneId)!;
    expect(activeLeaf.tuiStack).toEqual(['/cadence']);
    expect(findLeafPane(tabbed.tabs[0]!.workspace.root, 'pane-1')?.tuiStack ?? []).toEqual([]);
  });

  it('preserves a pane tuiStack when detaching that pane to a new tab', () => {
    let tabbed = createInitialTabbedWorkspaceState();
    const firstTab = tabbed.tabs[0]!;
    let ws = splitActivePane(firstTab.workspace, 'right');
    ws = pushPaneView(ws, 'pane-2', 'tui');
    ws = pushPaneView(ws, 'pane-2', '/menu');
    ws = pushPaneView(ws, 'pane-2', '/agensi');
    tabbed = {
      ...tabbed,
      nextPaneNumber: ws.nextPaneNumber,
      tabs: [{ ...firstTab, workspace: ws }],
    };

    const detached = detachPaneToNewTab(tabbed, 'pane-2');
    expect(detached.tabs).toHaveLength(2);
    expect(detached.activeTabId).toBe('tab-2');
    const detachedLeaf = findLeafPane(
      detached.tabs[1]!.workspace.root,
      detached.tabs[1]!.workspace.activePaneId,
    )!;
    expect(detachedLeaf.tuiStack).toEqual(['tui', '/menu', '/agensi']);
  });

  it('parses CLI navigation flags with deterministic precedence (--tab over --split)', () => {
    expect(parseCliNavFlags([])).toEqual({ target: 'in-pane', positional: [] });
    expect(parseCliNavFlags(['agensi'])).toEqual({ target: 'in-pane', positional: ['agensi'] });
    expect(parseCliNavFlags(['--split'])).toEqual({ target: 'split', positional: [] });
    expect(parseCliNavFlags(['--split', 'agensi'])).toEqual({
      target: 'split',
      positional: ['agensi'],
    });
    expect(parseCliNavFlags(['agensi', '--tab'])).toEqual({
      target: 'tab',
      positional: ['agensi'],
    });
    expect(parseCliNavFlags(['agensi', '--split', '--tab'])).toEqual({
      target: 'tab',
      positional: ['agensi'],
    });
    expect(parseCliNavFlags(['--tab', '--split', 'menu'])).toEqual({
      target: 'tab',
      positional: ['menu'],
    });
  });

  it('seeds pane-1 with initialPrimaryTuiStack when provided to workspace options', () => {
    const ws = createInitialWorkspaceState({
      pinnedPrimary: true,
      initialPrimaryTuiStack: ['/agensi'],
    });
    expect(findLeafPane(ws.root, 'pane-1')?.tuiStack).toEqual(['/agensi']);
  });
});
