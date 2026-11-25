import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addWorkspaceTab,
  createInitialTabbedWorkspaceState,
  listLeafPanes,
  renameWorkspaceTab,
  setSplitRatio,
  splitActivePane,
  type TerminalTabbedWorkspaceState,
  updateActiveTabWorkspace,
} from '../src/components/terminalPaneTree';
import {
  buildRouteWorkspaceStorageKey,
  createRouteWorkspaceStore,
  MAX_TERMINAL_HISTORY_ENTRIES,
  normalizePinnedPrimaryHost,
  normalizeWorkspaceRouteKey,
  parseRouteWorkspaceSnapshot,
  ROUTE_WORKSPACE_SNAPSHOT_VERSION,
  trimCommandHistory,
  type RouteWorkspaceSnapshotV1,
  type WorkspaceStorageEvent,
} from '../src/workspace-storage';

describe('routeWorkspaceSnapshot', () => {
  it('normalizes trailing slashes and builds namespaced storage keys', () => {
    expect(normalizeWorkspaceRouteKey('/')).toBe('/');
    expect(normalizeWorkspaceRouteKey('')).toBe('/');
    expect(normalizeWorkspaceRouteKey('///')).toBe('/');
    expect(normalizeWorkspaceRouteKey('/cadence/')).toBe('/cadence');
    expect(normalizeWorkspaceRouteKey('/agensi///')).toBe('/agensi');

    expect(buildRouteWorkspaceStorageKey('portal', '/')).toBe('aklapper.portal.workspace.v1:/');
    expect(buildRouteWorkspaceStorageKey('portal', '/cadence/')).toBe(
      'aklapper.portal.workspace.v1:/cadence',
    );
    expect(buildRouteWorkspaceStorageKey('admin', '/analytics/')).toBe(
      'aklapper.admin.workspace.v1:/analytics',
    );
  });

  it('parses a valid v1 snapshot with tabs, split ratio, custom title, tuiStack, and paneHistory', () => {
    let tabs = createInitialTabbedWorkspaceState({
      pinnedPrimary: true,
      initialPrimaryTuiStack: ['/agensi'],
    });
    tabs = addWorkspaceTab(tabs);
    tabs = renameWorkspaceTab(tabs, tabs.activeTabId, 'ops');
    tabs = updateActiveTabWorkspace(tabs, ws => {
      const split = splitActivePane(ws, 'right');
      return split.root.type === 'split' ? setSplitRatio(split, split.root.id, 0.65) : split;
    });

    const snapshot: RouteWorkspaceSnapshotV1 = {
      version: ROUTE_WORKSPACE_SNAPSHOT_VERSION,
      tabs,
      paneHistory: {
        'pane-1': ['status', 'help'],
      },
    };

    const parsed = parseRouteWorkspaceSnapshot(JSON.stringify(snapshot));
    expect(parsed).not.toBeNull();
    expect(parsed?.version).toBe(1);
    expect(parsed?.tabs.tabs).toHaveLength(2);
    expect(parsed?.tabs.tabs[1]?.title).toBe('ops');
    const activeTab = parsed?.tabs.tabs.find(t => t.id === parsed.tabs.activeTabId);
    expect(activeTab?.workspace.root.type).toBe('split');
    const splitRatio =
      activeTab?.workspace.root.type === 'split' ? activeTab.workspace.root.ratio : null;
    expect(splitRatio).toBeCloseTo(0.65, 5);
    expect(parsed?.paneHistory['pane-1']).toEqual(['status', 'help']);
  });

  it('caps paneHistory at 100 entries on trim and during snapshot parse', () => {
    const rawHistory = Array.from({ length: 115 }, (_, idx) => `cmd-${idx + 1}`);
    const trimmed = trimCommandHistory(rawHistory);
    expect(trimmed).toHaveLength(MAX_TERMINAL_HISTORY_ENTRIES);
    expect(trimmed[0]).toBe('cmd-1');
    expect(trimmed[99]).toBe('cmd-100');

    const tabs = createInitialTabbedWorkspaceState({ pinnedPrimary: true });
    const parsed = parseRouteWorkspaceSnapshot(
      JSON.stringify({
        version: 1,
        tabs,
        paneHistory: {
          'pane-1': rawHistory,
        },
      }),
    );
    expect(parsed?.paneHistory['pane-1']).toHaveLength(100);
    expect(parsed?.paneHistory['pane-1']?.[0]).toBe('cmd-1');
  });

  it('returns null for malformed JSON, unsupported version, empty tabs, invalid activeTabId, or out-of-range ratios', () => {
    expect(parseRouteWorkspaceSnapshot('{truncated-json')).toBeNull();
    expect(parseRouteWorkspaceSnapshot('null')).toBeNull();

    const baseTabs = createInitialTabbedWorkspaceState({ pinnedPrimary: true });
    expect(
      parseRouteWorkspaceSnapshot(JSON.stringify({ version: 99, tabs: baseTabs, paneHistory: {} })),
    ).toBeNull();

    expect(
      parseRouteWorkspaceSnapshot(
        JSON.stringify({
          version: 1,
          tabs: { ...baseTabs, tabs: [] },
          paneHistory: {},
        }),
      ),
    ).toBeNull();

    expect(
      parseRouteWorkspaceSnapshot(
        JSON.stringify({
          version: 1,
          tabs: { ...baseTabs, activeTabId: 'missing-tab' },
          paneHistory: {},
        }),
      ),
    ).toBeNull();

    const splitTabs = updateActiveTabWorkspace(baseTabs, ws => splitActivePane(ws, 'right'));
    const badRatioRoot =
      splitTabs.tabs[0]?.workspace.root.type === 'split'
        ? { ...splitTabs.tabs[0].workspace.root, ratio: 0.99 }
        : splitTabs.tabs[0]?.workspace.root;
    expect(
      parseRouteWorkspaceSnapshot(
        JSON.stringify({
          version: 1,
          tabs: {
            ...splitTabs,
            tabs: [
              {
                ...splitTabs.tabs[0],
                workspace: { ...splitTabs.tabs[0]?.workspace, root: badRatioRoot },
              },
            ],
          },
          paneHistory: {},
        }),
      ),
    ).toBeNull();
  });

  it('rejects forbidden prototype keys in paneHistory during snapshot parse', () => {
    const baseTabs = createInitialTabbedWorkspaceState({ pinnedPrimary: true });
    const tabsJson = JSON.stringify(baseTabs);

    expect(
      parseRouteWorkspaceSnapshot(
        `{"version":1,"tabs":${tabsJson},"paneHistory":{"__proto__":["evil"]}}`,
      ),
    ).toBeNull();
    expect(
      parseRouteWorkspaceSnapshot(
        `{"version":1,"tabs":${tabsJson},"paneHistory":{"constructor":["evil"]}}`,
      ),
    ).toBeNull();
    expect(
      parseRouteWorkspaceSnapshot(
        `{"version":1,"tabs":${tabsJson},"paneHistory":{"prototype":["evil"]}}`,
      ),
    ).toBeNull();
  });
});

