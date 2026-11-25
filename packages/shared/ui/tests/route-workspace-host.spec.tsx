import type { TerminalProfileData } from '@aklapper/core';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RouteWorkspaceHost, TerminalWorkspace, ZshP10kTerminal, useIsPaneActive } from '../src';
import {
  buildRouteWorkspaceStorageKey,
  createRouteWorkspaceStore,
  parseRouteWorkspaceSnapshot,
} from '../src/workspace-storage';

const TEST_TERMINAL: TerminalProfileData = {
  slug: 'portal-home',
  bannerTitle: 'Solar Forge Terminal // tty1',
  bannerMeta: 'tty1 · interactive shell',
  osLabel: '⚡',
  directory: '~/projects/aklapper',
  vcsBranch: 'develop',
  vcsState: 'clean',
  contextLabel: 'guest@andrew-k.us',
  placeholder: 'type a command',
  quickCommands: ['help', 'status'],
  initialEntries: [],
  commands: [
    {
      name: 'help',
      description: 'help',
      kind: 'static',
      output: 'commands: help status',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 1,
    },
    {
      name: 'status',
      description: 'status',
      kind: 'static',
      output: 'all systems nominal',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 2,
    },
  ],
};

function PaneActiveProbe({ label }: { readonly label: string }) {
  const active = useIsPaneActive();
  return <span data-testid={`pane-active-${label}`}>{active ? 'active' : 'inactive'}</span>;
}

describe('RouteWorkspaceHost and TerminalWorkspace keep-alive containment', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it('applies hidden, inert, and aria-hidden="true" to inactive route layers and gates Alt+Shift+N to the active workspace', () => {
    const store = createRouteWorkspaceStore({ namespace: 'portal' });
    const renderHost = (activeRouteKey: string) => (
      <RouteWorkspaceHost
        activeRouteKey={activeRouteKey}
        outlet={<PaneActiveProbe label={activeRouteKey === '/' ? 'home' : 'agensi'} />}
        renderWorkspace={({ routeKey, outlet, isActive }) => (
          <TerminalWorkspace
            terminal={TEST_TERMINAL}
            isActive={isActive}
            routeKey={routeKey}
            workspaceStore={store}
            primaryPane={{
              title: routeKey === '/' ? 'tty1' : `tui :: ${routeKey}`,
              content: outlet,
            }}
          />
        )}
      />
    );

    const { container, rerender } = render(renderHost('/'));
    expect(screen.getByTestId('pane-active-home').textContent).toBe('active');

    rerender(renderHost('/agensi'));

    const homeLayer = container.querySelector<HTMLElement>('[data-route-workspace="/"]');
    const agensiLayer = container.querySelector<HTMLElement>('[data-route-workspace="/agensi"]');
    expect(homeLayer).not.toBeNull();
    expect(agensiLayer).not.toBeNull();

    expect(homeLayer?.hidden).toBe(true);
    expect(homeLayer?.hasAttribute('inert')).toBe(true);
    expect(homeLayer?.getAttribute('aria-hidden')).toBe('true');
    expect(homeLayer?.getAttribute('data-route-active')).toBe('false');

    expect(agensiLayer?.hidden).toBe(false);
    expect(agensiLayer?.hasAttribute('inert')).toBe(false);
    expect(agensiLayer?.getAttribute('aria-hidden')).toBeNull();
    expect(agensiLayer?.getAttribute('data-route-active')).toBe('true');

    expect(screen.getByTestId('pane-active-home').textContent).toBe('inactive');
    expect(screen.getByTestId('pane-active-agensi').textContent).toBe('active');

    // Press Alt+Shift+N while on /agensi
    fireEvent.keyDown(window, {
      key: 'N',
      code: 'KeyN',
      altKey: true,
      shiftKey: true,
    });

    const homeWs = homeLayer?.querySelector<HTMLElement>('[data-tab-count]');
    const agensiWs = agensiLayer?.querySelector<HTMLElement>('[data-tab-count]');
    expect(agensiWs?.getAttribute('data-tab-count')).toBe('2');
    expect(homeWs?.getAttribute('data-tab-count')).toBe('1');
  });

  it('prevents Alt+N readline actions from mutating hidden route terminals', () => {
    const store = createRouteWorkspaceStore({ namespace: 'portal' });
    store.setPaneHistory('/', { pinnedPrimary: true }, 'pane-1', ['status', 'help']);

    const renderHost = (activeRouteKey: string) => (
      <RouteWorkspaceHost
        activeRouteKey={activeRouteKey}
        outlet={
          activeRouteKey === '/' ? (
            <TerminalWorkspace terminal={TEST_TERMINAL} />
          ) : (
            <div>ask view</div>
          )
        }
        renderWorkspace={({ routeKey, outlet, isActive }) => (
          <TerminalWorkspace
            terminal={TEST_TERMINAL}
            isActive={isActive}
            routeKey={routeKey}
            workspaceStore={store}
            primaryPane={{
              title: routeKey === '/' ? 'tty1' : `tui :: ${routeKey}`,
              content: outlet,
              embeddedTerminal: routeKey === '/',
            }}
          />
        )}
      />
    );

    const { container, rerender } = render(renderHost('/'));
    const homeInput = container.querySelector<HTMLInputElement>(
      '[data-route-workspace="/"] input[aria-label*="Terminal command input"]',
    );
    expect(homeInput).not.toBeNull();
    expect(homeInput?.value).toBe('');

    rerender(renderHost('/ask'));

    // Trigger Alt+N while / is hidden
    fireEvent.keyDown(window, {
      key: 'n',
      code: 'KeyN',
      altKey: true,
    });

    expect(homeInput?.value).toBe('');
    expect(document.activeElement).not.toBe(homeInput);
  });

  it('preserves and restores scrollTop on scrollable descendants across hidden/re-shown transitions', () => {
    const renderHost = (activeRouteKey: string) => (
      <RouteWorkspaceHost
        activeRouteKey={activeRouteKey}
        outlet={
          <div
            data-testid={`scroller-${activeRouteKey}`}
            style={{ overflowY: 'auto', height: '100px' }}
          >
            <div style={{ height: '1000px' }}>content {activeRouteKey}</div>
          </div>
        }
        renderWorkspace={({ outlet }) => <div>{outlet}</div>}
      />
    );

    const { rerender } = render(renderHost('/agensi'));
    const scroller = screen.getByTestId('scroller-/agensi');
    scroller.scrollTop = 320;
    fireEvent.scroll(scroller);

    // Deactivate /agensi (simulate browser display:none resetting scrollTop to 0)
    rerender(renderHost('/menu'));
    scroller.scrollTop = 0;

    // Reactivate /agensi — useLayoutEffect restores 320
    rerender(renderHost('/agensi'));
    expect(scroller.scrollTop).toBe(320);
  });

  it('retains [initialDeepLinkRoute] in sessionStorage when popping/exiting a deep-linked primary pane back to shell', () => {
    const store = createRouteWorkspaceStore({ namespace: 'portal' });
    const onReturnToShell = vi.fn<() => void>();

    render(
      <TerminalWorkspace
        terminal={TEST_TERMINAL}
        routeKey='/agensi'
        workspaceStore={store}
        initialPrimaryTuiStack={['/agensi']}
        onPrimaryPaneReturnToShell={onReturnToShell}
        renderPaneView={ctx => <div>pane view {ctx.viewId}</div>}
        primaryPane={{
          title: 'tui :: /agensi',
          content: <div>agensi route</div>,
          flush: true,
          embeddedTerminal: false,
        }}
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onReturnToShell).toHaveBeenCalledTimes(1);

    const raw = window.sessionStorage.getItem(buildRouteWorkspaceStorageKey('portal', '/agensi'));
    const parsedLeaf = raw ? parseRouteWorkspaceSnapshot(raw)?.tabs.tabs[0]?.workspace.root : null;
    expect(
      raw === null || (parsedLeaf?.type === 'leaf' && parsedLeaf.tuiStack?.[0] === '/agensi'),
    ).toBe(true);
    const snap = store.getClientSnapshot('/agensi', {
      pinnedPrimary: true,
      initialPrimaryTuiStack: ['/agensi'],
    });
    const rootLeaf = snap.tabs.tabs[0]?.workspace.root;
    expect(rootLeaf?.type === 'leaf' ? rootLeaf.tuiStack : []).toEqual(['/agensi']);
  });

  it('uncontrolled TerminalWorkspace without workspaceStore never writes to sessionStorage', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const { container } = render(<TerminalWorkspace terminal={TEST_TERMINAL} />);
    fireEvent.keyDown(window, {
      key: 'N',
      code: 'KeyN',
      altKey: true,
      shiftKey: true,
    });
    expect(container.querySelector('[data-tab-count="2"]')).not.toBeNull();
    expect(setItemSpy).not.toHaveBeenCalled();
  });
});

