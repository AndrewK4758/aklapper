import {
  addWorkspaceTab,
  getActiveWorkspaceTab,
  type InitialWorkspaceOptions,
  openViewInSplit,
  openViewInTab,
  pushPaneView,
  splitActivePane,
  type SplitCreateDirection,
  type TerminalNavTarget,
  type TerminalTabbedWorkspaceState,
  updateActiveTabWorkspace,
} from '@aklapper/ui';
import {
  normalizePinnedPrimaryHost,
  normalizeWorkspaceRouteKey,
  trimCommandHistory,
  type WorkspaceStoreAdapter,
} from '@aklapper/ui/workspace-storage';

import {
  createDefaultPortalWorkspaceSnapshot,
  defaultEmitPortalWorkspaceEvent,
  diffPortalPaneViews,
  extractStorageErrorName,
  focusAndNormalizePrimaryHost,
  getBrowserSessionStorage,
  isForbiddenPortalKey,
  parsePortalWorkspaceSnapshot,
  PORTAL_GLOBAL_STORAGE_KEY,
  type PortalPaneViewRef,
  type PortalWorkspaceEvent,
  type PortalWorkspaceEventName,
  type PortalWorkspaceRoutePolicyBranch,
  type PortalWorkspaceSeamType,
  type PortalWorkspaceSnapshotV1,
  removePortalStorageKeys,
} from './portalWorkspaceSnapshot';

export type {
  PortalPaneViewRef,
  PortalWorkspaceEvent,
  PortalWorkspaceEventName,
  PortalWorkspaceRoutePolicyBranch,
  PortalWorkspaceSeamType,
};

export interface CreatePortalWorkspaceStoreOptions {
  readonly onEvent?: (event: PortalWorkspaceEvent) => void;
}

export interface ClearPortalWorkspaceOptions {
  readonly silent?: boolean;
}

export interface OpenPortalPaneOptions {
  readonly splitDirection?: SplitCreateDirection;
  readonly pathname?: string;
}

export interface PortalWorkspaceStore extends WorkspaceStoreAdapter {
  getServerSnapshot: (
    routeKey: string,
    initialOptions?: InitialWorkspaceOptions,
  ) => PortalWorkspaceSnapshotV1;
  getClientSnapshot: (
    routeKey: string,
    initialOptions?: InitialWorkspaceOptions,
  ) => PortalWorkspaceSnapshotV1;
  syncRoute: (pathname: string) => void;
  openPane: (viewId: string, target: TerminalNavTarget, options?: OpenPortalPaneOptions) => string;
  openTerminal: (
    target: 'split' | 'tab',
    splitDirection?: SplitCreateDirection,
    pathname?: string,
  ) => void;
  focusPrimaryHostTab: (pathname?: string) => void;
  onPaneViewsAdded: (listener: (views: readonly PortalPaneViewRef[]) => void) => () => void;
  onPaneViewsRemoved: (listener: (views: readonly PortalPaneViewRef[]) => void) => () => void;
  recordRoutePolicy: (pathname: string, branch: PortalWorkspaceRoutePolicyBranch) => void;
  clearAll: (options?: ClearPortalWorkspaceOptions) => void;
  resetForTest: () => void;
}

const DEFAULT_SERVER_SNAPSHOT: PortalWorkspaceSnapshotV1 = createDefaultPortalWorkspaceSnapshot();

