import {
  addWorkspaceTab,
  closeWorkspaceTab,
  createInitialTabbedWorkspaceState,
  listLeafPanes,
  popPaneView,
  pushPaneView,
  renameWorkspaceTab,
  setSplitRatio,
  splitActivePane,
  toggleZoomActivePane,
  updateActiveTabWorkspace,
} from '@aklapper/ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  parsePortalWorkspaceSnapshot,
  PORTAL_GLOBAL_STORAGE_KEY,
  PORTAL_LEGACY_V1_PREFIX,
  PORTAL_WORKSPACE_SNAPSHOT_VERSION,
  type PortalWorkspaceSnapshotV1,
} from './portalWorkspaceSnapshot';
import {
  createPortalWorkspaceStore,
  type PortalPaneViewRef,
  type PortalWorkspaceEvent,
} from './portalWorkspaceStore';

describe('portalWorkspaceSnapshot', () => {
  it('uses v1:global key/version and parses valid snapshots with optional lastRouteKey', () => {
    expect(PORTAL_WORKSPACE_SNAPSHOT_VERSION).toBe(1);
    expect(PORTAL_GLOBAL_STORAGE_KEY).toBe('aklapper.portal.workspace.v1:global');
    expect(PORTAL_LEGACY_V1_PREFIX).toBe('aklapper.portal.workspace.v1:');

    let tabs = createInitialTabbedWorkspaceState({ pinnedPrimary: true });
    tabs = addWorkspaceTab(tabs);
    tabs = renameWorkspaceTab(tabs, tabs.activeTabId, 'ops');
    tabs = updateActiveTabWorkspace(tabs, ws => {
      const split = splitActivePane(ws, 'right');
      return split.root.type === 'split' ? setSplitRatio(split, split.root.id, 0.65) : split;
    });

    const snapshot: PortalWorkspaceSnapshotV1 = {
      version: 1,
      tabs,
      paneHistory: { 'pane-1': ['whoami', 'ls'] },
      lastRouteKey: '/agensi/',
    };

    const parsed = parsePortalWorkspaceSnapshot(JSON.stringify(snapshot));
    expect(parsed).not.toBeNull();
    expect(parsed?.version).toBe(1);
    expect(parsed?.lastRouteKey).toBe('/agensi');
    expect(parsed?.tabs.tabs).toHaveLength(2);
    expect(parsed?.paneHistory['pane-1']).toEqual(['whoami', 'ls']);
  });

  it('rejects non-string lastRouteKey, unknown version, malformed JSON, and prototype keys on tab.id/leaf.id/paneHistory', () => {
    const baseTabs = createInitialTabbedWorkspaceState({ pinnedPrimary: true });
    expect(parsePortalWorkspaceSnapshot('{corrupt')).toBeNull();
    expect(
      parsePortalWorkspaceSnapshot(JSON.stringify({ version: 2, tabs: baseTabs, paneHistory: {} })),
    ).toBeNull();
    expect(
      parsePortalWorkspaceSnapshot(
        JSON.stringify({ version: 1, tabs: baseTabs, paneHistory: {}, lastRouteKey: 42 }),
      ),
    ).toBeNull();
    expect(
      parsePortalWorkspaceSnapshot(
        JSON.stringify({ version: 1, tabs: baseTabs, paneHistory: {}, lastRouteKey: '' }),
      ),
    ).toBeNull();

    const badTabIdTabs = {
      ...baseTabs,
      activeTabId: '__proto__',
      tabs: [{ ...baseTabs.tabs[0]!, id: '__proto__' }],
    };
    expect(
      parsePortalWorkspaceSnapshot(
        JSON.stringify({ version: 1, tabs: badTabIdTabs, paneHistory: {} }),
      ),
    ).toBeNull();

    const badLeafIdTabs = {
      ...baseTabs,
      tabs: [
        {
          ...baseTabs.tabs[0]!,
          workspace: {
            ...baseTabs.tabs[0]!.workspace,
            activePaneId: 'constructor',
            root: {
              ...baseTabs.tabs[0]!.workspace.root,
              id: 'constructor',
            },
          },
        },
      ],
    };
    expect(
      parsePortalWorkspaceSnapshot(
        JSON.stringify({ version: 1, tabs: badLeafIdTabs, paneHistory: {} }),
      ),
    ).toBeNull();

    expect(
      parsePortalWorkspaceSnapshot(
        `{"version":1,"tabs":${JSON.stringify(baseTabs)},"paneHistory":{"prototype":["evil"]}}`,
      ),
    ).toBeNull();
  });

  it('normalizes 0-pin and 2-pin valid v1:global snapshots to exactly 1 pinned tab and 1 pinned leaf and caps history at 100', () => {
    const zeroPinTabs = createInitialTabbedWorkspaceState({ pinnedPrimary: false });
    const rawHistory = Array.from({ length: 115 }, (_, idx) => `cmd-${idx + 1}`);
    const parsedZero = parsePortalWorkspaceSnapshot(
      JSON.stringify({
        version: 1,
        tabs: zeroPinTabs,
        paneHistory: { 'pane-1': rawHistory },
      }),
    );
    expect(parsedZero).not.toBeNull();
    expect(parsedZero?.tabs.tabs.filter(t => t.pinned === true)).toHaveLength(1);
    expect(
      listLeafPanes(parsedZero!.tabs.tabs[0]!.workspace.root).filter(l => l.pinned === true),
    ).toHaveLength(1);
    expect(parsedZero?.paneHistory['pane-1']).toHaveLength(100);

    let twoPinBase = createInitialTabbedWorkspaceState({ pinnedPrimary: true });
    twoPinBase = addWorkspaceTab(twoPinBase);
    const twoPinTabs = {
      ...twoPinBase,
      tabs: twoPinBase.tabs.map(t => ({
        ...t,
        pinned: true,
        workspace: {
          ...t.workspace,
          root:
            t.workspace.root.type === 'leaf'
              ? { ...t.workspace.root, pinned: true }
              : t.workspace.root,
        },
      })),
    };
    const parsedTwo = parsePortalWorkspaceSnapshot(
      JSON.stringify({ version: 1, tabs: twoPinTabs, paneHistory: {} }),
    );
    expect(parsedTwo?.tabs.tabs.filter(t => t.pinned === true)).toHaveLength(1);
    const pinnedCount = parsedTwo!.tabs.tabs.reduce(
      (sum, tab) =>
        sum + listLeafPanes(tab.workspace.root).filter(leaf => leaf.pinned === true).length,
      0,
    );
    expect(pinnedCount).toBe(1);
  });
});

