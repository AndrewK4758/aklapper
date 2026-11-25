import type { TerminalProfileData } from '@aklapper/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  PaneLink,
  TerminalWorkspace,
  type TerminalPaneViewContext,
  TuiWindow,
  WorkspaceLauncherContext,
  type WorkspaceLauncherContextValue,
} from '../src';

const NAV_TERMINAL_FIXTURE: TerminalProfileData = {
  slug: 'portal-home',
  bannerTitle: 'Solar Forge Terminal // tty1',
  bannerMeta: 'tty1 · interactive shell',
  osLabel: '⚡',
  directory: '~/projects/aklapper',
  vcsBranch: 'portfolio_v2',
  vcsState: 'clean',
  contextLabel: 'guest@andrew-k.us',
  placeholder: 'type a command',
  quickCommands: ['help', 'tui', 'whoami'],
  initialEntries: [],
  commands: [
    {
      name: 'whoami',
      description: 'session user',
      kind: 'static',
      output: 'guest@andrew-k.us (tty1)',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 1,
    },
    {
      name: 'tui',
      description: 'open tui in current pane',
      kind: 'tui',
      output: 'opening TUI launcher ...',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 2,
    },
    {
      name: 'menu',
      description: 'open menu',
      kind: 'navigate',
      output: 'opening /menu ...',
      targetRoute: '/menu',
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 3,
    },
    {
      name: 'agensi',
      description: 'open agensi',
      kind: 'navigate',
      output: 'opening /agensi ...',
      targetRoute: '/agensi',
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 4,
    },
    {
      name: 'cd',
      description: 'change route',
      kind: 'cd',
      output: 'cd /{{target}}',
      targetRoute: null,
      allowedRoutes: ['menu', 'agensi', 'ask', 'cadence', 'contact'],
      errorTemplate: 'cd: no such route: {{input}}',
      sortOrder: 5,
    },
  ],
};

function renderTestPaneView(ctx: TerminalPaneViewContext) {
  if (ctx.viewId === 'tui') {
    return (
      <TuiWindow title='TUI Launcher' onClose={ctx.exitTui}>
        <div>Launcher View</div>
        <PaneLink to='/menu'>Launch Menu</PaneLink>
        <PaneLink to='/agensi'>Agensi</PaneLink>
      </TuiWindow>
    );
  }
  if (ctx.viewId === '/menu') {
    return (
      <TuiWindow title='Module Menu' onClose={ctx.exitTui}>
        <div>Menu View</div>
        <PaneLink to='/agensi'>Agensi Storefront</PaneLink>
        <PaneLink to='/contact'>Contact Form</PaneLink>
      </TuiWindow>
    );
  }
  if (ctx.viewId === '/agensi') {
    return (
      <TuiWindow title='Agensi Storefront' onClose={ctx.exitTui}>
        <div>Agensi View</div>
      </TuiWindow>
    );
  }
  if (ctx.viewId === '/ask') {
    return (
      <TuiWindow title='Ask Portfolio' onClose={ctx.exitTui}>
        <div>Ask View</div>
      </TuiWindow>
    );
  }
  if (ctx.viewId === '/contact') {
    return (
      <TuiWindow title='Contact' onClose={ctx.exitTui}>
        <label htmlFor={`email-${ctx.paneId}`}>Email</label>
        <input id={`email-${ctx.paneId}`} type='text' defaultValue='' />
      </TuiWindow>
    );
  }
  return (
    <TuiWindow title={ctx.viewId} onClose={ctx.exitTui}>
      <div>Unknown View: {ctx.viewId}</div>
    </TuiWindow>
  );
}

function submitActiveCommand(cmd: string) {
  const input = screen.getByLabelText('Terminal command input') as HTMLInputElement;
  fireEvent.change(input, { target: { value: cmd } });
  fireEvent.submit(input.closest('form') as HTMLFormElement);
}

