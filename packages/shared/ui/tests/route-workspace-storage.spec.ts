import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addWorkspaceTab,
  createInitialTabbedWorkspaceState,
  renameWorkspaceTab,
  setSplitRatio,
  splitActivePane,
  updateActiveTabWorkspace,
} from '../src/components/terminalPaneTree';
import {
  buildRouteWorkspaceStorageKey,
  createRouteWorkspaceStore,
  MAX_TERMINAL_HISTORY_ENTRIES,
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
});
