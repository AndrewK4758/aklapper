import {
  addWorkspaceTab,
  findLeafPane,
  focusPaneById,
  splitActivePane,
  type SplitCreateDirection,
  type TerminalLeafPane,
  type TerminalPaneNode,
  type TerminalTabbedWorkspaceState,
  type TerminalWorkspaceState,
} from './terminalPaneTree';

export type TerminalNavTarget = 'in-pane' | 'split' | 'tab';

export interface ParsedCliNavFlags {
  readonly target: TerminalNavTarget;
  readonly positional: readonly string[];
}

export function getActivePaneViewId(pane: TerminalLeafPane): string | null {
  const stack = pane.tuiStack;
  if (!stack || stack.length === 0) {
    return null;
  }
  return stack[stack.length - 1] ?? null;
}

function updateLeafStack(
  node: TerminalPaneNode,
  paneId: string,
  updater: (current: readonly string[]) => readonly string[],
): TerminalPaneNode {
  if (node.type === 'leaf') {
    if (node.id !== paneId) {
      return node;
    }
    const current = node.tuiStack ?? [];
    const next = updater(current);
    if (next === current) {
      return node;
    }
    return {
      ...node,
      tuiStack: next,
    };
  }

  const nextFirst = updateLeafStack(node.first, paneId, updater);
  if (nextFirst !== node.first) {
    return { ...node, first: nextFirst };
  }
  const nextSecond = updateLeafStack(node.second, paneId, updater);
  if (nextSecond !== node.second) {
    return { ...node, second: nextSecond };
  }
  return node;
}

export function pushPaneView(
  state: TerminalWorkspaceState,
  paneId: string,
  viewId: string,
): TerminalWorkspaceState {
  const leaf = findLeafPane(state.root, paneId);
  if (!leaf) {
    return state;
  }
  const current = leaf.tuiStack ?? [];
  const top = current[current.length - 1];
  if (top === viewId) {
    return state.activePaneId === paneId ? state : focusPaneById(state, paneId, false);
  }

  const nextRoot = updateLeafStack(state.root, paneId, stack => [...stack, viewId]);
  return {
    ...state,
    root: nextRoot,
    activePaneId: paneId,
  };
}

export function popPaneView(
  state: TerminalWorkspaceState,
  paneId: string,
): TerminalWorkspaceState {
  const leaf = findLeafPane(state.root, paneId);
  if (!leaf) {
    return state;
  }
  const current = leaf.tuiStack ?? [];
  if (current.length === 0) {
    return state;
  }

  const nextStack = current.slice(0, -1);
  const nextRoot = updateLeafStack(state.root, paneId, () => nextStack);
  return {
    ...state,
    root: nextRoot,
    activePaneId: paneId,
    focusToken: nextStack.length === 0 ? state.focusToken + 1 : state.focusToken,
  };
}

export function exitPaneTui(
  state: TerminalWorkspaceState,
  paneId: string,
): TerminalWorkspaceState {
  const leaf = findLeafPane(state.root, paneId);
  if (!leaf) {
    return state;
  }
  const current = leaf.tuiStack ?? [];
  if (current.length === 0) {
    return state;
  }

  const nextRoot = updateLeafStack(state.root, paneId, () => []);
  return {
    ...state,
    root: nextRoot,
    activePaneId: paneId,
    focusToken: state.focusToken + 1,
  };
}

export function openViewInSplit(
  state: TerminalWorkspaceState,
  paneId: string,
  viewId: string,
  direction: SplitCreateDirection = 'right',
): TerminalWorkspaceState {
  const focused = focusPaneById(state, paneId, false);
  const split = splitActivePane(focused, direction);
  if (split === focused) {
    return state;
  }
  return pushPaneView(split, split.activePaneId, viewId);
}

export function openViewInTab(
  state: TerminalTabbedWorkspaceState,
  viewId: string,
): TerminalTabbedWorkspaceState {
  const withNewTab = addWorkspaceTab(state);
  const newTabId = withNewTab.activeTabId;
  return {
    ...withNewTab,
    tabs: withNewTab.tabs.map(tab => {
      if (tab.id !== newTabId) {
        return tab;
      }
      return {
        ...tab,
        workspace: pushPaneView(tab.workspace, tab.workspace.activePaneId, viewId),
      };
    }),
  };
}

export function parseCliNavFlags(args: readonly string[]): ParsedCliNavFlags {
  let target: TerminalNavTarget = 'in-pane';
  const positional: string[] = [];

  for (const arg of args) {
    if (arg === '--tab') {
      target = 'tab';
    } else if (arg === '--split') {
      if (target !== 'tab') {
        target = 'split';
      }
    } else {
      positional.push(arg);
    }
  }

  return { target, positional };
}
