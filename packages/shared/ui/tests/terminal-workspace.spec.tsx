import type { TerminalProfileData } from '@aklapper/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  closePaneById,
  createInitialWorkspaceState,
  equalizeAllSplits,
  findLeafPane,
  focusDirectionalPane,
  focusRelativePane,
  listLeafPanes,
  matchGhosttyShortcut,
  resizeActiveSplit,
  setPaneTuiOpen,
  splitActivePane,
  TerminalWorkspace,
  toggleZoomActivePane,
  TuiWindow,
} from '../src';

const TERMINAL_FIXTURE: TerminalProfileData = {
  slug: 'portal-home',
  bannerTitle: 'Solar Forge Terminal // tty1',
  bannerMeta: 'tty1 · interactive shell',
  osLabel: '⚡',
  directory: '~/projects/aklapper',
  vcsBranch: 'portfolio_v2',
  vcsState: 'clean',
  contextLabel: 'guest@andrew-k.us',
  placeholder: 'type a command',
  quickCommands: ['help', 'tui', 'clear'],
  initialEntries: [
    {
      command: 'ls -la',
      output: 'menu/ tui/ cadence/',
      status: 'ok',
      durationLabel: '4ms',
      timestamp: '00:00:00',
      sortOrder: 0,
    },
  ],
  commands: [
    {
      name: 'help',
      description: 'list commands',
      kind: 'static',
      output: 'Available terminal commands:\n  tui — open launcher',
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
      name: 'tui',
      description: 'open tui',
      kind: 'tui',
      output: 'opening TUI launcher ...',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 3,
    },
    {
      name: 'menu',
      description: 'open menu',
      kind: 'navigate',
      output: 'opening /menu ...',
      targetRoute: '/menu',
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

function makeKey(
  overrides: Partial<{
    key: string;
    code: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
  }>,
) {
  return {
    key: '',
    code: '',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...overrides,
  };
}

describe('terminalPaneTree', () => {
  it('supports splitting, directional focus, relative cycling, resizing, equalizing, zooming, and closing', () => {
    let state = createInitialWorkspaceState();
    expect(listLeafPanes(state.root)).toHaveLength(1);

    // Split right: pane-1 | pane-2 (active: pane-2)
    state = splitActivePane(state, 'right');
    expect(listLeafPanes(state.root).map(p => p.id)).toEqual(['pane-1', 'pane-2']);
    expect(state.activePaneId).toBe('pane-2');

    // Split down on right side: pane-1 | (pane-2 / pane-3) (active: pane-3)
    state = splitActivePane(state, 'down');
    expect(listLeafPanes(state.root).map(p => p.id)).toEqual(['pane-1', 'pane-2', 'pane-3']);
    expect(state.activePaneId).toBe('pane-3');

    // Directional focus up goes from pane-3 -> pane-2; left goes from pane-2 -> pane-1
    state = focusDirectionalPane(state, 'up');
    expect(state.activePaneId).toBe('pane-2');
    state = focusDirectionalPane(state, 'left');
    expect(state.activePaneId).toBe('pane-1');
    state = focusDirectionalPane(state, 'right');
    expect(['pane-2', 'pane-3']).toContain(state.activePaneId);

    // Relative cycling wraps cleanly
    state = focusRelativePane(state, 1);
    const afterNext = state.activePaneId;
    state = focusRelativePane(state, -1);
    expect(state.activePaneId).not.toBe(afterNext);

    // Resize active split and equalize back to 0.5
    state = resizeActiveSplit(state, 'right', 0.1);
    expect(state.root).toMatchObject({ type: 'split', ratio: 0.6 });
    state = equalizeAllSplits(state);
    expect(state.root).toMatchObject({ type: 'split', ratio: 0.5 });

    // Zoom toggle
    state = toggleZoomActivePane(state);
    expect(state.zoomedPaneId).toBe(state.activePaneId);
    state = toggleZoomActivePane(state);
    expect(state.zoomedPaneId).toBeNull();

    // Independent per-pane TUI state
    state = setPaneTuiOpen(state, 'pane-1', true);
    expect(findLeafPane(state.root, 'pane-1')?.tuiOpen).toBe(true);
    expect(findLeafPane(state.root, 'pane-2')?.tuiOpen).toBe(false);

    // Closing collapses tree and refuses to close final pane
    state = closePaneById(state, 'pane-3');
    state = closePaneById(state, 'pane-2');
    expect(listLeafPanes(state.root).map(p => p.id)).toEqual(['pane-1']);
    state = closePaneById(state, 'pane-1');
    expect(listLeafPanes(state.root).map(p => p.id)).toEqual(['pane-1']);
  });

  it('matches Ghostty and ghostty-union macOS and Linux split keybindings', () => {
    expect(matchGhosttyShortcut(makeKey({ key: 'd', metaKey: true }))).toEqual({
      type: 'split',
      direction: 'right',
    });
    expect(matchGhosttyShortcut(makeKey({ key: 'O', ctrlKey: true, shiftKey: true }))).toEqual({
      type: 'split',
      direction: 'right',
    });
    expect(
      matchGhosttyShortcut(
        makeKey({ key: '}', code: 'BracketRight', ctrlKey: true, shiftKey: true }),
      ),
    ).toEqual({
      type: 'split',
      direction: 'right',
    });
    expect(
      matchGhosttyShortcut(
        makeKey({ key: ']', code: 'BracketRight', ctrlKey: true, shiftKey: true }),
      ),
    ).toEqual({
      type: 'split',
      direction: 'right',
    });
    expect(matchGhosttyShortcut(makeKey({ key: 'd', metaKey: true, shiftKey: true }))).toEqual({
      type: 'split',
      direction: 'down',
    });
    expect(matchGhosttyShortcut(makeKey({ key: 'E', ctrlKey: true, shiftKey: true }))).toEqual({
      type: 'split',
      direction: 'down',
    });
    expect(
      matchGhosttyShortcut(
        makeKey({ key: '{', code: 'BracketLeft', ctrlKey: true, shiftKey: true }),
      ),
    ).toEqual({
      type: 'split',
      direction: 'down',
    });
    expect(
      matchGhosttyShortcut(
        makeKey({ key: '[', code: 'BracketLeft', ctrlKey: true, shiftKey: true }),
      ),
    ).toEqual({
      type: 'split',
      direction: 'down',
    });
    expect(matchGhosttyShortcut(makeKey({ key: ']', metaKey: true }))).toEqual({
      type: 'focus-relative',
      delta: 1,
    });
    expect(matchGhosttyShortcut(makeKey({ key: '[', metaKey: true }))).toEqual({
      type: 'focus-relative',
      delta: -1,
    });
    expect(
      matchGhosttyShortcut(makeKey({ key: 'ArrowLeft', ctrlKey: true, altKey: true })),
    ).toEqual({
      type: 'focus-direction',
      direction: 'left',
    });
    expect(
      matchGhosttyShortcut(makeKey({ key: 'ArrowRight', metaKey: true, altKey: true })),
    ).toEqual({
      type: 'focus-direction',
      direction: 'right',
    });
    expect(
      matchGhosttyShortcut(makeKey({ key: 'ArrowRight', altKey: true, shiftKey: true })),
    ).toEqual({
      type: 'resize',
      direction: 'right',
    });
    expect(matchGhosttyShortcut(makeKey({ key: 'ArrowUp', altKey: true, shiftKey: true }))).toEqual(
      {
        type: 'resize',
        direction: 'up',
      },
    );
    expect(matchGhosttyShortcut(makeKey({ key: 'Enter', metaKey: true, shiftKey: true }))).toEqual({
      type: 'toggle-zoom',
    });
    expect(matchGhosttyShortcut(makeKey({ key: '+', ctrlKey: true, shiftKey: true }))).toEqual({
      type: 'equalize',
    });
    expect(
      matchGhosttyShortcut(
        makeKey({ key: 'E', code: 'KeyE', ctrlKey: true, altKey: true, shiftKey: true }),
      ),
    ).toEqual({
      type: 'equalize',
    });
    expect(matchGhosttyShortcut(makeKey({ key: 'W', ctrlKey: true, shiftKey: true }))).toEqual({
      type: 'close-pane',
    });
    expect(matchGhosttyShortcut(makeKey({ key: 't', altKey: true }))).toEqual({
      type: 'toggle-tui',
    });
    expect(matchGhosttyShortcut(makeKey({ key: 'm', altKey: true }))).toEqual({
      type: 'open-menu',
    });
  });
});

describe('TerminalWorkspace', () => {
  it('opens split terminals via Ghostty keybindings, runs independent per-pane TUIs, preserves scrollback across zoom, and closes panes', () => {
    const navigate = vi.fn<(to: string) => void>();
    const { container } = render(
      <TerminalWorkspace
        terminal={TERMINAL_FIXTURE}
        navigate={navigate}
        renderTui={({ ttyNumber, closeTui }) => (
          <TuiWindow title={`tui :: tty${ttyNumber}`} closeOnEscape={false} onClose={closeTui}>
            <div>Launcher inside tty{ttyNumber}</div>
          </TuiWindow>
        )}
      />,
    );

    const workspaceEl = container.querySelector('[data-pane-count]') as HTMLElement;
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');

    // Run a command in tty1 so we can verify its scrollback survives zoom/unzoom
    const pane1Input = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    fireEvent.change(pane1Input, { target: { value: 'whoami' } });
    fireEvent.submit(pane1Input.closest('form') as HTMLFormElement);
    expect(screen.getByText('guest@andrew-k.us (tty1)')).toBeTruthy();

    // Ghostty Cmd+D splits right into tty2 and focuses tty2
    fireEvent.keyDown(window, { key: 'd', metaKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');

    const pane2 = container.querySelector('[data-pane-tty="tty2"]') as HTMLElement;
    expect(pane2.getAttribute('data-active')).toBe('true');

    // Open a TUI inside tty2 via `tui` command
    const activeInput = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    fireEvent.change(activeInput, { target: { value: 'tui' } });
    fireEvent.submit(activeInput.closest('form') as HTMLFormElement);
    expect(within(pane2).getByText('Launcher inside tty2')).toBeTruthy();

    // Switch back to tty1 via Ghostty Ctrl+Alt+ArrowLeft and open its own TUI via Alt+T
    fireEvent.keyDown(window, { key: 'ArrowLeft', ctrlKey: true, altKey: true });
    const pane1 = container.querySelector('[data-pane-tty="tty1"]') as HTMLElement;
    expect(pane1.getAttribute('data-active')).toBe('true');

    fireEvent.keyDown(window, { key: 't', altKey: true });
    expect(within(pane1).getByText('Launcher inside tty1')).toBeTruthy();
    expect(within(pane2).getByText('Launcher inside tty2')).toBeTruthy();

    // Pressing Escape closes ONLY active pane's (tty1) TUI while tty2's TUI stays open
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(within(pane1).queryByText('Launcher inside tty1')).toBeNull();
    expect(within(pane2).getByText('Launcher inside tty2')).toBeTruthy();

    // Zoom tty2 via Ghostty Ctrl+Shift+Enter, then unzoom and verify tty1 scrollback survived
    fireEvent.keyDown(window, { key: ']', metaKey: true });
    expect(pane2.getAttribute('data-active')).toBe('true');
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-zoomed')).toBe('true');
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-zoomed')).toBe('false');
    expect(within(pane1).getByText('guest@andrew-k.us (tty1)')).toBeTruthy();

    // Close active split pane (tty2) via Ghostty Ctrl+Shift+W
    fireEvent.keyDown(window, { key: 'W', ctrlKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');

    // Help output mentions split keybindings without zsh/p10k leakage
    const remainingInput = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    fireEvent.change(remainingInput, { target: { value: 'help' } });
    fireEvent.submit(remainingInput.closest('form') as HTMLFormElement);
    expect(screen.getByText(/Split panes \(Ghostty keybindings & commands\)/i)).toBeTruthy();
    expect(container.textContent).not.toMatch(/\bzsh\b|p10k|powerlevel10k/i);

    // Alt+M still navigates to /menu
    fireEvent.keyDown(window, { key: 'm', altKey: true });
    expect(navigate).toHaveBeenCalledWith('/menu');
  });

  it('runs interactive contact form inline in terminal mode with fieldset headers, :back, Escape guard, Shift+Enter textarea, drag-and-drop file, review edit, and Postgres receipt', async () => {
    const { CONTACT_FORM_DEFINITION } = await import('@aklapper/core');
    const navigate = vi.fn<(to: string) => void>();
    const openTuiRoute = vi.fn<() => void>();
    const submit = vi.fn<(fd: FormData) => Promise<import('@aklapper/core').ContactActionResult>>(
      async fd => ({
        ok: true,
        submission: {
          id: '55555555-5555-4555-8555-555555555555',
          name: String(fd.get('name') ?? ''),
          email: String(fd.get('email') ?? ''),
          phone: (fd.get('phone') as string) || null,
          attachmentName: fd.get('file') instanceof File ? (fd.get('file') as File).name : null,
          attachmentSizeBytes:
            fd.get('file') instanceof File ? (fd.get('file') as File).size : null,
          attachmentSha256: fd.get('file') instanceof File ? 'a'.repeat(64) : null,
          createdAt: '2026-11-24T15:00:00.000Z',
        },
      }),
    );

    const { container } = render(
      <TerminalWorkspace
        terminal={TERMINAL_FIXTURE}
        navigate={navigate}
        terminalForms={{
          contact: {
            definition: CONTACT_FORM_DEFINITION,
            openTuiRoute,
            submit,
          },
        }}
      />,
    );

    const submitLine = (value: string) => {
      const el = screen.getByLabelText('Terminal command input') as
        | HTMLInputElement
        | HTMLTextAreaElement;
      fireEvent.change(el, { target: { value } });
      fireEvent.submit(el.closest('form') as HTMLFormElement);
    };

    // Start interactive `contact` — stays in terminal mode without navigating or opening TUI
    submitLine('contact');
    expect(navigate).not.toHaveBeenCalled();
    expect(openTuiRoute).not.toHaveBeenCalled();
    expect(container.querySelector('[data-form-mode="contact"]')).toBeTruthy();
    expect(screen.getByText(/┌─ 01 \/\/ Sender Identity/)).toBeTruthy();

    // Validation error on empty required Name
    submitLine('');
    expect(screen.getByText(/✖ Name is required/)).toBeTruthy();

    // Drag-and-drop file onto pane while on Name step attaches without wiping current input
    const nameInput = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Ada' } });
    const droppedFile = new File(['engine notes'], 'notes.txt', { type: 'text/plain' });
    const section = container.querySelector('section[data-form-mode="contact"]') as HTMLElement;
    fireEvent.drop(section, { dataTransfer: { files: [droppedFile] } });
    expect(screen.getByText(/▸ attached notes\.txt/i)).toBeTruthy();
    expect(nameInput.value).toBe('Ada');

    // Complete Name and Email, test :back, then Phone (optional skip)
    submitLine('Ada Lovelace');
    submitLine('ada@typo.example');
    submitLine(':back');
    expect(screen.getByText(/↩ Back to Email/i)).toBeTruthy();
    submitLine('ada@example.com');
    expect(screen.getByText(/├─ 01\.1 \/\/ Optional Callback Channel/)).toBeTruthy();
    submitLine('');

    // Message step switches to <textarea>, ignores Escape so draft survives, Enter submits
    expect(screen.getByText(/┌─ 02 \/\/ Message & Attachment/)).toBeTruthy();
    const textarea = screen.getByLabelText('Terminal command input') as HTMLTextAreaElement;
    expect(textarea.tagName).toBe('TEXTAREA');
    fireEvent.change(textarea, { target: { value: 'Line 1\nLine 2 message body' } });
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(textarea.value).toBe('Line 1\nLine 2 message body');
    fireEvent.keyDown(textarea, { key: 'Enter' });

    // File step shows existing dragged attachment and inline [attach file] button; Enter keeps it
    expect(screen.getByRole('button', { name: '[attach file]' })).toBeTruthy();
    submitLine('');

    // Review summary allows editing a field (`e email`) then confirming (`y`)
    expect(screen.getByText(/┌─ Review Transmission \/\/ Ready for PostgreSQL 19/)).toBeTruthy();
    submitLine('e email');
    submitLine('ada.final@example.com');
    submitLine('y');

    const receiptEl = await screen.findByText(/TRANSMISSION COMMITTED \/\/ POSTGRES 19/);
    expect(receiptEl.textContent).toContain('Ada Lovelace <ada.final@example.com>');
    expect(receiptEl.textContent).toContain('notes.txt');
    expect(submit).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-form-mode="contact"]')).toBeNull();
  });

  it('supports one-shot CLI flags, --help, --tui, Ctrl+C cancel, 422 DB error recovery, and split-pane isolation', async () => {
    const { CONTACT_FORM_DEFINITION } = await import('@aklapper/core');
    const openTuiRoute = vi.fn<() => void>();
    const submit = vi
      .fn<(fd: FormData) => Promise<import('@aklapper/core').ContactActionResult>>()
      .mockResolvedValueOnce({
        ok: false,
        source: 'database',
        formError: 'Database constraint rejected Email format.',
        fieldErrors: { email: ['Database constraint rejected Email format.'] },
      })
      .mockResolvedValueOnce({
        ok: true,
        submission: {
          id: '66666666-6666-4666-8666-666666666666',
          name: 'Grace Hopper',
          email: 'grace@example.com',
          phone: null,
          attachmentName: null,
          attachmentSizeBytes: null,
          attachmentSha256: null,
          createdAt: '2026-11-24T15:30:00.000Z',
        },
      });

    const { container } = render(
      <TerminalWorkspace
        terminal={TERMINAL_FIXTURE}
        terminalForms={{
          contact: {
            definition: CONTACT_FORM_DEFINITION,
            openTuiRoute,
            submit,
          },
        }}
      />,
    );

    const submitActive = (value: string) => {
      const el = screen.getByLabelText('Terminal command input', { exact: true }) as
        | HTMLInputElement
        | HTMLTextAreaElement;
      fireEvent.change(el, { target: { value } });
      fireEvent.submit(el.closest('form') as HTMLFormElement);
    };

    // --help prints usage; --tui opens TUI route
    submitActive('contact --help');
    expect(screen.getByText(/Usage: contact \[options]/i)).toBeTruthy();

    submitActive('contact --tui');
    expect(openTuiRoute).toHaveBeenCalledTimes(1);

    // One-shot flags hit mocked 422 DB error -> re-prompts ONLY failing `email` field
    submitActive(
      'contact --name "Grace Hopper" --email "grace@bad.example" --message "Testing 422 database error recovery."',
    );
    expect(
      await screen.findByText(/\[database] Database constraint rejected Email format\./),
    ).toBeTruthy();
    const retryInput = screen.getByLabelText('Terminal command input', {
      exact: true,
    }) as HTMLInputElement;
    expect(retryInput.getAttribute('data-form-field')).toBe('email');

    // Fix email -> review -> send -> 201 receipt
    submitActive('grace@example.com');
    submitActive('y');
    expect(await screen.findByText(/TRANSMISSION COMMITTED \/\/ POSTGRES 19/)).toBeTruthy();
    expect(submit).toHaveBeenCalledTimes(2);

    // Split pane isolation: start `contact` in tty2 only; tty1 stays in normal shell mode; Ctrl+C cancels tty2
    fireEvent.keyDown(window, { key: 'd', metaKey: true });
    submitActive('contact');
    const pane1 = container.querySelector('[data-pane-tty="tty1"]') as HTMLElement;
    const pane2 = container.querySelector('[data-pane-tty="tty2"]') as HTMLElement;
    expect(pane1.querySelector('[data-form-mode="contact"]')).toBeNull();
    expect(pane2.querySelector('[data-form-mode="contact"]')).toBeTruthy();

    const pane2Input = within(pane2).getByLabelText('Terminal command input', {
      exact: true,
    }) as HTMLInputElement;
    fireEvent.keyDown(pane2Input, { key: 'c', ctrlKey: true });
    expect(within(pane2).getByText('Transmission cancelled.')).toBeTruthy();
    expect(pane2.querySelector('[data-form-mode="contact"]')).toBeNull();
  });

  it('splits a separate terminal pane from a TUI primary view, isolates Escape to the active pane, and protects the pinned route pane', () => {
    const onClosePrimaryTui = vi.fn<() => void>();
    const { container } = render(
      <TerminalWorkspace
        terminal={TERMINAL_FIXTURE}
        renderTui={({ ttyNumber, closeTui }) => (
          <TuiWindow title={`overlay :: tty${ttyNumber}`} closeOnEscape={false} onClose={closeTui}>
            <div>Overlay inside tty{ttyNumber}</div>
          </TuiWindow>
        )}
        primaryPane={{
          title: 'tui :: /contact',
          content: (
            <TuiWindow title='Contact TUI' onClose={onClosePrimaryTui}>
              <div>Contact Form Surface</div>
            </TuiWindow>
          ),
        }}
      />,
    );

    const workspaceEl = container.querySelector('[data-pane-count]') as HTMLElement;
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');
    expect(screen.getByText('Contact Form Surface')).toBeTruthy();

    // Ghostty physical KeyD (e.g. macOS Option+Shift+D) splits right from the TUI view
    fireEvent.keyDown(window, { key: 'Î', code: 'KeyD', altKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');
    expect(screen.getByText('Contact Form Surface')).toBeTruthy();

    const pane2 = container.querySelector('[data-pane-tty="tty2"]') as HTMLElement;
    expect(pane2.getAttribute('data-active')).toBe('true');

    // Pressing Escape while tty2 is focused does NOT close the primary TUI window in pane-1
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClosePrimaryTui).not.toHaveBeenCalled();

    // Spawned tty2 pane can open its own TUI via Alt+T and close ONLY its own overlay on Escape
    fireEvent.keyDown(window, { key: 't', altKey: true });
    expect(within(pane2).getByText('Overlay inside tty2')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(within(pane2).queryByText('Overlay inside tty2')).toBeNull();
    expect(onClosePrimaryTui).not.toHaveBeenCalled();

    // Switch focus back to pane-1 via Ghostty Ctrl+Alt+ArrowLeft; trying to close pinned pane-1 is ignored
    fireEvent.keyDown(window, { key: 'ArrowLeft', ctrlKey: true, altKey: true });
    const pane1 = container.querySelector('[data-pane-id="pane-1"]') as HTMLElement;
    expect(pane1.getAttribute('data-active')).toBe('true');
    fireEvent.keyDown(window, { key: 'W', ctrlKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');

    // Now Escape closes the primary TUI because pane-1 is active
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClosePrimaryTui).toHaveBeenCalledTimes(1);

    // Switch back to tty2 and close it via Ghostty Cmd+Shift+W
    fireEvent.keyDown(window, { key: ']', metaKey: true });
    fireEvent.keyDown(window, { key: 'w', metaKey: true, shiftKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');
  });

  it('delegates cleanly without double-splitting when an embedded TerminalWorkspace mounts inside primaryPane', () => {
    const { container } = render(
      <TerminalWorkspace
        terminal={TERMINAL_FIXTURE}
        primaryPane={{
          title: 'tty1',
          flush: true,
          embeddedTerminal: true,
          content: <TerminalWorkspace terminal={TERMINAL_FIXTURE} />,
        }}
      />,
    );

    const workspaces = container.querySelectorAll('[data-pane-count]');
    expect(workspaces).toHaveLength(1);
    const workspaceEl = workspaces[0] as HTMLElement;

    // One Ghostty Cmd+D splits into exactly 2 panes (no nested double-handling)
    fireEvent.keyDown(window, { key: 'd', metaKey: true });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');
  });

  it('splits horizontally and vertically via ghostty-union Ctrl+Shift+} and Ctrl+Shift+{ on terminal and TUI windows, resizes with Alt+Shift+Arrow, and equalizes with Ctrl+Alt+Shift+E', () => {
    const { container } = render(
      <TerminalWorkspace
        terminal={TERMINAL_FIXTURE}
        primaryPane={{
          title: 'tui :: /menu',
          content: (
            <TuiWindow title='Menu TUI'>
              <div>Menu Surface</div>
            </TuiWindow>
          ),
        }}
      />,
    );

    const workspaceEl = container.querySelector('[data-pane-count]') as HTMLElement;
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');

    // Ctrl+Shift+} splits right (side-by-side) directly from the TUI window
    fireEvent.keyDown(window, {
      key: '}',
      code: 'BracketRight',
      ctrlKey: true,
      shiftKey: true,
    });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');

    // Key-repeat while holding Ctrl+Shift+} does not spawn duplicate panes
    fireEvent.keyDown(window, {
      key: '}',
      code: 'BracketRight',
      ctrlKey: true,
      shiftKey: true,
      repeat: true,
    });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');

    const slotsAfterRight = Array.from(container.querySelectorAll('[data-pane-id]')).map(
      el => el.parentElement as HTMLElement,
    );
    expect(slotsAfterRight[0]?.style.getPropertyValue('--sf-pane-w')).toBe('0.5');
    expect(slotsAfterRight[1]?.style.getPropertyValue('--sf-pane-x')).toBe('0.5');
    expect(slotsAfterRight[1]?.style.getPropertyValue('--sf-pane-w')).toBe('0.5');

    // Alt+Shift+ArrowRight resizes active vertical split; Ctrl+Alt+Shift+E equalizes back to 0.5
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true, shiftKey: true });
    expect(slotsAfterRight[0]?.style.getPropertyValue('--sf-pane-w')).toBe('0.55');
    fireEvent.keyDown(window, {
      key: 'E',
      code: 'KeyE',
      ctrlKey: true,
      altKey: true,
      shiftKey: true,
    });
    expect(slotsAfterRight[0]?.style.getPropertyValue('--sf-pane-w')).toBe('0.5');

    // Ctrl+Shift+{ splits the active terminal pane (tty2) vertically (stacked top/bottom)
    fireEvent.keyDown(window, {
      key: '{',
      code: 'BracketLeft',
      ctrlKey: true,
      shiftKey: true,
    });
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('3');

    const pane2Slot = container.querySelector('[data-pane-tty="tty2"]')
      ?.parentElement as HTMLElement;
    const pane3Slot = container.querySelector('[data-pane-tty="tty3"]')
      ?.parentElement as HTMLElement;
    expect(pane2Slot.style.getPropertyValue('--sf-pane-y')).toBe('0');
    expect(pane2Slot.style.getPropertyValue('--sf-pane-h')).toBe('0.5');
    expect(pane3Slot.style.getPropertyValue('--sf-pane-y')).toBe('0.5');
    expect(pane3Slot.style.getPropertyValue('--sf-pane-h')).toBe('0.5');
  });
});
