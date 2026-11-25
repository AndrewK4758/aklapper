import { useCallback, useMemo, useSyncExternalStore } from 'react';

import {
  buildRouteWorkspaceStorageKey,
  buildRouteWorkspaceStoragePrefix,
  createDefaultRouteWorkspaceSnapshot,
  normalizeWorkspaceRouteKey,
  parseRouteWorkspaceSnapshot,
  trimCommandHistory,
  type RouteWorkspaceSnapshotV1,
  type WorkspaceStorageNamespace,
} from './routeWorkspaceSnapshot';
import type { InitialWorkspaceOptions, TerminalTabbedWorkspaceState } from './terminalPaneTree';

export type WorkspaceStorageSeamType =
  | 'UNSOUND_CONDITION'
  | 'BOUNDARY_FAULT'
  | 'DELTA_AUDIT_GAP'
  | 'RULE_DIVERGENCE';

export type WorkspaceStorageEventName =
  | 'ui.workspace_storage.ssr_mutation_blocked'
  | 'ui.workspace_storage.snapshot_invalid'
  | 'ui.workspace_storage.write_failed'
  | 'ui.workspace_storage.route_policy_branch';

export type WorkspaceRoutePolicyBranch =
  | 'cached-workspace'
  | 'excluded-maintenance'
  | 'admin-cleared';

export interface WorkspaceStorageEvent {
  readonly event: WorkspaceStorageEventName;
  readonly seamType: WorkspaceStorageSeamType;
  readonly namespace: WorkspaceStorageNamespace;
  readonly routeKey?: string;
  readonly branch?: WorkspaceRoutePolicyBranch;
  readonly errorName?: string;
}

export interface CreateRouteWorkspaceStoreOptions {
  readonly namespace: WorkspaceStorageNamespace;
  readonly onStorageEvent?: (event: WorkspaceStorageEvent) => void;
}

export interface ClearRouteWorkspaceOptions {
  readonly silent?: boolean;
}

export interface RouteWorkspaceStore {
  readonly namespace: WorkspaceStorageNamespace;
  getServerSnapshot: (
    routeKey: string,
    initialOptions?: InitialWorkspaceOptions,
  ) => RouteWorkspaceSnapshotV1;
  getClientSnapshot: (
    routeKey: string,
    initialOptions?: InitialWorkspaceOptions,
  ) => RouteWorkspaceSnapshotV1;
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
  clearAll: (options?: ClearRouteWorkspaceOptions) => void;
  recordRoutePolicy: (routeKey: string, branch: WorkspaceRoutePolicyBranch) => void;
  resetForTest: () => void;
}

function getBrowserSessionStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function extractErrorName(error: unknown): string {
  if (error instanceof Error && error.name) {
    return error.name;
  }
  return 'StorageError';
}

function defaultEmitStorageEvent(event: WorkspaceStorageEvent): void {
  if (typeof console === 'undefined') {
    return;
  }
  const serialized = JSON.stringify(event);
  if (event.seamType === 'UNSOUND_CONDITION') {
    console.error(serialized);
  } else if (event.seamType === 'BOUNDARY_FAULT' || event.seamType === 'DELTA_AUDIT_GAP') {
    console.warn(serialized);
  } else {
    console.info(serialized);
  }
}

