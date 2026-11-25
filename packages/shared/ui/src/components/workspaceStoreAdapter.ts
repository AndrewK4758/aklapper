import {
  findLeafPane,
  type InitialWorkspaceOptions,
  listLeafPanes,
  type TerminalPaneNode,
  type TerminalTabbedWorkspaceState,
  type TerminalWorkspaceTab,
} from './terminalPaneTree';

export interface WorkspaceStateSnapshot {
  readonly tabs: TerminalTabbedWorkspaceState;
  readonly paneHistory: Readonly<Record<string, readonly string[]>>;
}

export interface WorkspaceStoreAdapter {
  getServerSnapshot: (
    routeKey: string,
    initialOptions?: InitialWorkspaceOptions,
  ) => WorkspaceStateSnapshot;
  getClientSnapshot: (
    routeKey: string,
    initialOptions?: InitialWorkspaceOptions,
  ) => WorkspaceStateSnapshot;
  subscribe: (routeKey: string, listener: () => void) => () => void;
  updateTabs: (
    routeKey: string,
    initialOptions: InitialWorkspaceOptions | undefined,
    updater: (prev: TerminalTabbedWorkspaceState) => TerminalTabbedWorkspaceState,
  ) => void;
  setPaneHistory: (
    routeKey: string,
    initialOptions: InitialWorkspaceOptions | undefined,
    paneId: string,
    history: readonly string[],
  ) => void;
}

function normalizeLeafPins(node: TerminalPaneNode, pinnedLeafId: string | null): TerminalPaneNode {
  if (node.type === 'leaf') {
    const shouldPin = pinnedLeafId !== null && node.id === pinnedLeafId;
    if (shouldPin) {
      const shouldNormalizeKind = node.kind === 'tui';
      if (node.pinned === true && !shouldNormalizeKind) {
        return node;
      }
      return {
        ...node,
        ...(shouldNormalizeKind ? { kind: 'terminal' as const, tuiOpen: false } : {}),
        pinned: true,
      };
    }
    if (node.pinned === undefined) {
      return node;
    }
    const { pinned: _removed, ...rest } = node;
    return rest;
  }

  const nextFirst = normalizeLeafPins(node.first, pinnedLeafId);
  const nextSecond = normalizeLeafPins(node.second, pinnedLeafId);
  if (nextFirst === node.first && nextSecond === node.second) {
    return node;
  }
  return { ...node, first: nextFirst, second: nextSecond };
}

function resolvePrimaryHostLeafId(tab: TerminalWorkspaceTab): string | null {
  const leaves = listLeafPanes(tab.workspace.root);
  if (leaves.length === 0) {
    return null;
  }
  const existingPinnedNonTui = leaves.find(leaf => leaf.pinned === true && leaf.kind !== 'tui');
  if (existingPinnedNonTui) {
    return existingPinnedNonTui.id;
  }
  const activeLeaf = findLeafPane(tab.workspace.root, tab.workspace.activePaneId);
  if (activeLeaf && activeLeaf.kind !== 'tui') {
    return activeLeaf.id;
  }
  const firstNonTui = leaves.find(leaf => leaf.kind !== 'tui');
  if (firstNonTui) {
    return firstNonTui.id;
  }
  const existingPinned = leaves.find(leaf => leaf.pinned === true);
  return existingPinned?.id ?? activeLeaf?.id ?? leaves[0]?.id ?? null;
}

export function normalizePinnedPrimaryHost(
  state: TerminalTabbedWorkspaceState,
): TerminalTabbedWorkspaceState {
  if (state.tabs.length === 0) {
    return state;
  }

  const existingPinnedTab = state.tabs.find(tab => tab.pinned === true);
  const hostTab =
    existingPinnedTab ?? state.tabs.find(tab => tab.id === state.activeTabId) ?? state.tabs[0]!;
  const hostLeafId = resolvePrimaryHostLeafId(hostTab);

  let changed = false;
  const nextTabs = state.tabs.map(tab => {
    const isHost = tab.id === hostTab.id;
    const nextRoot = normalizeLeafPins(tab.workspace.root, isHost ? hostLeafId : null);
    const rootChanged = nextRoot !== tab.workspace.root;
    const pinChanged = isHost ? tab.pinned !== true : tab.pinned !== undefined;

    if (!rootChanged && !pinChanged) {
      return tab;
    }

    changed = true;
    const nextWorkspace = rootChanged ? { ...tab.workspace, root: nextRoot } : tab.workspace;
    if (isHost) {
      return {
        ...tab,
        pinned: true,
        workspace: nextWorkspace,
      };
    }
    const { pinned: _removed, ...restTab } = tab;
    return {
      ...restTab,
      workspace: nextWorkspace,
    };
  });

  return changed ? { ...state, tabs: nextTabs } : state;
}
