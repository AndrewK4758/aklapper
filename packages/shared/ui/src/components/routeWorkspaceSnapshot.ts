import {
  type InitialWorkspaceOptions,
  type SplitDirection,
  type TerminalLeafPane,
  type TerminalPaneKind,
  type TerminalPaneNode,
  type TerminalTabbedWorkspaceState,
  type TerminalWorkspaceState,
  type TerminalWorkspaceTab,
  createInitialTabbedWorkspaceState,
} from './terminalPaneTree';

export const ROUTE_WORKSPACE_SNAPSHOT_VERSION = 1 as const;
export const MAX_TERMINAL_HISTORY_ENTRIES = 100;

const MIN_SNAPSHOT_SPLIT_RATIO = 0.15;
const MAX_SNAPSHOT_SPLIT_RATIO = 0.85;
const MAX_PANE_TREE_DEPTH = 64;

export type WorkspaceStorageNamespace = 'portal' | 'admin';

export interface RouteWorkspaceSnapshotV1 {
  readonly version: typeof ROUTE_WORKSPACE_SNAPSHOT_VERSION;
  readonly tabs: TerminalTabbedWorkspaceState;
  readonly paneHistory: Readonly<Record<string, readonly string[]>>;
}

export function normalizeWorkspaceRouteKey(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed.length > 0 ? trimmed : '/';
}

export function buildRouteWorkspaceStoragePrefix(namespace: WorkspaceStorageNamespace): string {
  return `aklapper.${namespace}.workspace.`;
}

export function buildRouteWorkspaceStorageKey(
  namespace: WorkspaceStorageNamespace,
  routeKey: string,
): string {
  return `aklapper.${namespace}.workspace.v${ROUTE_WORKSPACE_SNAPSHOT_VERSION}:${normalizeWorkspaceRouteKey(routeKey)}`;
}

export function trimCommandHistory(
  history: readonly string[],
  maxEntries = MAX_TERMINAL_HISTORY_ENTRIES,
): readonly string[] {
  if (maxEntries <= 0 || history.length === 0) {
    return [];
  }
  if (history.length <= maxEntries) {
    return [...history];
  }
  return history.slice(0, maxEntries);
}

export function createDefaultRouteWorkspaceSnapshot(
  initialOptions?: InitialWorkspaceOptions,
): RouteWorkspaceSnapshotV1 {
  return {
    version: ROUTE_WORKSPACE_SNAPSHOT_VERSION,
    tabs: createInitialTabbedWorkspaceState(initialOptions),
    paneHistory: {},
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

function isSplitDirection(value: unknown): value is SplitDirection {
  return value === 'vertical' || value === 'horizontal';
}

function isPaneKind(value: unknown): value is TerminalPaneKind {
  return value === 'terminal' || value === 'tui';
}

function validatePaneNode(
  value: unknown,
  seenLeafIds: Set<string>,
  depth: number,
): TerminalPaneNode | null {
  if (depth > MAX_PANE_TREE_DEPTH || !isPlainRecord(value)) {
    return null;
  }

  if (value['type'] === 'leaf') {
    const id = value['id'];
    const ttyNumber = value['ttyNumber'];
    const tuiOpen = value['tuiOpen'];
    const kind = value['kind'];
    const tuiStack = value['tuiStack'];
    const pinned = value['pinned'];

    if (!isNonEmptyString(id) || seenLeafIds.has(id)) {
      return null;
    }
    if (!isPositiveInteger(ttyNumber) || typeof tuiOpen !== 'boolean') {
      return null;
    }
    if (kind !== undefined && !isPaneKind(kind)) {
      return null;
    }
    if (pinned !== undefined && typeof pinned !== 'boolean') {
      return null;
    }

    let sanitizedStack: string[] | undefined;
    if (tuiStack !== undefined) {
      if (!Array.isArray(tuiStack) || !tuiStack.every(isNonEmptyString)) {
        return null;
      }
      sanitizedStack = [...tuiStack];
    }

    seenLeafIds.add(id);
    const leaf: TerminalLeafPane = {
      type: 'leaf',
      id,
      ttyNumber,
      tuiOpen,
      ...(kind !== undefined ? { kind } : {}),
      ...(sanitizedStack !== undefined ? { tuiStack: sanitizedStack } : {}),
      ...(pinned !== undefined ? { pinned } : {}),
    };
    return leaf;
  }

  if (value['type'] === 'split') {
    const id = value['id'];
    const direction = value['direction'];
    const ratio = value['ratio'];

    if (!isNonEmptyString(id) || !isSplitDirection(direction)) {
      return null;
    }
    if (
      typeof ratio !== 'number' ||
      !Number.isFinite(ratio) ||
      ratio < MIN_SNAPSHOT_SPLIT_RATIO ||
      ratio > MAX_SNAPSHOT_SPLIT_RATIO
    ) {
      return null;
    }

    const first = validatePaneNode(value['first'], seenLeafIds, depth + 1);
    if (!first) {
      return null;
    }
    const second = validatePaneNode(value['second'], seenLeafIds, depth + 1);
    if (!second) {
      return null;
    }

    return {
      type: 'split',
      id,
      direction,
      ratio,
      first,
      second,
    };
  }

  return null;
}

function validateWorkspaceState(value: unknown): TerminalWorkspaceState | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const seenLeafIds = new Set<string>();
  const root = validatePaneNode(value['root'], seenLeafIds, 0);
  if (!root || seenLeafIds.size === 0) {
    return null;
  }

  const activePaneId = value['activePaneId'];
  const zoomedPaneId = value['zoomedPaneId'];
  const nextPaneNumber = value['nextPaneNumber'];
  const focusToken = value['focusToken'];

  if (!isNonEmptyString(activePaneId) || !seenLeafIds.has(activePaneId)) {
    return null;
  }
  if (
    zoomedPaneId !== null &&
    (!isNonEmptyString(zoomedPaneId) || !seenLeafIds.has(zoomedPaneId))
  ) {
    return null;
  }
  if (!isPositiveInteger(nextPaneNumber)) {
    return null;
  }
  if (typeof focusToken !== 'number' || !Number.isFinite(focusToken) || focusToken < 0) {
    return null;
  }

  return {
    root,
    activePaneId,
    zoomedPaneId,
    nextPaneNumber,
    focusToken,
  };
}

function validateTab(value: unknown, seenTabIds: Set<string>): TerminalWorkspaceTab | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const id = value['id'];
  const title = value['title'];
  const pinned = value['pinned'];

  if (!isNonEmptyString(id) || seenTabIds.has(id)) {
    return null;
  }
  if (title !== null && typeof title !== 'string') {
    return null;
  }
  if (pinned !== undefined && typeof pinned !== 'boolean') {
    return null;
  }

  const workspace = validateWorkspaceState(value['workspace']);
  if (!workspace) {
    return null;
  }

  seenTabIds.add(id);
  return {
    id,
    title,
    ...(pinned !== undefined ? { pinned } : {}),
    workspace,
  };
}