export function createPortalWorkspaceStore(
  options: CreatePortalWorkspaceStoreOptions = {},
): PortalWorkspaceStore {
  const { onEvent = defaultEmitPortalWorkspaceEvent } = options;
  let snapshot: PortalWorkspaceSnapshotV1 | null = null;
  const listeners = new Set<() => void>();
  const addedListeners = new Set<(views: readonly PortalPaneViewRef[]) => void>();
  const removedListeners = new Set<(views: readonly PortalPaneViewRef[]) => void>();
  const emittedFailureKeys = new Set<string>();
  let lastPolicyEventKey: string | null = null;
  let cleanedLegacyKeys = false;

  const emitOnce = (dedupKey: string, event: PortalWorkspaceEvent): void => {
    if (emittedFailureKeys.has(dedupKey)) return;
    emittedFailureKeys.add(dedupKey);
    onEvent(event);
  };

  const notifySubscribers = (): void => {
    for (const listener of Array.from(listeners)) listener();
  };

  const emitDiffs = (
    prevTabs: TerminalTabbedWorkspaceState | null,
    nextTabs: TerminalTabbedWorkspaceState | null,
  ): void => {
    const { added, removed } = diffPortalPaneViews(prevTabs, nextTabs);
    if (removed.length > 0) {
      for (const listener of Array.from(removedListeners)) listener(removed);
    }
    if (added.length > 0) {
      for (const listener of Array.from(addedListeners)) listener(added);
    }
  };

  const persistSnapshot = (nextSnapshot: PortalWorkspaceSnapshotV1): void => {
    const storage = getBrowserSessionStorage();
    if (!storage) {
      emitOnce('write:unavailable', {
        event: 'portal.workspace.write_failed',
        seamType: 'DELTA_AUDIT_GAP',
        errorName: 'StorageUnavailable',
      });
      return;
    }
    try {
      storage.setItem(PORTAL_GLOBAL_STORAGE_KEY, JSON.stringify(nextSnapshot));
      if (!cleanedLegacyKeys) {
        cleanedLegacyKeys = true;
        try {
          removePortalStorageKeys(storage, false);
        } catch (cleanupError) {
          const errorName = extractStorageErrorName(cleanupError);
          emitOnce(`legacy-cleanup:${errorName}`, {
            event: 'portal.workspace.write_failed',
            seamType: 'DELTA_AUDIT_GAP',
            errorName,
          });
        }
      }
    } catch (error) {
      const errorName = extractStorageErrorName(error);
      emitOnce(`write:${errorName}`, {
        event: 'portal.workspace.write_failed',
        seamType: 'DELTA_AUDIT_GAP',
        errorName,
      });
    }
  };

  const ensureClientSnapshot = (pathname: string): PortalWorkspaceSnapshotV1 => {
    if (snapshot !== null) return snapshot;
    const normalizedPath = normalizeWorkspaceRouteKey(pathname);
    const storage = getBrowserSessionStorage();
    if (storage) {
      try {
        const raw = storage.getItem(PORTAL_GLOBAL_STORAGE_KEY);
        if (raw !== null) {
          const parsed = parsePortalWorkspaceSnapshot(raw);
          if (parsed) {
            snapshot =
              parsed.lastRouteKey && parsed.lastRouteKey !== normalizedPath
                ? {
                    ...parsed,
                    tabs: focusAndNormalizePrimaryHost(parsed.tabs, true),
                    lastRouteKey: normalizedPath,
                  }
                : parsed;
            return snapshot;
          }
          emitOnce('invalid:global', {
            event: 'portal.workspace.snapshot_invalid',
            seamType: 'BOUNDARY_FAULT',
            routeKey: normalizedPath,
          });
          try {
            storage.removeItem(PORTAL_GLOBAL_STORAGE_KEY);
          } catch (removeError) {
            emitOnce(`remove:${extractStorageErrorName(removeError)}`, {
              event: 'portal.workspace.write_failed',
              seamType: 'DELTA_AUDIT_GAP',
              routeKey: normalizedPath,
              errorName: extractStorageErrorName(removeError),
            });
          }
        }
      } catch (readError) {
        emitOnce(`read:${extractStorageErrorName(readError)}`, {
          event: 'portal.workspace.snapshot_invalid',
          seamType: 'BOUNDARY_FAULT',
          routeKey: normalizedPath,
          errorName: extractStorageErrorName(readError),
        });
      }
    }
    snapshot = createDefaultPortalWorkspaceSnapshot(normalizedPath);
    return snapshot;
  };

  const commitTabs = (
    current: PortalWorkspaceSnapshotV1,
    nextTabs: TerminalTabbedWorkspaceState,
    lastRouteKey: string | undefined,
  ): void => {
    const normalizedTabs = normalizePinnedPrimaryHost(nextTabs);
    if (normalizedTabs === current.tabs && lastRouteKey === current.lastRouteKey) return;
    const nextSnapshot: PortalWorkspaceSnapshotV1 = {
      ...current,
      tabs: normalizedTabs,
      ...(lastRouteKey !== undefined ? { lastRouteKey } : {}),
    };
    snapshot = nextSnapshot;
    emitDiffs(current.tabs, normalizedTabs);
    persistSnapshot(nextSnapshot);
    notifySubscribers();
  };

  const guardServerMutation = (routeKey?: string): boolean => {
    if (typeof window !== 'undefined') return false;
    onEvent({
      event: 'portal.workspace.ssr_mutation_blocked',
      seamType: 'UNSOUND_CONDITION',
      ...(routeKey ? { routeKey: normalizeWorkspaceRouteKey(routeKey) } : {}),
    });
    return true;
  };

  return {
    getServerSnapshot: () => DEFAULT_SERVER_SNAPSHOT,
    getClientSnapshot: routeKey =>
      typeof window === 'undefined' ? DEFAULT_SERVER_SNAPSHOT : ensureClientSnapshot(routeKey),
    subscribe: (_routeKey, listener) => {
      if (typeof window === 'undefined') return () => undefined;
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    updateTabs: (routeKey, _initialOptions, updater) => {
      if (guardServerMutation(routeKey)) return;
      const normalizedKey = normalizeWorkspaceRouteKey(routeKey);
      const current = ensureClientSnapshot(normalizedKey);
      commitTabs(current, updater(current.tabs), current.lastRouteKey ?? normalizedKey);
    },
    setPaneHistory: (routeKey, _initialOptions, paneId, history) => {
      if (guardServerMutation(routeKey) || !paneId || isForbiddenPortalKey(paneId)) return;
      const normalizedKey = normalizeWorkspaceRouteKey(routeKey);
      const current = ensureClientSnapshot(normalizedKey);
      const trimmed = trimCommandHistory(history);
      const prevList = Object.hasOwn(current.paneHistory, paneId)
        ? current.paneHistory[paneId]
        : undefined;
      if (prevList?.length === trimmed.length && prevList.every((v, i) => v === trimmed[i])) {
        return;
      }
      const nextPaneHistory = Object.assign(
        Object.create(null) as Record<string, readonly string[]>,
        current.paneHistory,
        { [paneId]: trimmed },
      );
      const nextSnapshot: PortalWorkspaceSnapshotV1 = {
        ...current,
        paneHistory: nextPaneHistory,
        lastRouteKey: current.lastRouteKey ?? normalizedKey,
      };
      snapshot = nextSnapshot;
      persistSnapshot(nextSnapshot);
      notifySubscribers();
    },
    syncRoute: pathname => {
      if (guardServerMutation(pathname)) return;
      const normalizedPath = normalizeWorkspaceRouteKey(pathname);
      const current = ensureClientSnapshot(normalizedPath);
      commitTabs(current, focusAndNormalizePrimaryHost(current.tabs, true), normalizedPath);
    },
    openPane: (viewId, target, openOptions) => {
      if (guardServerMutation(openOptions?.pathname)) return '';
      const routeKey = normalizeWorkspaceRouteKey(openOptions?.pathname ?? '/');
      const current = ensureClientSnapshot(routeKey);
      const splitDirection = openOptions?.splitDirection ?? 'right';
      const nextTabs =
        target === 'tab'
          ? openViewInTab(current.tabs, viewId)
          : target === 'split'
            ? updateActiveTabWorkspace(current.tabs, ws =>
                openViewInSplit(ws, ws.activePaneId, viewId, splitDirection),
              )
            : updateActiveTabWorkspace(current.tabs, ws =>
                pushPaneView(ws, ws.activePaneId, viewId),
              );
      commitTabs(current, nextTabs, current.lastRouteKey ?? routeKey);
      return getActiveWorkspaceTab(snapshot?.tabs ?? nextTabs).workspace.activePaneId;
    },
    openTerminal: (target, splitDirection = 'right', pathname = '/') => {
      if (guardServerMutation(pathname)) return;
      const normalizedPath = normalizeWorkspaceRouteKey(pathname);
      const current = ensureClientSnapshot(normalizedPath);
      const nextTabs =
        target === 'tab'
          ? addWorkspaceTab(current.tabs)
          : updateActiveTabWorkspace(current.tabs, ws => splitActivePane(ws, splitDirection));
      commitTabs(current, nextTabs, current.lastRouteKey ?? normalizedPath);
    },
    focusPrimaryHostTab: (pathname = '/') => {
      if (guardServerMutation(pathname)) return;
      const normalizedPath = normalizeWorkspaceRouteKey(pathname);
      const current = ensureClientSnapshot(normalizedPath);
      commitTabs(
        current,
        focusAndNormalizePrimaryHost(current.tabs, false),
        current.lastRouteKey ?? normalizedPath,
      );
    },
    onPaneViewsAdded: listener => {
      if (typeof window === 'undefined') return () => undefined;
      addedListeners.add(listener);
      return () => {
        addedListeners.delete(listener);
      };
    },
    onPaneViewsRemoved: listener => {
      if (typeof window === 'undefined') return () => undefined;
      removedListeners.add(listener);
      return () => {
        removedListeners.delete(listener);
      };
    },
    recordRoutePolicy: (pathname, branch) => {
      if (typeof window === 'undefined') return;
      const normalizedKey = normalizeWorkspaceRouteKey(pathname);
      const dedupKey = `${branch}:${normalizedKey}`;
      if (lastPolicyEventKey === dedupKey) return;
      lastPolicyEventKey = dedupKey;
      onEvent({
        event: 'portal.workspace.route_policy_branch',
        seamType: 'RULE_DIVERGENCE',
        routeKey: normalizedKey,
        branch,
      });
    },
    clearAll: clearOptions => {
      if (guardServerMutation()) return;
      const prevTabs = snapshot?.tabs ?? null;
      let removedKeys = false;
      const storage = getBrowserSessionStorage();
      if (storage) {
        try {
          removedKeys = removePortalStorageKeys(storage, true);
        } catch (error) {
          const errorName = extractStorageErrorName(error);
          emitOnce(`clear:${errorName}`, {
            event: 'portal.workspace.write_failed',
            seamType: 'DELTA_AUDIT_GAP',
            errorName,
          });
        }
      }
      if (prevTabs === null && !removedKeys) return;
      snapshot = null;
      cleanedLegacyKeys = false;
      emitDiffs(prevTabs, null);
      if (!clearOptions?.silent) notifySubscribers();
    },
    resetForTest: () => {
      snapshot = null;
      listeners.clear();
      addedListeners.clear();
      removedListeners.clear();
      emittedFailureKeys.clear();
      lastPolicyEventKey = null;
      cleanedLegacyKeys = false;
    },
  };
}

export const portalWorkspaceStore: PortalWorkspaceStore = createPortalWorkspaceStore();
