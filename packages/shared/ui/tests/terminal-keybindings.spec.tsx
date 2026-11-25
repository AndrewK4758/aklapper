import type { TerminalProfileData } from '@aklapper/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TerminalWorkspace, TuiWindow } from '../src';

const KEYBIND_TERMINAL_FIXTURE: TerminalProfileData = {
  slug: 'portal-home',
  bannerTitle: 'Solar Forge Terminal // tty1',
  bannerMeta: 'tty1 · interactive shell',
  osLabel: '⚡',
  directory: '~/projects/aklapper',
  vcsBranch: 'portfolio_v2',
  vcsState: 'clean',
  contextLabel: 'guest@andrew-k.us',
  placeholder: 'type a command',
  quickCommands: ['help', 'tui', 'whoami', 'clear'],
  initialEntries: [],
  commands: [
    {
      name: 'help',
      description: 'list commands',
      kind: 'static',
      output: [
        'Available terminal commands:',
        '  help — list commands',
        '',
        'Split panes & tabs (keybindings & commands):',
        '  Ctrl+Shift+} / Alt+Shift+D (or "split" / "vsplit")          — split terminal right',
      ].join('\n'),
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 1,
    },
    {
      name: 'whoami',
      description: 'session user',
      kind: 'static',
      output: 'guest@andrew-k.us (tty1)',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 2,
    },
    {
      name: 'status',
      description: 'cluster status',
      kind: 'static',
      output: 'gke-autopilot: 0 pods',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 3,
    },
    {
      name: 'tui',
      description: 'open tui split pane',
      kind: 'tui',
      output: 'opening TUI launcher split pane ...',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 4,
    },
    {
      name: 'clear',
      description: 'clear scrollback',
      kind: 'clear',
      output: '',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 5,
    },
  ],
};

function renderWorkspace(options?: {
  navigate?: (to: string) => void;
  disableMenuShortcut?: boolean;
}) {
  const result = render(
    <TerminalWorkspace
      terminal={KEYBIND_TERMINAL_FIXTURE}
      navigate={options?.navigate}
      disableMenuShortcut={options?.disableMenuShortcut}
      renderTui={({ ttyNumber, closeTui }) => (
        <TuiWindow title={`tui :: tty${ttyNumber}`} closeOnEscape={false} onClose={closeTui}>
          <div>TUI Launcher Pane {ttyNumber}</div>
        </TuiWindow>
      )}
    />,
  );
  const workspaceEl = result.container.querySelector('[data-pane-count]') as HTMLElement;
  const getPane = (paneId: string) =>
    result.container.querySelector(`[data-pane-id="${paneId}"]`) as HTMLElement;
  const getSlot = (paneId: string) => getPane(paneId).parentElement as HTMLElement;
  const getActivePaneId = () =>
    result.container
      .querySelector('[data-tab-active="true"] [data-pane-id][data-active="true"]')
      ?.getAttribute('data-pane-id') ?? null;
  const submitCommand = (cmd: string) => {
    const input = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: cmd } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
  };

  return {
    ...result,
    workspaceEl,
    getPane,
    getSlot,
    getActivePaneId,
    submitCommand,
  };
}

