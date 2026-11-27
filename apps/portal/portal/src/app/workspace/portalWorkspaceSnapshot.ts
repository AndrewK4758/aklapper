import { emitStructuredSeamConsoleEvent } from '@aklapper/core';
import {
  createInitialTabbedWorkspaceState,
  exitPaneTui,
  findLeafPane,
  listLeafPanes,
  selectWorkspaceTab,
  type TerminalPaneNode,
  type TerminalTabbedWorkspaceState,
} from '@aklapper/ui';
import {
  normalizePinnedPrimaryHost,
  normalizeWorkspaceRouteKey,
  parseRouteWorkspaceSnapshot,
} from '@aklapper/ui/workspace-storage';

export const PORTAL_WORKSPACE_SNAPSHOT_VERSION = 1 as const;
export const PORTAL_GLOBAL_STORAGE_KEY = 'aklapper.portal.workspace.v1:global';
export const PORTAL_LEGACY_V1_PREFIX = 'aklapper.portal.workspace.v1:';

export const PORTAL_PANE_ROUTES = ['/about', '/agensi', '/chat', '/cadence', '/contact'] as const;
export type PortalPaneRoute = (typeof PORTAL_PANE_ROUTES)[number];
export type PortalPaneViewId = 'tui' | PortalPaneRoute;

export interface PortalPaneViewRef {
  readonly paneId: string;
  readonly routePath: PortalPaneRoute;
}

export function isPortalPaneRoute(pathname: string): pathname is PortalPaneRoute {
  return (PORTAL_PANE_ROUTES as readonly string[]).includes(pathname);
}

const FORBIDDEN_OBJECT_KEYS = new Set<string>(['__proto__', 'constructor', 'prototype']);

export function isForbiddenPortalKey(key: string): boolean {
  return FORBIDDEN_OBJECT_KEYS.has(key);
}

export interface PortalWorkspaceSnapshotV1 {
  readonly version: typeof PORTAL_WORKSPACE_SNAPSHOT_VERSION;
  readonly tabs: TerminalTabbedWorkspaceState;
  readonly paneHistory: Readonly<Record<string, readonly string[]>>;
  readonly lastRouteKey?: string;
}

export function createDefaultPortalWorkspaceSnapshot(
  lastRouteKey?: string,
): PortalWorkspaceSnapshotV1 {
  return {
    version: PORTAL_WORKSPACE_SNAPSHOT_VERSION,
    tabs: createInitialTabbedWorkspaceState({ pinnedPrimary: true }),
    paneHistory: Object.create(null) as Readonly<Record<string, readonly string[]>>,
    ...(lastRouteKey ? { lastRouteKey: normalizeWorkspaceRouteKey(lastRouteKey) } : {}),
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasForbiddenNodeId(node: TerminalPaneNode): boolean {
  if (isForbiddenPortalKey(node.id)) return true;
  if (node.type === 'leaf') return false;
  return hasForbiddenNodeId(node.first) || hasForbiddenNodeId(node.second);
}

function hasForbiddenTreeId(state: TerminalTabbedWorkspaceState): boolean {
  if (isForbiddenPortalKey(state.activeTabId)) return true;
  return state.tabs.some(
    tab => isForbiddenPortalKey(tab.id) || hasForbiddenNodeId(tab.workspace.root),
  );
}

export function parsePortalWorkspaceSnapshot(raw: string): PortalWorkspaceSnapshotV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isPlainRecord(parsed) || parsed['version'] !== PORTAL_WORKSPACE_SNAPSHOT_VERSION) {
    return null;
  }

  let normalizedLastRouteKey: string | undefined;
  const rawLastRouteKey = parsed['lastRouteKey'];
  if (rawLastRouteKey !== undefined) {
    if (typeof rawLastRouteKey !== 'string' || rawLastRouteKey.trim().length === 0) {
      return null;
    }
    normalizedLastRouteKey = normalizeWorkspaceRouteKey(rawLastRouteKey);
  }

  const base = parseRouteWorkspaceSnapshot(raw);
  if (!base || hasForbiddenTreeId(base.tabs)) {
    return null;
  }

  return {
    version: PORTAL_WORKSPACE_SNAPSHOT_VERSION,
    tabs: normalizePinnedPrimaryHost(base.tabs),
    paneHistory: base.paneHistory,
    ...(normalizedLastRouteKey !== undefined ? { lastRouteKey: normalizedLastRouteKey } : {}),
  };
}