export function createRouteWorkspaceStore(
  options: CreateRouteWorkspaceStoreOptions,
): RouteWorkspaceStore {
  const { namespace, onStorageEvent = defaultEmitStorageEvent } = options;
  const storagePrefix = buildRouteWorkspaceStoragePrefix(namespace);

  // Client-only state; never read or mutated when typeof window === 'undefined'.
  const snapshots = new Map<string, RouteWorkspaceSnapshotV1>();
  const listenersByRoute = new Map<string, Set<() => void>>();
  const emittedFailureKeys = new Set<string>();
  let lastPolicyEventKey: string | null = null;

  const emitOncePerFailure = (dedupKey: string, event: WorkspaceStorageEvent): void => {
    if (emittedFailureKeys.has(dedupKey)) {
      return;
    }
    emittedFailureKeys.add(dedupKey);
    onStorageEvent(event);
  };

  const notifyRoute = (normalizedKey: string): void => {
    const routeListeners = listenersByRoute.get(normalizedKey);
    if (!routeListeners || routeListeners.size === 0) {
      return;
    }
    for (const listener of Array.from(routeListeners)) {
      listener();
    }
  };

  const notifyAll = (): void => {
    for (const routeKey of Array.from(listenersByRoute.keys())) {
      notifyRoute(routeKey);
    }
  };

  const persistSnapshot = (normalizedKey: string, snapshot: RouteWorkspaceSnapshotV1): void => {
    const storage = getBrowserSessionStorage();
    if (!storage) {
      emitOncePerFailure(`write:${normalizedKey}:unavailable`, {
        event: 'ui.workspace_storage.write_failed',
        seamType: 'DELTA_AUDIT_GAP',
        namespace,
        routeKey: normalizedKey,
        errorName: 'StorageUnavailable',
      });
      return;
    }

    const storageKey = buildRouteWorkspaceStorageKey(namespace, normalizedKey);
    try {
      storage.setItem(storageKey, JSON.stringify(snapshot));
    } catch (error) {
      const errorName = extractErrorName(error);
      emitOncePerFailure(`write:${normalizedKey}:${errorName}`, {
        event: 'ui.workspace_storage.write_failed',
        seamType: 'DELTA_AUDIT_GAP',
        namespace,
        routeKey: normalizedKey,
        errorName,
      });
    }
  };

  const ensureClientSnapshot = (
    normalizedKey: string,
    initialOptions?: InitialWorkspaceOptions,
  ): RouteWorkspaceSnapshotV1 => {
    const existing = snapshots.get(normalizedKey);
    if (existing) {
      return existing;
    }

    const storage = getBrowserSessionStorage();
    const storageKey = buildRouteWorkspaceStorageKey(namespace, normalizedKey);
    if (storage) {
      try {
        const raw = storage.getItem(storageKey);
        if (raw !== null) {
          const parsed = parseRouteWorkspaceSnapshot(raw);
          if (parsed) {
            snapshots.set(normalizedKey, parsed);
            return parsed;
          }
          emitOncePerFailure(`invalid:${normalizedKey}`, {
            event: 'ui.workspace_storage.snapshot_invalid',
            seamType: 'BOUNDARY_FAULT',
            namespace,
            routeKey: normalizedKey,
          });
          try {
            storage.removeItem(storageKey);
          } catch (removeError) {
            emitOncePerFailure(`remove:${normalizedKey}:${extractErrorName(removeError)}`, {
              event: 'ui.workspace_storage.write_failed',
              seamType: 'DELTA_AUDIT_GAP',
              namespace,
              routeKey: normalizedKey,
              errorName: extractErrorName(removeError),
            });
          }
        }
      } catch (readError) {
        emitOncePerFailure(`read:${normalizedKey}:${extractErrorName(readError)}`, {
          event: 'ui.workspace_storage.snapshot_invalid',
          seamType: 'BOUNDARY_FAULT',
          namespace,
          routeKey: normalizedKey,
          errorName: extractErrorName(readError),
        });
      }
    }

    const fallback = createDefaultRouteWorkspaceSnapshot(initialOptions);
    snapshots.set(normalizedKey, fallback);
    return fallback;
  };

  const getServerSnapshot = (
    _routeKey: string,
    initialOptions?: InitialWorkspaceOptions,
  ): RouteWorkspaceSnapshotV1 => {
    return createDefaultRouteWorkspaceSnapshot(initialOptions);
  };

  const getClientSnapshot = (
    routeKey: string,
    initialOptions?: InitialWorkspaceOptions,
  ): RouteWorkspaceSnapshotV1 => {
    const normalizedKey = normalizeWorkspaceRouteKey(routeKey);
    if (typeof window === 'undefined') {
      return createDefaultRouteWorkspaceSnapshot(initialOptions);
    }
    return ensureClientSnapshot(normalizedKey, initialOptions);
  };

  const subscribe = (routeKey: string, listener: () => void): (() => void) => {
    if (typeof window === 'undefined') {
      return () => undefined;
    }
    const normalizedKey = normalizeWorkspaceRouteKey(routeKey);
    let routeListeners = listenersByRoute.get(normalizedKey);
    if (!routeListeners) {
      routeListeners = new Set();
      listenersByRoute.set(normalizedKey, routeListeners);
    }
    routeListeners.add(listener);
    return () => {
      routeListeners?.delete(listener);
      if (routeListeners && routeListeners.size === 0) {
        listenersByRoute.delete(normalizedKey);
      }
    };
  };

  const updateTabs = (
    routeKey: string,
    initialOptions: InitialWorkspaceOptions | undefined,
    updater: (prev: TerminalTabbedWorkspaceState) => TerminalTabbedWorkspaceState,
  ): void => {
    const normalizedKey = normalizeWorkspaceRouteKey(routeKey);
    if (typeof window === 'undefined') {
      onStorageEvent({
        event: 'ui.workspace_storage.ssr_mutation_blocked',
        seamType: 'UNSOUND_CONDITION',
        namespace,
        routeKey: normalizedKey,
      });
      return;
    }
    const current = ensureClientSnapshot(normalizedKey, initialOptions);
    const nextTabs = updater(current.tabs);
    if (nextTabs === current.tabs) {
      return;
    }
    const nextSnapshot: RouteWorkspaceSnapshotV1 = {
      ...current,
      tabs: nextTabs,
    };
    snapshots.set(normalizedKey, nextSnapshot);
    persistSnapshot(normalizedKey, nextSnapshot);
    notifyRoute(normalizedKey);
  };

  const setPaneHistory = (
    routeKey: string,
    initialOptions: InitialWorkspaceOptions | undefined,
    paneId: string,
    history: readonly string[],
  ): void => {
    const normalizedKey = normalizeWorkspaceRouteKey(routeKey);
    if (typeof window === 'undefined') {
      onStorageEvent({
        event: 'ui.workspace_storage.ssr_mutation_blocked',
        seamType: 'UNSOUND_CONDITION',
        namespace,
        routeKey: normalizedKey,
      });
      return;
    }
    const current = ensureClientSnapshot(normalizedKey, initialOptions);
    const trimmed = trimCommandHistory(history);
    const prevList = current.paneHistory[paneId];
    if (
      prevList &&
      prevList.length === trimmed.length &&
      prevList.every((entry, idx) => entry === trimmed[idx])
    ) {
      return;
    }
    const nextSnapshot: RouteWorkspaceSnapshotV1 = {
      ...current,
      paneHistory: {
        ...current.paneHistory,
        [paneId]: trimmed,
      },
    };
    snapshots.set(normalizedKey, nextSnapshot);
    persistSnapshot(normalizedKey, nextSnapshot);
    notifyRoute(normalizedKey);
  };

  const clearAll = (clearOptions?: ClearRouteWorkspaceOptions): void => {
    if (typeof window === 'undefined') {
      onStorageEvent({
        event: 'ui.workspace_storage.ssr_mutation_blocked',
        seamType: 'UNSOUND_CONDITION',
        namespace,
      });
      return;
    }

    const hadMemory = snapshots.size > 0;
    let removedStorageKeys = false;
    const storage = getBrowserSessionStorage();
    if (storage) {
      try {
        const keysToRemove: string[] = [];
        for (let idx = 0; idx < storage.length; idx += 1) {
          const key = storage.key(idx);
          if (key && key.startsWith(storagePrefix)) {
            keysToRemove.push(key);
          }
        }
        for (const key of keysToRemove) {
          storage.removeItem(key);
          removedStorageKeys = true;
        }
      } catch (error) {
        const errorName = extractErrorName(error);
        emitOncePerFailure(`clear:${errorName}`, {
          event: 'ui.workspace_storage.write_failed',
          seamType: 'DELTA_AUDIT_GAP',
          namespace,
          errorName,
        });
      }
    }

    if (!hadMemory && !removedStorageKeys) {
      return;
    }

    snapshots.clear();
    if (!clearOptions?.silent) {
      notifyAll();
    }
  };

  const recordRoutePolicy = (routeKey: string, branch: WorkspaceRoutePolicyBranch): void => {
    if (typeof window === 'undefined') {
      return;
    }
    const normalizedKey = normalizeWorkspaceRouteKey(routeKey);
    const dedupKey = `${branch}:${normalizedKey}`;
    if (lastPolicyEventKey === dedupKey) {
      return;
    }
    lastPolicyEventKey = dedupKey;
    onStorageEvent({
      event: 'ui.workspace_storage.route_policy_branch',
      seamType: 'RULE_DIVERGENCE',
      namespace,
      routeKey: normalizedKey,
      branch,
    });
  };

  const resetForTest = (): void => {
    snapshots.clear();
    listenersByRoute.clear();
    emittedFailureKeys.clear();
    lastPolicyEventKey = null;
  };

  return {
    namespace,
    getServerSnapshot,
    getClientSnapshot,
    subscribe,
    updateTabs,
    setPaneHistory,
    clearAll,
    recordRoutePolicy,
    resetForTest,
  };
}

