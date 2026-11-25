import {
  FormDefinitionSchema,
  type ContactActionResult,
  type TerminalProfileData,
} from '@aklapper/core';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TerminalWorkspace, ZshP10kTerminal, type TerminalFormConfig } from '../src';

const BASE_TERMINAL: TerminalProfileData = {
  slug: 'portal-home',
  bannerTitle: 'Solar Forge Terminal // tty1',
  bannerMeta: 'tty1 · interactive shell',
  osLabel: '⚡',
  directory: '~/projects/aklapper',
  vcsBranch: 'portfolio_v2',
  vcsState: 'clean',
  contextLabel: 'guest@andrew-k.us',
  placeholder: 'type a command',
  quickCommands: ['status', 'clear'],
  initialEntries: [
    {
      command: 'boot',
      output: 'INITIAL_SCROLLBACK_LINE',
      status: 'ok',
      durationLabel: '2ms',
      timestamp: '00:00:00',
      sortOrder: 0,
    },
  ],
  commands: [
    {
      name: 'ls',
      description: 'list directory',
      kind: 'static',
      output: 'menu/ ask/',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 1,
    },
    {
      name: 'status',
      description: 'cluster status',
      kind: 'static',
      output: 'all systems nominal',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 2,
    },
    {
      name: 'clear',
      description: 'clear scrollback',
      kind: 'clear',
      output: '',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 3,
    },
  ],
};

function dispatchWindowKey(
  init: KeyboardEventInit & { readonly isComposing?: boolean },
  target: EventTarget = window,
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  if (init.isComposing !== undefined) {
    Object.defineProperty(event, 'isComposing', { value: init.isComposing });
  }
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

describe('TerminalWorkspace preventDefault containment and pass-through', () => {
  it('calls preventDefault unconditionally on disabled single-pane and single-tab shortcuts with zero state delta', () => {
    const { container } = render(<TerminalWorkspace terminal={BASE_TERMINAL} />);
    const workspaceEl = container.querySelector('[data-pane-count]') as HTMLElement;
    const input = screen.getByLabelText('Terminal command input') as HTMLInputElement;

    const disabledChords: readonly KeyboardEventInit[] = [
      { key: ']', code: 'BracketRight', altKey: true },
      { key: '[', code: 'BracketLeft', altKey: true },
      { key: '!', code: 'Digit1', altKey: true, shiftKey: true },
      { key: 'R', code: 'KeyR', altKey: true, shiftKey: true },
      { key: 'ArrowRight', code: 'ArrowRight', altKey: true, shiftKey: true },
      { key: 'T', code: 'KeyT', ctrlKey: true, altKey: true, shiftKey: true },
    ];

    for (const chord of disabledChords) {
      const event = dispatchWindowKey(chord, input);
      expect(event.defaultPrevented).toBe(true);
    }

    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('1');
    expect(input.value).toBe('');
  });

  it('passes standard browser shortcuts and removed Chrome-hijacked chords through with defaultPrevented false', () => {
    const { container } = render(<TerminalWorkspace terminal={BASE_TERMINAL} />);
    const workspaceEl = container.querySelector('[data-pane-count]') as HTMLElement;
    const input = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'hello world' } });

    const passthroughChords: readonly KeyboardEventInit[] = [
      { key: 'I', code: 'KeyI', ctrlKey: true, shiftKey: true },
      { key: 'r', code: 'KeyR', metaKey: true },
      { key: 'r', code: 'KeyR', ctrlKey: true },
      { key: 'R', code: 'KeyR', ctrlKey: true, shiftKey: true },
      { key: 'l', code: 'KeyL', metaKey: true },
      { key: 'w', code: 'KeyW', ctrlKey: true },
      { key: 'n', code: 'KeyN', ctrlKey: true },
      { key: '1', code: 'Digit1', altKey: true },
      { key: 'T', code: 'KeyT', altKey: true, shiftKey: true },
      { key: 'A', code: 'KeyA', altKey: true, shiftKey: true },
      { key: 'O', code: 'KeyO', ctrlKey: true, shiftKey: true },
      { key: 'd', code: 'KeyD', metaKey: true },
    ];

    for (const chord of passthroughChords) {
      const event = dispatchWindowKey(chord, input);
      expect(event.defaultPrevented).toBe(false);
    }

    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');
    expect(workspaceEl.getAttribute('data-tab-count')).toBe('1');
    expect(input.value).toBe('hello world');
  });

  it('guards F2 rename-tab when an interactive popup is open or focus is in a non-terminal input', () => {
    render(
      <div>
        <input aria-label='External search field' />
        <TerminalWorkspace
          terminal={BASE_TERMINAL}
          renderPaneView={({ viewId }) => (
            <div>
              <span>Docked View {viewId}</span>
              <button type='button' aria-haspopup='listbox' data-popup-open=''>
                Open Menu Trigger
              </button>
            </div>
          )}
          initialPrimaryTuiStack={['/menu']}
          primaryPane={{
            title: 'primary',
            content: <div />,
            embeddedTerminal: true,
          }}
        />
      </div>,
    );

    // While an interactive popup is open, F2 must not preventDefault or enter rename mode
    const popupF2 = dispatchWindowKey({ key: 'F2', code: 'F2' });
    expect(popupF2.defaultPrevented).toBe(false);
    expect(screen.queryByLabelText('Rename tab')).toBeNull();

    // Remove open popup attribute and focus an external non-terminal input
    const trigger = screen.getByText('Open Menu Trigger');
    trigger.removeAttribute('data-popup-open');
    const externalInput = screen.getByLabelText('External search field') as HTMLInputElement;
    externalInput.focus();
    const externalF2 = dispatchWindowKey({ key: 'F2', code: 'F2' }, externalInput);
    expect(externalF2.defaultPrevented).toBe(false);
    expect(screen.queryByLabelText('Rename tab')).toBeNull();

    // When focus is inside the workspace (non-editable), F2 enters tab-rename mode
    trigger.focus();
    const workspaceF2 = dispatchWindowKey({ key: 'F2', code: 'F2' }, trigger);
    expect(workspaceF2.defaultPrevented).toBe(true);
    expect(screen.getByLabelText('Rename tab')).toBeTruthy();
  });
});