export function collectPortalPaneViews(
  state: TerminalTabbedWorkspaceState | null,
): Map<string, PortalPaneViewRef> {
  const result = new Map<string, PortalPaneViewRef>();
  if (!state) return result;
  for (const tab of state.tabs) {
    for (const leaf of listLeafPanes(tab.workspace.root)) {
      for (const viewId of leaf.tuiStack ?? []) {
        if (isPortalPaneRoute(viewId)) {
          result.set(`${leaf.id}:${viewId}`, { paneId: leaf.id, routePath: viewId });
        }
      }
    }
  }
  return result;
}

export function diffPortalPaneViews(
  prevTabs: TerminalTabbedWorkspaceState | null,
  nextTabs: TerminalTabbedWorkspaceState | null,
): {
  readonly added: readonly PortalPaneViewRef[];
  readonly removed: readonly PortalPaneViewRef[];
} {
  const prevMap = collectPortalPaneViews(prevTabs);
  const nextMap = collectPortalPaneViews(nextTabs);
  const removed: PortalPaneViewRef[] = [];
  for (const [key, ref] of prevMap) {
    if (!nextMap.has(key)) removed.push(ref);
  }
  const added: PortalPaneViewRef[] = [];
  for (const [key, ref] of nextMap) {
    if (!prevMap.has(key)) added.push(ref);
  }
  return { added, removed };
}

export function focusAndNormalizePrimaryHost(
  state: TerminalTabbedWorkspaceState,
  clearPrimaryOverlays: boolean,
): TerminalTabbedWorkspaceState {
  const normalized = normalizePinnedPrimaryHost(state);
  const hostTab = normalized.tabs.find(tab => tab.pinned === true) ?? normalized.tabs[0];
  if (!hostTab) return normalized;

  const hostLeaves = listLeafPanes(hostTab.workspace.root);
  const hostLeaf =
    hostLeaves.find(leaf => leaf.pinned === true) ??
    findLeafPane(hostTab.workspace.root, hostTab.workspace.activePaneId) ??
    hostLeaves[0];
  if (!hostLeaf) return normalized;

  let nextState =
    normalized.activeTabId === hostTab.id ? normalized : selectWorkspaceTab(normalized, hostTab.id);

  let tabsChanged = false;
  const nextTabs = nextState.tabs.map(tab => {
    if (tab.id !== hostTab.id) return tab;
    let nextWs = clearPrimaryOverlays ? exitPaneTui(tab.workspace, hostLeaf.id) : tab.workspace;
    const nextZoomed = nextWs.zoomedPaneId === hostLeaf.id ? nextWs.zoomedPaneId : null;
    if (nextWs.activePaneId !== hostLeaf.id || nextWs.zoomedPaneId !== nextZoomed) {
      nextWs = { ...nextWs, activePaneId: hostLeaf.id, zoomedPaneId: nextZoomed };
    }
    if (nextWs === tab.workspace) return tab;
    tabsChanged = true;
    return { ...tab, workspace: nextWs };
  });

  return tabsChanged ? { ...nextState, tabs: nextTabs } : nextState;
}

export type PortalWorkspaceSeamType =
  | 'UNSOUND_CONDITION'
  | 'BOUNDARY_FAULT'
  | 'DELTA_AUDIT_GAP'
  | 'RULE_DIVERGENCE';

export type PortalWorkspaceEventName =
  | 'portal.workspace.ssr_mutation_blocked'
  | 'portal.workspace.snapshot_invalid'
  | 'portal.workspace.write_failed'
  | 'portal.workspace.route_policy_branch';

export type PortalWorkspaceRoutePolicyBranch = 'global-workspace';

export interface PortalWorkspaceEvent {
  readonly event: PortalWorkspaceEventName;
  readonly seamType: PortalWorkspaceSeamType;
  readonly routeKey?: string;
  readonly branch?: PortalWorkspaceRoutePolicyBranch;
  readonly errorName?: string;
}

export function getBrowserSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function extractStorageErrorName(error: unknown): string {
  return error instanceof Error && error.name ? error.name : 'StorageError';
}

export function defaultEmitPortalWorkspaceEvent(event: PortalWorkspaceEvent): void {
  emitStructuredSeamConsoleEvent(event);
}

export function removePortalStorageKeys(storage: Storage, includeGlobal: boolean): boolean {
  const keysToRemove: string[] = [];
  for (let idx = 0; idx < storage.length; idx += 1) {
    const key = storage.key(idx);
    if (
      key &&
      key.startsWith(PORTAL_LEGACY_V1_PREFIX) &&
      (includeGlobal || key !== PORTAL_GLOBAL_STORAGE_KEY)
    ) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    storage.removeItem(key);
  }
  return keysToRemove.length > 0;
}