export function useRouteWorkspaceState(
  store: RouteWorkspaceStore,
  routeKey: string,
  initialOptions?: InitialWorkspaceOptions,
): RouteWorkspaceSnapshotV1 {
  const normalizedKey = normalizeWorkspaceRouteKey(routeKey);
  const pinnedPrimary = initialOptions?.pinnedPrimary;
  const initialStackKey = initialOptions?.initialPrimaryTuiStack?.join('\0') ?? '';

  const stableInitialOptions = useMemo<InitialWorkspaceOptions | undefined>(() => {
    if (pinnedPrimary === undefined && initialStackKey.length === 0) {
      return undefined;
    }
    return {
      ...(pinnedPrimary !== undefined ? { pinnedPrimary } : {}),
      ...(initialStackKey.length > 0
        ? { initialPrimaryTuiStack: initialStackKey.split('\0') }
        : {}),
    };
  }, [initialStackKey, pinnedPrimary]);

  const serverSnapshot = useMemo(
    () => store.getServerSnapshot(normalizedKey, stableInitialOptions),
    [normalizedKey, stableInitialOptions, store],
  );

  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribe(normalizedKey, onStoreChange),
    [normalizedKey, store],
  );

  const getClientSnapshot = useCallback(
    () => store.getClientSnapshot(normalizedKey, stableInitialOptions),
    [normalizedKey, stableInitialOptions, store],
  );

  const getServerSnapshot = useCallback(() => serverSnapshot, [serverSnapshot]);

  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