describe('createRouteWorkspaceStore', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it('persists tabs and paneHistory to sessionStorage and hydrates them on a fresh store instance', () => {
    const storeA = createRouteWorkspaceStore({ namespace: 'portal' });
    const initialOptions = { pinnedPrimary: true };

    storeA.updateTabs('/', initialOptions, prev => {
      const added = addWorkspaceTab(prev);
      return renameWorkspaceTab(added, added.activeTabId, 'ops');
    });
    storeA.setPaneHistory('/', initialOptions, 'pane-1', ['status', 'help']);

    const raw = window.sessionStorage.getItem('aklapper.portal.workspace.v1:/');
    expect(raw).not.toBeNull();

    // Simulate hard reload with a fresh store instance reading the same sessionStorage
    const storeB = createRouteWorkspaceStore({ namespace: 'portal' });
    const restored = storeB.getClientSnapshot('/', initialOptions);
    expect(restored.tabs.tabs).toHaveLength(2);
    expect(restored.tabs.tabs[1]?.title).toBe('ops');
    expect(restored.paneHistory['pane-1']).toEqual(['status', 'help']);
  });

  it('caps persisted paneHistory at 100 entries (most recent commands)', () => {
    const store = createRouteWorkspaceStore({ namespace: 'portal' });
    const initialOptions = { pinnedPrimary: true };
    const commands = Array.from({ length: 115 }, (_, idx) => `command-${115 - idx}`);
    store.setPaneHistory('/', initialOptions, 'pane-1', commands);

    const raw = window.sessionStorage.getItem('aklapper.portal.workspace.v1:/');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as RouteWorkspaceSnapshotV1;
    expect(parsed.paneHistory['pane-1']).toHaveLength(100);
    expect(parsed.paneHistory['pane-1']?.[0]).toBe('command-115');
    expect(parsed.paneHistory['pane-1']?.[99]).toBe('command-16');
  });

  it('degrades cleanly on malformed JSON, clears corrupt key, and emits BOUNDARY_FAULT without raw payload', () => {
    const events: WorkspaceStorageEvent[] = [];
    const store = createRouteWorkspaceStore({
      namespace: 'portal',
      onStorageEvent: event => events.push(event),
    });

    window.sessionStorage.setItem(
      'aklapper.portal.workspace.v1:/',
      '{truncated-secret-token-value',
    );
    const snapshot = store.getClientSnapshot('/', { pinnedPrimary: true });
    expect(snapshot.tabs.tabs).toHaveLength(1);
    expect(window.sessionStorage.getItem('aklapper.portal.workspace.v1:/')).toBeNull();

    expect(events).toHaveLength(1);
    expect(events[0]?.seamType).toBe('BOUNDARY_FAULT');
    expect(events[0]?.event).toBe('ui.workspace_storage.snapshot_invalid');
    expect(JSON.stringify(events[0])).not.toContain('truncated-secret-token-value');
  });

  it('degrades cleanly when sessionStorage.setItem throws QuotaExceededError or SecurityError and emits DELTA_AUDIT_GAP', () => {
    const events: WorkspaceStorageEvent[] = [];
    const store = createRouteWorkspaceStore({
      namespace: 'portal',
      onStorageEvent: event => events.push(event),
    });

    const quotaError = new Error('QuotaExceededError');
    quotaError.name = 'QuotaExceededError';
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw quotaError;
    });

    store.updateTabs('/', { pinnedPrimary: true }, prev => addWorkspaceTab(prev));
    const snapshot = store.getClientSnapshot('/', { pinnedPrimary: true });
    expect(snapshot.tabs.tabs).toHaveLength(2);
    expect(events).toHaveLength(1);
    expect(events[0]?.seamType).toBe('DELTA_AUDIT_GAP');
    expect(events[0]?.event).toBe('ui.workspace_storage.write_failed');
  });

  it('isolates concurrent SSR snapshots and blocks SSR mutations with UNSOUND_CONDITION', () => {
    const events: WorkspaceStorageEvent[] = [];
    const store = createRouteWorkspaceStore({
      namespace: 'portal',
      onStorageEvent: event => events.push(event),
    });

    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    try {
      const snapHome = store.getServerSnapshot('/', { pinnedPrimary: true });
      const snapAgensi = store.getServerSnapshot('/agensi', {
        pinnedPrimary: true,
        initialPrimaryTuiStack: ['/agensi'],
      });
      expect(snapHome.tabs.tabs[0]?.workspace.root.type).toBe('leaf');
      expect(
        snapAgensi.tabs.tabs[0]?.workspace.root.type === 'leaf'
          ? snapAgensi.tabs.tabs[0].workspace.root.tuiStack
          : [],
      ).toEqual(['/agensi']);

      store.updateTabs('/', { pinnedPrimary: true }, prev => addWorkspaceTab(prev));
      expect(events).toHaveLength(1);
      expect(events[0]?.seamType).toBe('UNSOUND_CONDITION');
      expect(events[0]?.event).toBe('ui.workspace_storage.ssr_mutation_blocked');
    } finally {
      Object.defineProperty(globalThis, 'window', {
        value: originalWindow,
        configurable: true,
        writable: true,
      });
    }
  });

  it('clearAll removes only namespace keys and supports silent idempotent clearing', () => {
    const adminStore = createRouteWorkspaceStore({ namespace: 'admin' });
    const listener = vi.fn<() => void>();
    const unsub = adminStore.subscribe('/analytics', listener);

    window.sessionStorage.setItem('aklapper.portal.workspace.v1:/', '{"keep":true}');
    adminStore.updateTabs('/analytics', { pinnedPrimary: true }, prev => addWorkspaceTab(prev));
    adminStore.updateTabs('/cms', { pinnedPrimary: true }, prev => addWorkspaceTab(prev));
    expect(listener).toHaveBeenCalledTimes(1);

    adminStore.clearAll({ silent: true });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem('aklapper.admin.workspace.v1:/analytics')).toBeNull();
    expect(window.sessionStorage.getItem('aklapper.admin.workspace.v1:/cms')).toBeNull();
    expect(window.sessionStorage.getItem('aklapper.portal.workspace.v1:/')).toBe('{"keep":true}');

    // Idempotent second clearAll
    adminStore.clearAll();
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('handles Object.prototype property names like hasOwnProperty in setPaneHistory without throwing and ignores forbidden prototype keys', () => {
    const store = createRouteWorkspaceStore({ namespace: 'portal' });
    expect(() => {
      store.setPaneHistory('/', undefined, 'hasOwnProperty', ['ls']);
    }).not.toThrow();

    const snapshot = store.getClientSnapshot('/');
    expect(Object.hasOwn(snapshot.paneHistory, 'hasOwnProperty')).toBe(true);
    expect(snapshot.paneHistory['hasOwnProperty']).toEqual(['ls']);

    // Repeat update with identical and changed history
    expect(() => {
      store.setPaneHistory('/', undefined, 'hasOwnProperty', ['ls']);
      store.setPaneHistory('/', undefined, 'hasOwnProperty', ['pwd', 'ls']);
    }).not.toThrow();
    expect(store.getClientSnapshot('/').paneHistory['hasOwnProperty']).toEqual(['pwd', 'ls']);

    // Forbidden prototype keys are ignored cleanly
    store.setPaneHistory('/', undefined, '__proto__', ['evil']);
    store.setPaneHistory('/', undefined, 'constructor', ['evil']);
    store.setPaneHistory('/', undefined, 'prototype', ['evil']);
    const after = store.getClientSnapshot('/');
    expect(Object.hasOwn(after.paneHistory, '__proto__')).toBe(false);
    expect(Object.hasOwn(after.paneHistory, 'constructor')).toBe(false);
    expect(Object.hasOwn(after.paneHistory, 'prototype')).toBe(false);
  });
});