describe('TerminalWorkspace keybind action validation', () => {
  it.each([
    {
      name: 'Ctrl+Shift+}',
      event: { key: '}', code: 'BracketRight', ctrlKey: true, shiftKey: true },
    },
    {
      name: 'Ctrl+Shift+]',
      event: { key: ']', code: 'BracketRight', ctrlKey: true, shiftKey: true },
    },
    {
      name: 'Alt+Shift+D',
      event: { key: 'D', code: 'KeyD', altKey: true, shiftKey: true },
    },
  ])('splits terminal right via $name', ({ event }) => {
    const { workspaceEl, getSlot, getActivePaneId } = renderWorkspace();

    fireEvent.keyDown(window, event);
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');
    expect(getActivePaneId()).toBe('pane-2');
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-x')).toBe('0');
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-w')).toBe('0.5');
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-x')).toBe('0.5');
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-w')).toBe('0.5');
  });

  it.each(['split', 'vsplit'])('splits terminal right via "%s" command', command => {
    const { workspaceEl, getSlot, submitCommand } = renderWorkspace();

    submitCommand(command);
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-x')).toBe('0.5');
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-w')).toBe('0.5');
  });

  it.each([
    {
      name: 'Ctrl+Shift+{',
      event: { key: '{', code: 'BracketLeft', ctrlKey: true, shiftKey: true },
    },
    {
      name: 'Ctrl+Shift+[',
      event: { key: '[', code: 'BracketLeft', ctrlKey: true, shiftKey: true },
    },
    {
      name: 'Alt+Shift+S',
      event: { key: 'S', code: 'KeyS', altKey: true, shiftKey: true },
    },
  ])('splits terminal down via $name', ({ event }) => {
    const { workspaceEl, getSlot, getActivePaneId } = renderWorkspace();

    fireEvent.keyDown(window, event);
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');
    expect(getActivePaneId()).toBe('pane-2');
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-y')).toBe('0');
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-h')).toBe('0.5');
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-y')).toBe('0.5');
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-h')).toBe('0.5');
  });

  it('splits terminal down via "hsplit" command', () => {
    const { workspaceEl, getSlot, submitCommand } = renderWorkspace();

    submitCommand('hsplit');
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-y')).toBe('0.5');
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-h')).toBe('0.5');
  });

  it('opens, focuses, and toggles TUI split pane via Alt+T, "tui" command, and Escape', () => {
    const { container, workspaceEl, getActivePaneId, submitCommand } = renderWorkspace();

    // Alt+T opens TUI split pane
    fireEvent.keyDown(window, { key: 't', code: 'KeyT', altKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');
    expect(container.querySelector('[data-pane-kind="tui"]')).toBeTruthy();
    expect(getActivePaneId()).toBe('pane-2');

    // Focusing tty1 then pressing Alt+T refocuses existing TUI pane without duplicating
    fireEvent.keyDown(window, { key: 'h', code: 'KeyH', altKey: true });
    expect(getActivePaneId()).toBe('pane-1');
    fireEvent.keyDown(window, { key: 't', code: 'KeyT', altKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');
    expect(getActivePaneId()).toBe('pane-2');

    // Pressing Alt+T while TUI pane is active closes it
    fireEvent.keyDown(window, { key: 't', code: 'KeyT', altKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');
    expect(container.querySelector('[data-pane-kind="tui"]')).toBeNull();

    // Typing "tui" opens TUI split pane, Escape closes it
    submitCommand('tui');
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');
    expect(container.querySelector('[data-pane-kind="tui"]')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');
    expect(container.querySelector('[data-pane-kind="tui"]')).toBeNull();
  });

  it('focuses neighbor panes via Alt+H/J/K/L, Cmd+], and Cmd+[', () => {
    const { getActivePaneId } = renderWorkspace();

    // Build 2x2 grid: left (pane-1) | right (pane-2 / pane-3)
    fireEvent.keyDown(window, { key: '}', code: 'BracketRight', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: '{', code: 'BracketLeft', ctrlKey: true, shiftKey: true });
    expect(getActivePaneId()).toBe('pane-3'); // bottom-right

    // Alt+K -> pane-2 (top-right)
    fireEvent.keyDown(window, { key: 'k', code: 'KeyK', altKey: true });
    expect(getActivePaneId()).toBe('pane-2');

    // Alt+J -> pane-3 (bottom-right)
    fireEvent.keyDown(window, { key: 'j', code: 'KeyJ', altKey: true });
    expect(getActivePaneId()).toBe('pane-3');

    // Alt+H -> pane-1 (left)
    fireEvent.keyDown(window, { key: 'h', code: 'KeyH', altKey: true });
    expect(getActivePaneId()).toBe('pane-1');

    // Alt+L -> pane-2 or pane-3 (right column)
    fireEvent.keyDown(window, { key: 'l', code: 'KeyL', altKey: true });
    expect(['pane-2', 'pane-3']).toContain(getActivePaneId());

    // Alt+K / Alt+J move vertically in right column
    fireEvent.keyDown(window, { key: 'k', code: 'KeyK', altKey: true });
    expect(getActivePaneId()).toBe('pane-2');
    fireEvent.keyDown(window, { key: 'j', code: 'KeyJ', altKey: true });
    expect(getActivePaneId()).toBe('pane-3');

    // Alt+H -> pane-1
    fireEvent.keyDown(window, { key: 'h', code: 'KeyH', altKey: true });
    expect(getActivePaneId()).toBe('pane-1');

    // Cmd+] and Cmd+[ cycle through all panes in order
    fireEvent.keyDown(window, { key: ']', code: 'BracketRight', metaKey: true });
    expect(getActivePaneId()).toBe('pane-2');
    fireEvent.keyDown(window, { key: ']', code: 'BracketRight', metaKey: true });
    expect(getActivePaneId()).toBe('pane-3');
    fireEvent.keyDown(window, { key: '[', code: 'BracketLeft', metaKey: true });
    expect(getActivePaneId()).toBe('pane-2');
    fireEvent.keyDown(window, { key: '[', code: 'BracketLeft', metaKey: true });
    expect(getActivePaneId()).toBe('pane-1');
  });

  it('resizes vertical and horizontal splits via Alt+Shift+Arrows and Ctrl+Cmd+Arrows', () => {
    const { getSlot } = renderWorkspace();

    // Vertical split: pane-1 | pane-2
    fireEvent.keyDown(window, { key: '}', code: 'BracketRight', ctrlKey: true, shiftKey: true });
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-w')).toBe('0.5');

    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true, shiftKey: true });
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-w')).toBe('0.55');
    fireEvent.keyDown(window, { key: 'ArrowLeft', altKey: true, shiftKey: true });
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-w')).toBe('0.5');

    fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true, metaKey: true });
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-w')).toBe('0.55');
    fireEvent.keyDown(window, { key: 'ArrowLeft', ctrlKey: true, metaKey: true });
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-w')).toBe('0.5');

    // Horizontal split inside right column: pane-2 / pane-3
    fireEvent.keyDown(window, { key: '{', code: 'BracketLeft', ctrlKey: true, shiftKey: true });
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-h')).toBe('0.5');

    fireEvent.keyDown(window, { key: 'ArrowDown', altKey: true, shiftKey: true });
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-h')).toBe('0.55');
    fireEvent.keyDown(window, { key: 'ArrowUp', altKey: true, shiftKey: true });
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-h')).toBe('0.5');

    fireEvent.keyDown(window, { key: 'ArrowDown', ctrlKey: true, metaKey: true });
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-h')).toBe('0.55');
    fireEvent.keyDown(window, { key: 'ArrowUp', ctrlKey: true, metaKey: true });
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-h')).toBe('0.5');
  });

  it('swaps split panes via Alt+Shift+H/J/K/L (all 4 directions) and "swap" command', () => {
    const { getSlot, submitCommand } = renderWorkspace();

    // Vertical split: pane-1 (x=0) | pane-2 (x=0.5, active)
    fireEvent.keyDown(window, { key: '}', code: 'BracketRight', ctrlKey: true, shiftKey: true });
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-x')).toBe('0.5');

    fireEvent.keyDown(window, { key: 'H', code: 'KeyH', altKey: true, shiftKey: true });
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-x')).toBe('0');
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-x')).toBe('0.5');

    fireEvent.keyDown(window, { key: 'L', code: 'KeyL', altKey: true, shiftKey: true });
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-x')).toBe('0.5');
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-x')).toBe('0');

    // "swap" terminal command swaps active pane-2 back to x=0
    submitCommand('swap');
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-x')).toBe('0');

    // Rotate to horizontal split: pane-2 (y=0, active) / pane-1 (y=0.5)
    fireEvent.keyDown(window, { key: 'R', code: 'KeyR', altKey: true, shiftKey: true });
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-y')).toBe('0');
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-y')).toBe('0.5');

    fireEvent.keyDown(window, { key: 'J', code: 'KeyJ', altKey: true, shiftKey: true });
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-y')).toBe('0.5');
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-y')).toBe('0');

    fireEvent.keyDown(window, { key: 'K', code: 'KeyK', altKey: true, shiftKey: true });
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-y')).toBe('0');
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-y')).toBe('0.5');
  });

  it('rotates split orientation via Alt+Shift+R, Ctrl+Alt+Shift+R, and "rotate" command', () => {
    const { getSlot, submitCommand } = renderWorkspace();

    fireEvent.keyDown(window, { key: '}', code: 'BracketRight', ctrlKey: true, shiftKey: true });
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-w')).toBe('0.5');
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-h')).toBe('1');

    // Alt+Shift+R -> horizontal (browser-safe)
    fireEvent.keyDown(window, { key: 'R', code: 'KeyR', altKey: true, shiftKey: true });
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-w')).toBe('1');
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-h')).toBe('0.5');

    // Ctrl+Alt+Shift+R -> vertical
    fireEvent.keyDown(window, {
      key: 'R',
      code: 'KeyR',
      ctrlKey: true,
      altKey: true,
      shiftKey: true,
    });
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-w')).toBe('0.5');
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-h')).toBe('1');

    // "rotate" command -> horizontal
    submitCommand('rotate');
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-w')).toBe('1');
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-h')).toBe('0.5');
  });

  it('toggles pane zoom via Ctrl+Shift+Enter, Cmd+Shift+Enter, and "zoom" command', () => {
    const { workspaceEl, getSlot, submitCommand } = renderWorkspace();

    fireEvent.keyDown(window, { key: '}', code: 'BracketRight', ctrlKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-zoomed')).toBe('false');

    // Ctrl+Shift+Enter zooms pane-2 and hides pane-1
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-zoomed')).toBe('true');
    expect(getSlot('pane-1').getAttribute('data-hidden')).toBe('true');
    expect(getSlot('pane-2').getAttribute('data-hidden')).toBe('false');

    // Cmd+Shift+Enter unzooms
    fireEvent.keyDown(window, { key: 'Enter', metaKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-zoomed')).toBe('false');
    expect(getSlot('pane-1').getAttribute('data-hidden')).toBe('false');

    // "zoom" command zooms and unzooms
    submitCommand('zoom');
    expect(workspaceEl.getAttribute('data-zoomed')).toBe('true');
    submitCommand('zoom');
    expect(workspaceEl.getAttribute('data-zoomed')).toBe('false');
  });

  it('equalizes resized split back to 50/50 via Ctrl+Alt+Shift+E', () => {
    const { getSlot } = renderWorkspace();

    fireEvent.keyDown(window, { key: '}', code: 'BracketRight', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true, shiftKey: true });
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-w')).toBe('0.6');

    fireEvent.keyDown(window, {
      key: 'E',
      code: 'KeyE',
      ctrlKey: true,
      altKey: true,
      shiftKey: true,
    });
    expect(getSlot('pane-1').style.getPropertyValue('--sf-pane-w')).toBe('0.5');
    expect(getSlot('pane-2').style.getPropertyValue('--sf-pane-w')).toBe('0.5');
  });

  it('opens new tabs via Alt+Shift+N, "tab", and "newtab"', () => {
    const { workspaceEl, submitCommand } = renderWorkspace();

    fireEvent.keyDown(window, { key: 'N', code: 'KeyN', altKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('2');
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-2');

    submitCommand('tab');
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('3');
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-3');

    submitCommand('newtab');
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('4');
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-4');
  });

  it('detaches split panes to new tabs via Ctrl+Alt+Shift+T and "detach" command', () => {
    const { workspaceEl, submitCommand } = renderWorkspace();

    // Split into 3 panes, detach pane-3 via Ctrl+Alt+Shift+T
    fireEvent.keyDown(window, { key: '}', code: 'BracketRight', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: '{', code: 'BracketLeft', ctrlKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('3');

    fireEvent.keyDown(window, {
      key: 'T',
      code: 'KeyT',
      ctrlKey: true,
      altKey: true,
      shiftKey: true,
    });
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('2');
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-2');
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');

    // Return to tab-1 (still 2 panes), detach active pane-2 via "detach" command
    fireEvent.keyDown(window, { key: '!', code: 'Digit1', altKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');
    submitCommand('detach');
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('3');
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-3');
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');
  });

  it('renames active tab via F2 (Enter commits, Escape cancels)', () => {
    renderWorkspace();

    // F2 + Enter commits
    fireEvent.keyDown(window, { key: 'F2', code: 'F2' });
    const firstInput = screen.getByLabelText('Rename tab') as HTMLInputElement;
    fireEvent.change(firstInput, { target: { value: 'primary-ops' } });
    fireEvent.keyDown(firstInput, { key: 'Enter' });
    expect(screen.getByRole('tab', { name: 'primary-ops' })).toBeTruthy();

    // F2 + Escape cancels without overwriting
    fireEvent.keyDown(window, { key: 'F2', code: 'F2' });
    const cancelInput = screen.getByLabelText('Rename tab') as HTMLInputElement;
    fireEvent.change(cancelInput, { target: { value: 'discarded-name' } });
    fireEvent.keyDown(cancelInput, { key: 'Escape' });
    expect(screen.queryByLabelText('Rename tab')).toBeNull();
    expect(screen.getByRole('tab', { name: 'primary-ops' })).toBeTruthy();

    // F2 + Enter commits new name
    fireEvent.keyDown(window, { key: 'F2', code: 'F2' });
    const secondInput = screen.getByLabelText('Rename tab') as HTMLInputElement;
    fireEvent.change(secondInput, { target: { value: 'forge-shell' } });
    fireEvent.keyDown(secondInput, { key: 'Enter' });
    expect(screen.getByRole('tab', { name: 'forge-shell' })).toBeTruthy();
  });

  it('switches tabs via Alt+], Alt+[, and Alt+Shift+1..9', () => {
    const { workspaceEl } = renderWorkspace();

    // Create 3 tabs total: tab-1, tab-2, tab-3 (active: tab-3)
    fireEvent.keyDown(window, { key: 'N', code: 'KeyN', altKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: 'N', code: 'KeyN', altKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('3');
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-3');

    // Alt+Shift+1, Alt+Shift+2, Alt+Shift+3, Alt+Shift+9 (last)
    fireEvent.keyDown(window, { key: '!', code: 'Digit1', altKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-1');
    fireEvent.keyDown(window, { key: '@', code: 'Digit2', altKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-2');
    fireEvent.keyDown(window, { key: '#', code: 'Digit3', altKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-3');
    fireEvent.keyDown(window, { key: '!', code: '', altKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-1');
    fireEvent.keyDown(window, { key: '(', code: 'Digit9', altKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-3');

    // Alt+] -> tab-1, Alt+[ -> tab-3
    fireEvent.keyDown(window, { key: ']', code: 'BracketRight', altKey: true });
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-1');
    fireEvent.keyDown(window, { key: '[', code: 'BracketLeft', altKey: true });
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-3');
  });

  it('closes active panes and tabs via Alt+Shift+W and "exit"', () => {
    const { workspaceEl, submitCommand } = renderWorkspace();

    // Open tab-2 and split it into 3 panes
    fireEvent.keyDown(window, { key: 'N', code: 'KeyN', altKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: '}', code: 'BracketRight', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: '{', code: 'BracketLeft', ctrlKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('2');
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('3');

    // Close 2 panes using Alt+Shift+W
    fireEvent.keyDown(window, { key: 'W', code: 'KeyW', altKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');

    fireEvent.keyDown(window, { key: 'W', code: 'KeyW', altKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');

    // Final pane in tab-2 closes the tab via "exit"
    submitCommand('exit');
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('1');
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-1');
  });

  it('reuses lowest unused tab numbers after closing tabs and allows closing tab-1 when 2+ tabs are open', () => {
    const { workspaceEl, submitCommand } = renderWorkspace();

    // Open tab-2 and tab-3, then close tab-3 and tab-2
    fireEvent.keyDown(window, { key: 'N', code: 'KeyN', altKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: 'N', code: 'KeyN', altKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('3');
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-3');

    fireEvent.keyDown(window, { key: 'W', code: 'KeyW', altKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-2');
    fireEvent.keyDown(window, { key: 'W', code: 'KeyW', altKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('1');
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-1');

    // Opening a new tab reuses tab-2 AND visible label tty2 rather than skipping to tab-4 / tty4
    fireEvent.keyDown(window, { key: 'N', code: 'KeyN', altKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-2');
    const tabLabelsAfterReopen = Array.from(workspaceEl.querySelectorAll('[role="tab"]')).map(el =>
      el.textContent?.trim(),
    );
    expect(tabLabelsAfterReopen).toEqual(['tty1', 'tty2']);

    // Switch back to tab-1 and close it via "exit", then open a new tab -> reuses tab-1 AND visible label tty1
    fireEvent.keyDown(window, { key: '!', code: 'Digit1', altKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-1');
    submitCommand('exit');
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('1');
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-2');

    submitCommand('tab');
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('2');
    expect(workspaceEl.getAttribute('data-active-tab')).toBe('tab-1');
    const tabLabelsAfterClosingFirst = Array.from(workspaceEl.querySelectorAll('[role="tab"]')).map(
      el => el.textContent?.trim(),
    );
    expect(tabLabelsAfterClosingFirst).toEqual(['tty2', 'tty1']);
  });

  it('navigates to /menu via Alt+M unless disableMenuShortcut is set', () => {
    const navigate = vi.fn<(to: string) => void>();
    const first = renderWorkspace({ navigate });

    fireEvent.keyDown(window, { key: 'm', code: 'KeyM', altKey: true });
    expect(navigate).toHaveBeenCalledWith('/menu');
    first.unmount();

    const blockedNavigate = vi.fn<(to: string) => void>();
    renderWorkspace({ navigate: blockedNavigate, disableMenuShortcut: true });
    fireEvent.keyDown(window, { key: 'm', code: 'KeyM', altKey: true });
    expect(blockedNavigate).not.toHaveBeenCalled();
  });

  it('handles terminal autocomplete, history, line-editing, cancel, and clear keybindings', () => {
    const { submitCommand } = renderWorkspace();
    const input = screen.getByLabelText('Terminal command input') as HTMLInputElement;

    // Tab accepts autocomplete suggestion ("who" -> "whoami")
    fireEvent.change(input, { target: { value: 'who' } });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(input.value).toBe('whoami');
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(screen.getByText('guest@andrew-k.us (tty1)')).toBeTruthy();

    // ArrowRight at end of line accepts autocomplete suggestion ("stat" -> "status")
    fireEvent.change(input, { target: { value: 'stat' } });
    input.setSelectionRange(4, 4);
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(input.value).toBe('status');
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(screen.getByText('gke-autopilot: 0 pods')).toBeTruthy();

    // ArrowUp / ArrowDown and Alt+P / Ctrl+P / Alt+N navigate history
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('status');
    fireEvent.keyDown(input, { key: 'p', code: 'KeyP', ctrlKey: true });
    expect(input.value).toBe('whoami');
    fireEvent.keyDown(input, { key: 'n', code: 'KeyN', altKey: true });
    expect(input.value).toBe('status');
    fireEvent.keyDown(input, { key: 'p', code: 'KeyP', altKey: true });
    expect(input.value).toBe('whoami');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('status');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('');

    // Ctrl+A (start), Ctrl+K (kill to end), Ctrl+E (end), Alt+Backspace (delete prev word), Ctrl+U (kill to start)
    fireEvent.change(input, { target: { value: 'alpha beta gamma' } });
    input.setSelectionRange(10, 10);
    fireEvent.keyDown(input, { key: 'k', code: 'KeyK', ctrlKey: true });
    expect(input.value).toBe('alpha beta');

    input.setSelectionRange(10, 10);
    fireEvent.keyDown(input, { key: 'Backspace', code: 'Backspace', altKey: true });
    expect(input.value).toBe('alpha ');

    input.setSelectionRange(6, 6);
    fireEvent.keyDown(input, { key: 'a', ctrlKey: true });
    expect(input.selectionStart).toBe(0);

    fireEvent.keyDown(input, { key: 'e', ctrlKey: true });
    expect(input.selectionStart).toBe(6);

    input.setSelectionRange(3, 3);
    fireEvent.keyDown(input, { key: 'u', ctrlKey: true });
    expect(input.value).toBe('ha ');

    // Ctrl+C cancels active line with ^C entry
    input.setSelectionRange(3, 3);
    fireEvent.keyDown(input, { key: 'c', ctrlKey: true });
    expect(input.value).toBe('');
    expect(screen.getByText('ha ^C')).toBeTruthy();

    // Ctrl+L clears scrollback
    submitCommand('help');
    expect(screen.getByText(/Split panes & tabs \(keybindings & commands\):/i)).toBeTruthy();
    fireEvent.keyDown(input, { key: 'l', ctrlKey: true });
    expect(screen.queryByText(/Split panes & tabs \(keybindings & commands\):/i)).toBeNull();
  });
});