describe('TerminalWorkspace in-pane TUI navigation', () => {
  it('takes over current pane in-place on tui/module commands and preserves shell scrollback', () => {
    const topNavigate = vi.fn<(to: string) => void>();
    const { container } = render(
      <TerminalWorkspace
        terminal={NAV_TERMINAL_FIXTURE}
        navigate={topNavigate}
        renderPaneView={renderTestPaneView}
      />,
    );

    const workspaceEl = container.querySelector('[data-pane-count]') as HTMLElement;
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');

    submitActiveCommand('whoami');
    expect(screen.getByText('guest@andrew-k.us (tty1)')).toBeTruthy();

    submitActiveCommand('tui');
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');
    expect(screen.getByText('Launcher View')).toBeTruthy();

    const pane1 = container.querySelector('[data-pane-id="pane-1"]') as HTMLElement;
    expect(pane1.getAttribute('data-pane-kind')).toBe('tui');
    expect(pane1.getAttribute('data-tui-depth')).toBe('1');
    const shellLayer = pane1.querySelector('[data-shell-layer="true"]') as HTMLElement;
    expect(shellLayer.hidden).toBe(true);
    expect(shellLayer.hasAttribute('inert')).toBe(true);

    // Exit TUI returns to preserved shell scrollback
    fireEvent.click(screen.getByRole('button', { name: 'Exit TUI' }));
    expect(pane1.getAttribute('data-pane-kind')).toBe('terminal');
    expect(pane1.getAttribute('data-tui-depth')).toBe('0');
    expect(shellLayer.hidden).toBe(false);
    expect(screen.getByText('guest@andrew-k.us (tty1)')).toBeTruthy();

    // Module commands and cd stay in-pane without top-level navigate
    submitActiveCommand('agensi');
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');
    expect(screen.getByText('Agensi View')).toBeTruthy();
    expect(topNavigate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Exit TUI' }));
    submitActiveCommand('cd ask');
    expect(screen.getByText('Ask View')).toBeTruthy();
    expect(topNavigate).not.toHaveBeenCalled();

    // Invalid cd stays in shell with error
    fireEvent.click(screen.getByRole('button', { name: 'Exit TUI' }));
    submitActiveCommand('cd nonexistent');
    expect(pane1.getAttribute('data-tui-depth')).toBe('0');
    expect(screen.getByText('cd: no such route: nonexistent')).toBeTruthy();
  });

  it('pops one level on Back/Escape/Alt+Left, clears stack on q, and guards editable inputs', () => {
    const { container } = render(
      <TerminalWorkspace terminal={NAV_TERMINAL_FIXTURE} renderPaneView={renderTestPaneView} />,
    );
    const pane1 = container.querySelector('[data-pane-id="pane-1"]') as HTMLElement;

    submitActiveCommand('tui');
    fireEvent.click(screen.getByRole('link', { name: 'Launch Menu' }));
    fireEvent.click(screen.getByRole('link', { name: 'Agensi Storefront' }));
    expect(pane1.getAttribute('data-tui-depth')).toBe('3');

    // Go back -> /menu (depth 2)
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(pane1.getAttribute('data-tui-depth')).toBe('2');
    expect(screen.getByText('Menu View')).toBeTruthy();

    // Escape once -> tui (depth 1, zero double-Escape pop)
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(pane1.getAttribute('data-tui-depth')).toBe('1');
    expect(screen.getByText('Launcher View')).toBeTruthy();

    // Alt+ArrowLeft -> shell (depth 0)
    fireEvent.keyDown(window, { key: 'ArrowLeft', altKey: true });
    expect(pane1.getAttribute('data-tui-depth')).toBe('0');

    // Deep stack + 'q' exits straight back to shell
    submitActiveCommand('tui');
    fireEvent.click(screen.getByRole('link', { name: 'Launch Menu' }));
    fireEvent.click(screen.getByRole('link', { name: 'Agensi Storefront' }));
    expect(pane1.getAttribute('data-tui-depth')).toBe('3');
    fireEvent.keyDown(window, { key: 'q' });
    expect(pane1.getAttribute('data-tui-depth')).toBe('0');

    // Editable input suppresses 'q' and 'Escape'
    submitActiveCommand('cd contact');
    const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
    emailInput.focus();
    fireEvent.keyDown(emailInput, { key: 'q' });
    fireEvent.keyDown(emailInput, { key: 'Escape' });
    expect(pane1.getAttribute('data-tui-depth')).toBe('1');
  });

  it('supports Shift+Click/--split and Ctrl+Click/middle-click/--tab escape hatches', () => {
    const { container } = render(
      <TerminalWorkspace terminal={NAV_TERMINAL_FIXTURE} renderPaneView={renderTestPaneView} />,
    );
    const workspaceEl = container.querySelector('[data-pane-count]') as HTMLElement;

    submitActiveCommand('tui');
    fireEvent.click(screen.getByRole('link', { name: 'Agensi' }), { shiftKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');
    expect(screen.getByText('Launcher View')).toBeTruthy();
    expect(screen.getByText('Agensi View')).toBeTruthy();

    // Multi-pane chrome close removes only pane-2
    const pane2 = container.querySelector('[data-pane-id="pane-2"]') as HTMLElement;
    fireEvent.click(within(pane2).getByRole('button', { name: 'Close tty2' }));
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');

    // Ctrl+Click opens new tab
    fireEvent.click(screen.getByRole('link', { name: 'Launch Menu' }), { ctrlKey: true });
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('2');
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-2');
    expect(screen.getByText('Menu View')).toBeTruthy();

    // Switch back to tab-1, exit TUI, and run CLI --split --tab (deterministic --tab wins)
    fireEvent.keyDown(window, { key: '1', code: 'Digit1', altKey: true });
    fireEvent.keyDown(window, { key: 'q' });
    submitActiveCommand('cd agensi --split --tab');
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('3');
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-3');
  });

  it('isolates focus on hover, scopes shortcuts to focused pane, and executes unfocused clicks atomically', () => {
    const { container } = render(
      <TerminalWorkspace terminal={NAV_TERMINAL_FIXTURE} renderPaneView={renderTestPaneView} />,
    );

    // Split right: pane-2 has menu -> agensi
    submitActiveCommand('menu --split');
    const pane2 = container.querySelector('[data-pane-id="pane-2"]') as HTMLElement;
    fireEvent.click(within(pane2).getByRole('link', { name: 'Agensi Storefront' }));
    expect(pane2.getAttribute('data-tui-depth')).toBe('2');

    // Focus pane-1 (shell)
    const pane1 = container.querySelector('[data-pane-id="pane-1"]') as HTMLElement;
    fireEvent.pointerDown(pane1);
    expect(pane1.getAttribute('data-active')).toBe('true');
    expect(pane2.getAttribute('data-active')).toBe('false');

    // Hovering pane-2 must NOT steal focus
    fireEvent.mouseEnter(pane2);
    fireEvent.pointerEnter(pane2);
    expect(pane1.getAttribute('data-active')).toBe('true');
    expect(pane2.getAttribute('data-active')).toBe('false');

    // Escape / q while pane-1 (shell) is focused must NOT affect pane-2
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(window, { key: 'q' });
    expect(pane2.getAttribute('data-tui-depth')).toBe('2');

    // Clicking Go back inside unfocused pane-2 atomically focuses pane-2 and pops it
    fireEvent.click(within(pane2).getByRole('button', { name: 'Go back' }));
    expect(pane2.getAttribute('data-active')).toBe('true');
    expect(pane1.getAttribute('data-active')).toBe('false');
    expect(pane2.getAttribute('data-tui-depth')).toBe('1');
    expect(within(pane2).getByText('Menu View')).toBeTruthy();

    // Focus-within (Tab into pane-1) activates pane-1
    fireEvent.focus(pane1);
    expect(pane1.getAttribute('data-active')).toBe('true');
    expect(pane2.getAttribute('data-active')).toBe('false');
  });

  it('seeds primary pane stack on deep-link and calls onPrimaryPaneReturnToShell on exit', () => {
    const onReturnToShell = vi.fn<() => void>();
    render(
      <TerminalWorkspace
        terminal={NAV_TERMINAL_FIXTURE}
        initialPrimaryTuiStack={['/agensi']}
        onPrimaryPaneReturnToShell={onReturnToShell}
        renderPaneView={renderTestPaneView}
        primaryPane={{
          title: 'tui :: /agensi',
          content: <TuiWindow title='SSR Agensi'>SSR Outlet Content</TuiWindow>,
          flush: true,
          embeddedTerminal: false,
        }}
      />,
    );

    expect(screen.getByText('SSR Outlet Content')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Exit TUI' }));
    expect(onReturnToShell).toHaveBeenCalledTimes(1);
  });

  it('re-seeds pane-1 stack on browser Back re-entry from / to a deep-link and on deep-link route switch', () => {
    const onReturnToShell = vi.fn<() => void>();
    const { container, rerender } = render(
      <TerminalWorkspace
        terminal={NAV_TERMINAL_FIXTURE}
        initialPrimaryTuiStack={['/agensi']}
        onPrimaryPaneReturnToShell={onReturnToShell}
        renderPaneView={renderTestPaneView}
        primaryPane={{
          title: 'tui :: /agensi',
          content: <TuiWindow title='SSR Agensi'>SSR Agensi Content</TuiWindow>,
          flush: true,
          embeddedTerminal: false,
        }}
      />,
    );

    const pane1 = container.querySelector('[data-pane-id="pane-1"]') as HTMLElement;
    expect(pane1.getAttribute('data-tui-depth')).toBe('1');

    // Exit TUI -> navigate to / (embeddedTerminal: true, initialPrimaryTuiStack: undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Exit TUI' }));
    expect(onReturnToShell).toHaveBeenCalledTimes(1);
    rerender(
      <TerminalWorkspace
        terminal={NAV_TERMINAL_FIXTURE}
        initialPrimaryTuiStack={undefined}
        onPrimaryPaneReturnToShell={onReturnToShell}
        renderPaneView={renderTestPaneView}
        primaryPane={{
          title: 'tty1',
          content: <div>Embedded Shell</div>,
          flush: true,
          embeddedTerminal: true,
        }}
      />,
    );
    expect(pane1.getAttribute('data-tui-depth')).toBe('0');

    // Browser Back to /agensi (embeddedTerminal flips true -> false, initialPrimaryTuiStack: ['/agensi'])
    rerender(
      <TerminalWorkspace
        terminal={NAV_TERMINAL_FIXTURE}
        initialPrimaryTuiStack={['/agensi']}
        onPrimaryPaneReturnToShell={onReturnToShell}
        renderPaneView={renderTestPaneView}
        primaryPane={{
          title: 'tui :: /agensi',
          content: <TuiWindow title='SSR Agensi'>SSR Agensi Content</TuiWindow>,
          flush: true,
          embeddedTerminal: false,
        }}
      />,
    );
    expect(pane1.getAttribute('data-tui-depth')).toBe('1');
    expect(screen.getByText('SSR Agensi Content')).toBeTruthy();

    // Escape works on re-entered deep-link (not deadlocked)
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onReturnToShell).toHaveBeenCalledTimes(2);

    // Direct deep-link switch /agensi -> /menu updates stack without stale overlay
    rerender(
      <TerminalWorkspace
        terminal={NAV_TERMINAL_FIXTURE}
        initialPrimaryTuiStack={['/menu']}
        onPrimaryPaneReturnToShell={onReturnToShell}
        renderPaneView={renderTestPaneView}
        primaryPane={{
          title: 'tui :: /menu',
          content: <TuiWindow title='SSR Menu'>SSR Menu Content</TuiWindow>,
          flush: true,
          embeddedTerminal: false,
        }}
      />,
    );
    expect(pane1.getAttribute('data-tui-depth')).toBe('1');
    expect(screen.getByText('SSR Menu Content')).toBeTruthy();
    expect(screen.queryByText('Agensi View')).toBeNull();
  });

  it('handles primaryPane.isRouteView depth, Escape/Alt+Left/q/Exit TUI exits, and overlay layering without mutating tuiStack for routes', () => {
    const onReturnToShell = vi.fn<() => void>();
    const { container } = render(
      <TerminalWorkspace
        terminal={NAV_TERMINAL_FIXTURE}
        onPrimaryPaneReturnToShell={onReturnToShell}
        renderPaneView={renderTestPaneView}
        primaryPane={{
          title: 'tui :: /agensi',
          content: (
            <TuiWindow title='SSR Agensi' onClose={onReturnToShell}>
              <div>Primary Route Agensi</div>
            </TuiWindow>
          ),
          flush: true,
          embeddedTerminal: false,
          isRouteView: true,
        }}
      />,
    );

    const pane1 = container.querySelector('[data-pane-id="pane-1"]') as HTMLElement;
    expect(pane1.getAttribute('data-pane-kind')).toBe('tui');
    expect(pane1.getAttribute('data-tui-depth')).toBe('1');
    expect(screen.getByText('Primary Route Agensi')).toBeTruthy();

    // Exit TUI at depth 1 (stack empty, isRouteView true) returns to shell
    fireEvent.click(screen.getByRole('button', { name: 'Exit TUI' }));
    expect(onReturnToShell).toHaveBeenCalledTimes(1);

    // Escape at depth 1 returns to shell
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onReturnToShell).toHaveBeenCalledTimes(2);

    // Alt+ArrowLeft at depth 1 returns to shell
    fireEvent.keyDown(window, { key: 'ArrowLeft', altKey: true });
    expect(onReturnToShell).toHaveBeenCalledTimes(3);

    // 'q' at depth 1 returns to shell
    fireEvent.keyDown(window, { key: 'q' });
    expect(onReturnToShell).toHaveBeenCalledTimes(4);

    // Pushing an in-pane overlay (Alt+T) bumps depth to 2 across both frame and tuiLayer
    fireEvent.keyDown(window, { key: 't', code: 'KeyT', altKey: true });
    expect(pane1.getAttribute('data-tui-depth')).toBe('2');
    const tuiLayer = pane1.querySelector('[data-tui-view="tui"]') as HTMLElement;
    expect(tuiLayer.getAttribute('data-tui-depth')).toBe('2');
    expect(screen.getByText('Launcher View')).toBeTruthy();

    // First Escape pops overlay back to primary route (depth 1) without calling onPrimaryPaneReturnToShell
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(pane1.getAttribute('data-tui-depth')).toBe('1');
    expect(screen.getByText('Primary Route Agensi')).toBeTruthy();
    expect(onReturnToShell).toHaveBeenCalledTimes(4);

    // Second Escape returns to shell
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onReturnToShell).toHaveBeenCalledTimes(5);

    // Overlay + 'q' exits straight back to shell
    fireEvent.keyDown(window, { key: 't', code: 'KeyT', altKey: true });
    expect(pane1.getAttribute('data-tui-depth')).toBe('2');
    fireEvent.keyDown(window, { key: 'q' });
    expect(pane1.getAttribute('data-tui-depth')).toBe('1');
    expect(onReturnToShell).toHaveBeenCalledTimes(6);
  });

  it('updates primary tab display title when focus moves between primary route, overlay, secondary terminal split, and custom title', () => {
    const { container } = render(
      <TerminalWorkspace
        terminal={NAV_TERMINAL_FIXTURE}
        renderPaneView={renderTestPaneView}
        primaryPane={{
          title: 'tui :: /cadence',
          content: (
            <TuiWindow title='CADENCE Builder'>
              <div>CADENCE Route Content</div>
            </TuiWindow>
          ),
          flush: true,
          embeddedTerminal: false,
          isRouteView: true,
        }}
      />,
    );

    expect(screen.getByRole('tab', { name: 'tui :: /cadence' })).toBeTruthy();

    // Split active pane -> secondary terminal tty2 becomes focused -> tab title shows tty2
    fireEvent.keyDown(window, { key: 'D', code: 'KeyD', altKey: true, shiftKey: true });
    expect(screen.getByRole('tab', { name: /tty2/ })).toBeTruthy();

    // Focus back to pinned primary pane -> tab title shows tui :: /cadence
    const pane1 = container.querySelector('[data-pane-id="pane-1"]') as HTMLElement;
    fireEvent.pointerDown(pane1);
    expect(screen.getByRole('tab', { name: /tui :: \/cadence/ })).toBeTruthy();

    // Push overlay on primary pane -> tab title shows 'tui'
    fireEvent.keyDown(window, { key: 't', code: 'KeyT', altKey: true });
    expect(screen.getByRole('tab', { name: /tui/ })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /tui :: \/cadence/ })).toBeNull();

    // Custom tab title overrides leaf focus
    fireEvent.keyDown(window, { key: 'F2' });
    const renameInput = screen.getByLabelText('Rename tab') as HTMLInputElement;
    expect(renameInput.value).toBe('tui');
    fireEvent.change(renameInput, { target: { value: 'ops' } });
    fireEvent.keyDown(renameInput, { key: 'Enter' });
    expect(screen.getByRole('tab', { name: /ops/ })).toBeTruthy();

    const pane2 = container.querySelector('[data-pane-id="pane-2"]') as HTMLElement;
    fireEvent.pointerDown(pane2);
    expect(screen.getByRole('tab', { name: /ops/ })).toBeTruthy();
  });

  it('PaneLink falls back to WorkspaceLauncherContext when rendered outside PaneNavigationContext', () => {
    const launcher: WorkspaceLauncherContextValue = {
      openPane: vi.fn<(viewId: string, target: 'in-pane' | 'split' | 'tab') => void>(),
      openTerminal: vi.fn<(target: 'split' | 'tab') => void>(),
      focusPrimaryHostTab: vi.fn<() => void>(),
    };

    const { rerender } = render(
      <WorkspaceLauncherContext.Provider value={launcher}>
        <PaneLink to='/agensi'>Open Agensi</PaneLink>
      </WorkspaceLauncherContext.Provider>,
    );

    const link = screen.getByRole('link', { name: 'Open Agensi' });
    fireEvent.click(link);
    expect(launcher.openPane).toHaveBeenLastCalledWith('/agensi', 'in-pane');

    fireEvent.click(link, { shiftKey: true });
    expect(launcher.openPane).toHaveBeenLastCalledWith('/agensi', 'split');

    fireEvent.click(link, { ctrlKey: true });
    expect(launcher.openPane).toHaveBeenLastCalledWith('/agensi', 'tab');

    fireEvent(link, new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));
    expect(launcher.openPane).toHaveBeenCalledTimes(4);
    expect(launcher.openPane).toHaveBeenLastCalledWith('/agensi', 'tab');

    // Without either context, degrades cleanly to standard anchor without preventing default
    rerender(<PaneLink to='/agensi'>Plain Anchor</PaneLink>);
    const plainLink = screen.getByRole('link', { name: 'Plain Anchor' });
    expect(plainLink.getAttribute('href')).toBe('/agensi');
  });
});