describe('normalizePinnedPrimaryHost', () => {
  it('promotes the active tab and a non-tui leaf when zero tabs or leaves are pinned', () => {
    let state = createInitialTabbedWorkspaceState({ pinnedPrimary: false });
    state = addWorkspaceTab(state);
    state = updateActiveTabWorkspace(state, ws => splitActivePane(ws, 'right'));

    const normalized = normalizePinnedPrimaryHost(state);
    const pinnedTabs = normalized.tabs.filter(tab => tab.pinned === true);
    expect(pinnedTabs).toHaveLength(1);
    expect(pinnedTabs[0]?.id).toBe(state.activeTabId);

    const hostLeaves = listLeafPanes(pinnedTabs[0]!.workspace.root);
    const pinnedHostLeaves = hostLeaves.filter(leaf => leaf.pinned === true);
    expect(pinnedHostLeaves).toHaveLength(1);
    expect(pinnedHostLeaves[0]?.id).toBe(pinnedTabs[0]?.workspace.activePaneId);

    // Non-host tabs have zero pinned leaves
    const nonHostTabs = normalized.tabs.filter(tab => tab.id !== pinnedTabs[0]?.id);
    expect(nonHostTabs).toHaveLength(1);
    for (const tab of nonHostTabs) {
      expect(tab.pinned).toBeUndefined();
      expect(listLeafPanes(tab.workspace.root).some(leaf => Boolean(leaf.pinned))).toBe(false);
    }
  });

  it('deduplicates 2-pin tabs and 2-pin leaves to exactly one pinned host tab and leaf', () => {
    let base = createInitialTabbedWorkspaceState({ pinnedPrimary: true });
    base = updateActiveTabWorkspace(base, ws => splitActivePane(ws, 'right'));
    base = addWorkspaceTab(base);

    const corrupted: TerminalTabbedWorkspaceState = {
      ...base,
      tabs: base.tabs.map(tab => ({
        ...tab,
        pinned: true,
        workspace: {
          ...tab.workspace,
          root:
            tab.workspace.root.type === 'split'
              ? {
                  ...tab.workspace.root,
                  first:
                    tab.workspace.root.first.type === 'leaf'
                      ? { ...tab.workspace.root.first, pinned: true }
                      : tab.workspace.root.first,
                  second:
                    tab.workspace.root.second.type === 'leaf'
                      ? { ...tab.workspace.root.second, pinned: true }
                      : tab.workspace.root.second,
                }
              : { ...tab.workspace.root, pinned: true },
        },
      })),
    };

    const normalized = normalizePinnedPrimaryHost(corrupted);
    const pinnedTabs = normalized.tabs.filter(tab => tab.pinned === true);
    expect(pinnedTabs).toHaveLength(1);
    expect(pinnedTabs[0]?.id).toBe('tab-1');

    const pinnedLeavesTab1 = listLeafPanes(normalized.tabs[0]!.workspace.root).filter(
      leaf => leaf.pinned === true,
    );
    expect(pinnedLeavesTab1).toHaveLength(1);
    expect(pinnedLeavesTab1[0]?.id).toBe('pane-1');

    const pinnedLeavesTab2 = listLeafPanes(normalized.tabs[1]!.workspace.root).filter(
      leaf => leaf.pinned === true,
    );
    expect(pinnedLeavesTab2).toHaveLength(0);
    expect(normalized.tabs[1]?.pinned).toBeUndefined();
  });

  it('returns the exact same object reference when state already has 1 pinned host tab and 1 pinned leaf', () => {
    let valid = createInitialTabbedWorkspaceState({ pinnedPrimary: true });
    valid = addWorkspaceTab(valid);
    expect(normalizePinnedPrimaryHost(valid)).toBe(valid);
  });

  it('prefers non-tui leaves over pre-pinned tui leaves and normalizes tui-only pinned leaves to terminal', () => {
    // Case A: pre-pinned kind:'tui' leaf alongside a terminal leaf -> promotes terminal leaf
    const mixedTabBase = createInitialTabbedWorkspaceState({ pinnedPrimary: false });
    const mixedSplit = updateActiveTabWorkspace(mixedTabBase, ws => splitActivePane(ws, 'right'));
    const mixedTab = mixedSplit.tabs[0]!;
    const mixedRoot = mixedTab.workspace.root;
    expect(mixedRoot.type).toBe('split');
    const corruptedMixed: TerminalTabbedWorkspaceState = {
      ...mixedSplit,
      tabs: [
        {
          ...mixedTab,
          pinned: true,
          workspace: {
            ...mixedTab.workspace,
            root:
              mixedRoot.type === 'split' && mixedRoot.first.type === 'leaf'
                ? {
                    ...mixedRoot,
                    first: { ...mixedRoot.first, kind: 'tui', tuiOpen: true, pinned: true },
                  }
                : mixedRoot,
          },
        },
      ],
    };

    const normalizedMixed = normalizePinnedPrimaryHost(corruptedMixed);
    const mixedLeaves = listLeafPanes(normalizedMixed.tabs[0]!.workspace.root);
    const mixedPinned = mixedLeaves.filter(leaf => leaf.pinned === true);
    expect(mixedPinned).toHaveLength(1);
    expect(mixedPinned[0]?.id).toBe('pane-2');
    expect(mixedPinned[0]?.kind).not.toBe('tui');
    expect(mixedLeaves.find(leaf => leaf.id === 'pane-1')?.pinned).toBeUndefined();

    // Case B: tab containing ONLY kind:'tui' leaves (both pre-pinned and 0-pin) normalizes pinned leaf to terminal/tuiOpen:false
    const tuiOnlyBase = createInitialTabbedWorkspaceState({ pinnedPrimary: false });
    const tuiOnlyLeaf = listLeafPanes(tuiOnlyBase.tabs[0]!.workspace.root)[0]!;
    for (const prePinned of [true, false]) {
      const tuiOnlyState: TerminalTabbedWorkspaceState = {
        ...tuiOnlyBase,
        tabs: [
          {
            ...tuiOnlyBase.tabs[0]!,
            ...(prePinned ? { pinned: true } : {}),
            workspace: {
              ...tuiOnlyBase.tabs[0]!.workspace,
              root: {
                ...tuiOnlyLeaf,
                kind: 'tui',
                tuiOpen: true,
                ...(prePinned ? { pinned: true } : {}),
              },
            },
          },
        ],
      };

      const normalizedTuiOnly = normalizePinnedPrimaryHost(tuiOnlyState);
      const resultLeaves = listLeafPanes(normalizedTuiOnly.tabs[0]!.workspace.root);
      expect(resultLeaves).toHaveLength(1);
      expect(resultLeaves[0]).toMatchObject({
        id: tuiOnlyLeaf.id,
        kind: 'terminal',
        tuiOpen: false,
        pinned: true,
      });
    }
  });
});
