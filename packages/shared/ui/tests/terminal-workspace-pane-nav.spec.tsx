import type { TerminalProfileData } from '@aklapper/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  PaneLink,
  TerminalWorkspace,
  type TerminalPaneViewContext,
  TuiWindow,
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
    const topNavigate = vi.fn();
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
    const onReturnToShell = vi.fn();
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
});