describe('createPortalWorkspaceStore', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it('persists globally under v1:global, prunes legacy per-route v1 keys on first write, and leaves admin keys untouched', () => {
    window.sessionStorage.setItem('aklapper.portal.workspace.v1:/', '{"stale":true}');
    window.sessionStorage.setItem('aklapper.portal.workspace.v1:/agensi', '{"stale":true}');
    window.sessionStorage.setItem('aklapper.admin.workspace.v1:/ops', '{"admin":true}');

    const storeA = createPortalWorkspaceStore();
    storeA.updateTabs('/', undefined, prev => {
      const added = addWorkspaceTab(prev);
      return renameWorkspaceTab(added, added.activeTabId, 'notes');
    });
    storeA.setPaneHistory('/', undefined, 'pane-1', ['ls', 'whoami']);

    expect(window.sessionStorage.getItem(PORTAL_GLOBAL_STORAGE_KEY)).not.toBeNull();
    expect(window.sessionStorage.getItem('aklapper.portal.workspace.v1:/')).toBeNull();
    expect(window.sessionStorage.getItem('aklapper.portal.workspace.v1:/agensi')).toBeNull();
    expect(window.sessionStorage.getItem('aklapper.admin.workspace.v1:/ops')).toBe(
      '{"admin":true}',
    );

    // Same-URL hard reload preserves active secondary tab and command history
    const storeB = createPortalWorkspaceStore();
    const restoredSame = storeB.getClientSnapshot('/');
    expect(restoredSame.tabs.tabs).toHaveLength(2);
    expect(restoredSame.tabs.activeTabId).toBe('tab-2');
    expect(restoredSame.tabs.tabs[1]?.title).toBe('notes');
    expect(restoredSame.paneHistory['pane-1']).toEqual(['ls', 'whoami']);

    // Cross-URL hard reload normalizes primary host focus
    const storeC = createPortalWorkspaceStore();
    const restoredCross = storeC.getClientSnapshot('/contact');
    expect(restoredCross.tabs.activeTabId).toBe('tab-1');
    expect(restoredCross.lastRouteKey).toBe('/contact');
    expect(restoredCross.tabs.tabs).toHaveLength(2);
  });

  it('syncRoute focuses transferable pinned primary host tab, unzooms non-host pane, and clears primary overlays while preserving secondary panes', () => {
    const store = createPortalWorkspaceStore();
    const removedBatches: Array<readonly PortalPaneViewRef[]> = [];
    store.onPaneViewsRemoved(views => removedBatches.push(views));

    // Split primary tab with secondary /chat, zoom secondary pane, push /agensi overlay on primary, add Tab 2, close Tab 1 (transferring pin to Tab 2!)
    const splitPaneId = store.openPane('/chat', 'split', { pathname: '/' });
    expect(splitPaneId).toBe('pane-2');
    store.updateTabs('/', undefined, prev =>
      updateActiveTabWorkspace(prev, ws => toggleZoomActivePane(ws)),
    );
    store.updateTabs('/', undefined, prev =>
      updateActiveTabWorkspace(prev, ws => pushPaneView(ws, 'pane-1', '/agensi')),
    );
    store.openPane('/cadence', 'tab', { pathname: '/' });
    expect(store.getClientSnapshot('/').tabs.activeTabId).toBe('tab-2');

    // Navigate to /contact via syncRoute -> activates pinned Tab 1, clears zoom on pane-2, clears /agensi overlay on pane-1, keeps /chat in pane-2 and /cadence in Tab 2
    store.syncRoute('/contact');
    const afterSync = store.getClientSnapshot('/contact');
    expect(afterSync.tabs.activeTabId).toBe('tab-1');
    expect(afterSync.lastRouteKey).toBe('/contact');
    const tab1 = afterSync.tabs.tabs.find(t => t.id === 'tab-1')!;
    expect(tab1.workspace.activePaneId).toBe('pane-1');
    expect(tab1.workspace.zoomedPaneId).toBeNull();
    const pane1 = listLeafPanes(tab1.workspace.root).find(l => l.id === 'pane-1')!;
    const pane2 = listLeafPanes(tab1.workspace.root).find(l => l.id === 'pane-2')!;
    expect(pane1.tuiStack ?? []).toEqual([]);
    expect(pane2.tuiStack).toEqual(['/chat']);
    expect(removedBatches.flat()).toContainEqual({ paneId: 'pane-1', routePath: '/agensi' });

    // Transfer pin from Tab 1 to Tab 2 by closing Tab 1, add Tab 3, then syncRoute must focus Tab 2 (not hardcoded tab-1!)
    store.updateTabs('/contact', undefined, prev => closeWorkspaceTab(prev, 'tab-1'));
    store.openTerminal('tab', 'right', '/contact');
    expect(store.getClientSnapshot('/contact').tabs.activeTabId).toBe('tab-1'); // lowest-unused ID reused for new tab
    store.syncRoute('/agensi');
    const afterPinTransfer = store.getClientSnapshot('/agensi');
    const pinnedTab = afterPinTransfer.tabs.tabs.find(t => t.pinned === true);
    expect(pinnedTab?.id).toBe('tab-2');
    expect(afterPinTransfer.tabs.activeTabId).toBe('tab-2');
  });

  it('fires onPaneViewsAdded on launch and onPaneViewsRemoved on both pane close and in-pane pop/exit', () => {
    const store = createPortalWorkspaceStore();
    const added: PortalPaneViewRef[] = [];
    const removed: PortalPaneViewRef[] = [];
    store.onPaneViewsAdded(views => added.push(...views));
    store.onPaneViewsRemoved(views => removed.push(...views));

    const pane2 = store.openPane('/agensi', 'split');
    expect(added).toEqual([{ paneId: pane2, routePath: '/agensi' }]);

    // Pop in-pane view on surviving split pane
    store.updateTabs('/', undefined, prev =>
      updateActiveTabWorkspace(prev, ws => popPaneView(ws, pane2)),
    );
    expect(removed).toEqual([{ paneId: pane2, routePath: '/agensi' }]);

    // Push onto pinned pane-1 then pop
    store.updateTabs('/', undefined, prev =>
      updateActiveTabWorkspace(prev, ws => pushPaneView(ws, 'pane-1', '/contact')),
    );
    expect(added).toContainEqual({ paneId: 'pane-1', routePath: '/contact' });

    store.updateTabs('/', undefined, prev =>
      updateActiveTabWorkspace(prev, ws => popPaneView(ws, 'pane-1')),
    );
    expect(removed).toContainEqual({ paneId: 'pane-1', routePath: '/contact' });
  });

  it('handles corrupt v1:global snapshot, QuotaExceededError, SSR isolation, and route policy telemetry seams', () => {
    const events: PortalWorkspaceEvent[] = [];
    const store = createPortalWorkspaceStore({
      onEvent: event => events.push(event),
    });

    // Corrupt JSON removes bad key and emits BOUNDARY_FAULT without raw text
    window.sessionStorage.setItem(PORTAL_GLOBAL_STORAGE_KEY, '{secret-corrupt-token');
    const fallback = store.getClientSnapshot('/');
    expect(fallback.tabs.tabs).toHaveLength(1);
    expect(window.sessionStorage.getItem(PORTAL_GLOBAL_STORAGE_KEY)).toBeNull();
    expect(events).toContainEqual(
      expect.objectContaining({
        event: 'portal.workspace.snapshot_invalid',
        seamType: 'BOUNDARY_FAULT',
      }),
    );
    expect(JSON.stringify(events)).not.toContain('secret-corrupt-token');

    // QuotaExceededError keeps in-memory workspace functional and emits DELTA_AUDIT_GAP
    const quotaErr = new Error('Quota exceeded');
    quotaErr.name = 'QuotaExceededError';
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw quotaErr;
    });
    store.openTerminal('tab');
    expect(store.getClientSnapshot('/').tabs.tabs).toHaveLength(2);
    expect(events).toContainEqual(
      expect.objectContaining({
        event: 'portal.workspace.write_failed',
        seamType: 'DELTA_AUDIT_GAP',
        errorName: 'QuotaExceededError',
      }),
    );

    // Route policy branch telemetry
    store.recordRoutePolicy('/', 'global-workspace');
    store.recordRoutePolicy('/changes-in-progress', 'excluded-standalone');
    store.recordRoutePolicy('/', 'excluded-maintenance');
    expect(events).toContainEqual(
      expect.objectContaining({
        event: 'portal.workspace.route_policy_branch',
        seamType: 'RULE_DIVERGENCE',
        branch: 'global-workspace',
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        event: 'portal.workspace.route_policy_branch',
        seamType: 'RULE_DIVERGENCE',
        branch: 'excluded-standalone',
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        event: 'portal.workspace.route_policy_branch',
        seamType: 'RULE_DIVERGENCE',
        branch: 'excluded-maintenance',
      }),
    );

    // SSR isolation and mutation block
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    try {
      const ssrA = store.getServerSnapshot('/');
      const ssrB = store.getServerSnapshot('/agensi');
      expect(ssrA).toBe(ssrB);
      expect(ssrA.tabs.tabs).toHaveLength(1);

      store.syncRoute('/agensi');
      store.updateTabs('/', undefined, prev => addWorkspaceTab(prev));
      const ssrBlocks = events.filter(
        e =>
          e.event === 'portal.workspace.ssr_mutation_blocked' && e.seamType === 'UNSOUND_CONDITION',
      );
      expect(ssrBlocks.length).toBeGreaterThanOrEqual(2);
    } finally {
      Object.defineProperty(globalThis, 'window', {
        value: originalWindow,
        configurable: true,
        writable: true,
      });
    }
  });
});