describe('ZshP10kTerminal command history hydration and capping', () => {
  it('syncs post-SSR initialCommandHistory, enforces maxCommandHistory, and invokes onCommandHistoryChange', () => {
    const onChange = vi.fn<(history: readonly string[]) => void>();
    const commands = {
      help: () => ({ output: 'help output' }),
      status: () => ({ output: 'status output' }),
    };

    const { rerender } = render(
      <ZshP10kTerminal
        directory='~'
        vcsBranch='main'
        contextLabel='guest'
        commands={commands}
        initialCommandHistory={[]}
        maxCommandHistory={3}
        onCommandHistoryChange={onChange}
      />,
    );

    // Post-SSR hydration supplies saved history
    rerender(
      <ZshP10kTerminal
        directory='~'
        vcsBranch='main'
        contextLabel='guest'
        commands={commands}
        initialCommandHistory={['status', 'help']}
        maxCommandHistory={3}
        onCommandHistoryChange={onChange}
      />,
    );

    const input = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('status');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('help');

    // Submit 2 more commands — should cap at 3
    act(() => {
      fireEvent.change(input, { target: { value: 'help' } });
      fireEvent.submit(input.closest('form') as HTMLFormElement);
    });
    act(() => {
      fireEvent.change(input, { target: { value: 'status' } });
      fireEvent.submit(input.closest('form') as HTMLFormElement);
    });

    expect(onChange).toHaveBeenLastCalledWith(['status', 'help', 'status']);
  });
});