describe('TerminalWorkspace capture-level readline dispatch and isolation', () => {
  it('captures readline shortcuts when focus is on the tab strip or pane header and returns focus to input', () => {
    render(<TerminalWorkspace terminal={BASE_TERMINAL} />);
    const input = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    const form = input.closest('form') as HTMLFormElement;

    // Seed history: ["status", "ls"] (newest first)
    fireEvent.change(input, { target: { value: 'ls' } });
    fireEvent.submit(form);
    fireEvent.change(input, { target: { value: 'status' } });
    fireEvent.submit(form);

    // Type prompt and move focus to the tab strip (blurring terminal input)
    fireEvent.change(input, { target: { value: 'alpha beta gamma' } });
    input.setSelectionRange(16, 16);
    const tabButton = screen.getByRole('tab');
    tabButton.focus();
    expect(document.activeElement).toBe(tabButton);

    // Alt+Backspace deletes last word
    const altBs = dispatchWindowKey(
      { key: 'Backspace', code: 'Backspace', altKey: true },
      tabButton,
    );
    expect(altBs.defaultPrevented).toBe(true);
    expect(input.value).toBe('alpha beta ');
    expect(document.activeElement).toBe(input);

    // Move focus back to tab and test Ctrl+K at caret 5
    input.setSelectionRange(5, 5);
    tabButton.focus();
    const ctrlK = dispatchWindowKey({ key: 'k', code: 'KeyK', ctrlKey: true }, tabButton);
    expect(ctrlK.defaultPrevented).toBe(true);
    expect(input.value).toBe('alpha');

    // Move focus back to tab and test Ctrl+U at caret 2
    input.setSelectionRange(2, 2);
    tabButton.focus();
    const ctrlU = dispatchWindowKey({ key: 'u', code: 'KeyU', ctrlKey: true }, tabButton);
    expect(ctrlU.defaultPrevented).toBe(true);
    expect(input.value).toBe('pha');

    // History navigation via Alt+P, Ctrl+P, and macOS Alt+N (even with isComposing: true / key: "Dead")
    tabButton.focus();
    const altP = dispatchWindowKey({ key: 'p', code: 'KeyP', altKey: true }, tabButton);
    expect(altP.defaultPrevented).toBe(true);
    expect(input.value).toBe('status');

    tabButton.focus();
    const ctrlP = dispatchWindowKey({ key: 'p', code: 'KeyP', ctrlKey: true }, tabButton);
    expect(ctrlP.defaultPrevented).toBe(true);
    expect(input.value).toBe('ls');

    tabButton.focus();
    const macAltN = dispatchWindowKey(
      { key: 'Dead', code: 'KeyN', altKey: true, isComposing: true },
      tabButton,
    );
    expect(macAltN.defaultPrevented).toBe(true);
    expect(input.value).toBe('status');

    // Ctrl+L clears scrollback from non-input focus
    expect(screen.getByText('INITIAL_SCROLLBACK_LINE')).toBeTruthy();
    tabButton.focus();
    const ctrlL = dispatchWindowKey({ key: 'l', code: 'KeyL', ctrlKey: true }, tabButton);
    expect(ctrlL.defaultPrevented).toBe(true);
    expect(screen.queryByText('INITIAL_SCROLLBACK_LINE')).toBeNull();
  });

  it('captures readline shortcuts for standalone ZshP10kTerminal rendered inside primaryPane.content without embeddedTerminal', () => {
    render(
      <TerminalWorkspace
        terminal={BASE_TERMINAL}
        primaryPane={{
          title: 'maintenance',
          content: (
            <div>
              <button type='button'>Maintenance Heading Focus Target</button>
              <ZshP10kTerminal
                bannerTitle='Maintenance Terminal'
                bannerMeta='readonly'
                osLabel='⚡'
                directory='~'
                vcsBranch='main'
                vcsState='clean'
                contextLabel='guest@andrew-k.us'
                placeholder='type a command'
                initialEntries={[
                  {
                    command: 'status',
                    output: 'MAINTENANCE_SCROLLBACK_ENTRY',
                    status: 'ok',
                    durationLabel: '1ms',
                    timestamp: '00:00:00',
                  },
                ]}
                commands={{}}
                quickCommands={[]}
              />
            </div>
          ),
        }}
      />,
    );

    expect(screen.getByText('MAINTENANCE_SCROLLBACK_ENTRY')).toBeTruthy();
    const headingButton = screen.getByText('Maintenance Heading Focus Target');
    headingButton.focus();

    const ctrlL = dispatchWindowKey({ key: 'l', code: 'KeyL', ctrlKey: true }, headingButton);
    expect(ctrlL.defaultPrevented).toBe(true);
    expect(screen.queryByText('MAINTENANCE_SCROLLBACK_ENTRY')).toBeNull();
  });

  it('never mutates hidden shellLayer terminal when a docked TUI view is active', () => {
    render(
      <TerminalWorkspace
        terminal={BASE_TERMINAL}
        renderPaneView={({ viewId }) => (
          <div>
            <button type='button'>Docked View {viewId}</button>
          </div>
        )}
      />,
    );

    const input = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'preserved-input' } });
    expect(screen.getByText('INITIAL_SCROLLBACK_LINE')).toBeTruthy();

    // Open docked TUI view over the terminal (shellLayer becomes hidden + inert)
    dispatchWindowKey({ key: 't', code: 'KeyT', altKey: true });
    expect(screen.getByText('Docked View tui')).toBeTruthy();

    // Dispatch Ctrl+L and Ctrl+U while docked TUI is active
    const tuiBtn = screen.getByText('Docked View tui');
    tuiBtn.focus();
    dispatchWindowKey({ key: 'l', code: 'KeyL', ctrlKey: true }, tuiBtn);
    dispatchWindowKey({ key: 'u', code: 'KeyU', ctrlKey: true }, tuiBtn);

    // Exit docked TUI via Escape and confirm hidden terminal was untouched
    dispatchWindowKey({ key: 'Escape', code: 'Escape' }, tuiBtn);
    expect(screen.getByText('INITIAL_SCROLLBACK_LINE')).toBeTruthy();
    expect((screen.getByLabelText('Terminal command input') as HTMLInputElement).value).toBe(
      'preserved-input',
    );
  });

  it('enforces formSession and isSubmittingForm guards without dual execution', async () => {
    let resolveSubmit!: (value: ContactActionResult) => void;
    const submit = vi.fn<() => Promise<ContactActionResult>>(
      () =>
        new Promise<ContactActionResult>(resolve => {
          resolveSubmit = resolve;
        }),
    );

    const formConfig: TerminalFormConfig = {
      definition: FormDefinitionSchema.parse({
        id: 'contact',
        slug: 'contact',
        title: 'Contact Form',
        description: 'Contact test form',
        cliCommand: 'contact',
        submitLabel: 'Send',
        resetLabel: 'Reset',
        nodes: [
          {
            kind: 'field',
            fieldType: 'text',
            id: 'contact-name',
            name: 'name',
            label: 'Name',
            cliFlag: '--name',
            required: true,
          },
        ],
      }),
      submit,
    };

    render(<TerminalWorkspace terminal={BASE_TERMINAL} terminalForms={{ contact: formConfig }} />);

    const input = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    const form = input.closest('form') as HTMLFormElement;

    // Enter contact formSession
    fireEvent.change(input, { target: { value: 'contact' } });
    fireEvent.submit(form);

    // Type in form input and verify Ctrl+U / Alt+Backspace are suppressed during formSession
    fireEvent.change(input, { target: { value: 'Andrew Klapper' } });
    input.setSelectionRange(14, 14);
    dispatchWindowKey({ key: 'u', code: 'KeyU', ctrlKey: true }, input);
    dispatchWindowKey({ key: 'Backspace', code: 'Backspace', altKey: true }, input);
    expect(input.value).toBe('Andrew Klapper');

    // Selection-aware Ctrl+C inside formSession must preserve copy when window selection is non-empty
    const getSelectionSpy = vi
      .spyOn(window, 'getSelection')
      .mockReturnValue({ toString: () => 'Contact Form' } as Selection);
    const formCtrlC = dispatchWindowKey({ key: 'c', code: 'KeyC', ctrlKey: true }, input);
    expect(formCtrlC.defaultPrevented).toBe(false);
    expect(input.value).toBe('Andrew Klapper');
    getSelectionSpy.mockRestore();

    // Advance to review and submit so isSubmittingForm becomes true
    fireEvent.submit(form);
    fireEvent.change(input, { target: { value: 'y' } });
    fireEvent.submit(form);
    expect(input.disabled).toBe(true);

    // Ctrl+L still clears scrollback while isSubmittingForm is true
    expect(screen.getByText('INITIAL_SCROLLBACK_LINE')).toBeTruthy();
    dispatchWindowKey({ key: 'l', code: 'KeyL', ctrlKey: true });
    expect(screen.queryByText('INITIAL_SCROLLBACK_LINE')).toBeNull();

    await act(async () => {
      resolveSubmit({
        ok: false,
        source: 'client',
        formError: 'cancelled in test',
        fieldErrors: {},
      });
      await Promise.resolve();
    });
  });

  it('preserves browser copy on Ctrl+C when input or document selection is non-empty, and cancels when collapsed', () => {
    render(<TerminalWorkspace terminal={BASE_TERMINAL} />);
    const input = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'status' } });

    // Input selection non-empty -> Ctrl+C must NOT preventDefault or cancel line
    input.setSelectionRange(0, 6);
    const inputSelEvent = dispatchWindowKey({ key: 'c', code: 'KeyC', ctrlKey: true }, input);
    expect(inputSelEvent.defaultPrevented).toBe(false);
    expect(input.value).toBe('status');

    // Collapsed input selection + non-empty window.getSelection() -> Ctrl+C must NOT preventDefault
    input.setSelectionRange(6, 6);
    const getSelectionSpy = vi
      .spyOn(window, 'getSelection')
      .mockReturnValue({ toString: () => 'INITIAL_SCROLLBACK_LINE' } as Selection);
    const docSelEvent = dispatchWindowKey({ key: 'c', code: 'KeyC', ctrlKey: true }, input);
    expect(docSelEvent.defaultPrevented).toBe(false);
    expect(input.value).toBe('status');
    getSelectionSpy.mockRestore();

    // Collapsed input selection + empty document selection -> Ctrl+C cancels line
    const cancelEvent = dispatchWindowKey({ key: 'c', code: 'KeyC', ctrlKey: true }, input);
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(input.value).toBe('');
    expect(screen.getByText('status^C')).toBeTruthy();
  });
});