function validateTabbedState(value: unknown): TerminalTabbedWorkspaceState | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const rawTabs = value['tabs'];
  if (!Array.isArray(rawTabs) || rawTabs.length === 0) {
    return null;
  }

  const seenTabIds = new Set<string>();
  const tabs: TerminalWorkspaceTab[] = [];
  for (const item of rawTabs) {
    const validated = validateTab(item, seenTabIds);
    if (!validated) {
      return null;
    }
    tabs.push(validated);
  }

  const activeTabId = value['activeTabId'];
  if (!isNonEmptyString(activeTabId) || !seenTabIds.has(activeTabId)) {
    return null;
  }

  const rawTabHistory = value['tabHistory'];
  if (!Array.isArray(rawTabHistory) || !rawTabHistory.every(isNonEmptyString)) {
    return null;
  }

  const nextTabNumber = value['nextTabNumber'];
  const nextPaneNumber = value['nextPaneNumber'];
  if (!isPositiveInteger(nextTabNumber) || !isPositiveInteger(nextPaneNumber)) {
    return null;
  }

  return {
    tabs,
    activeTabId,
    tabHistory: rawTabHistory.filter(id => seenTabIds.has(id)),
    nextTabNumber,
    nextPaneNumber,
  };
}

function validatePaneHistory(value: unknown): Readonly<Record<string, readonly string[]>> | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const result: Record<string, readonly string[]> = {};
  for (const [paneId, entries] of Object.entries(value)) {
    if (!isNonEmptyString(paneId) || !Array.isArray(entries)) {
      return null;
    }
    if (!entries.every(item => typeof item === 'string')) {
      return null;
    }
    result[paneId] = trimCommandHistory(entries);
  }

  return result;
}

export function parseRouteWorkspaceSnapshot(raw: string): RouteWorkspaceSnapshotV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isPlainRecord(parsed) || parsed['version'] !== ROUTE_WORKSPACE_SNAPSHOT_VERSION) {
    return null;
  }

  const tabs = validateTabbedState(parsed['tabs']);
  if (!tabs) {
    return null;
  }

  const paneHistory = validatePaneHistory(parsed['paneHistory']);
  if (!paneHistory) {
    return null;
  }

  return {
    version: ROUTE_WORKSPACE_SNAPSHOT_VERSION,
    tabs,
    paneHistory,
  };
}
