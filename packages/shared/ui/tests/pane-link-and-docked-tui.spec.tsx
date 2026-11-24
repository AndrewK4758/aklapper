import { CONTACT_FORM_DEFINITION, type TerminalCommandSpec } from '@aklapper/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  buildZshCommandHandlers,
  PaneLink,
  PaneNavigationContext,
  type PaneNavigationContextValue,
  startTerminalFormSession,
  TuiWindow,
} from '../src';

function makePaneNav(overrides?: Partial<PaneNavigationContextValue>): PaneNavigationContextValue {
  return {
    paneId: 'pane-1',
    ttyNumber: 1,
    isActive: true,
    isSinglePane: true,
    docked: true,
    stack: ['tui', '/menu', '/agensi'],
    canGoBack: true,
    push: vi.fn(),
    pop: vi.fn(),
    exitTui: vi.fn(),
    openInSplit: vi.fn(),
    openInTab: vi.fn(),
    ...overrides,
  };
}

describe('PaneLink', () => {
  it('routes normal click in-pane, Shift+Click to split, and Ctrl/Cmd/middle-click to new tab', () => {
    const nav = makePaneNav();
    render(
      <PaneNavigationContext.Provider value={nav}>
        <PaneLink to='/agensi'>Agensi</PaneLink>
      </PaneNavigationContext.Provider>,
    );

    const link = screen.getByRole('link', { name: 'Agensi' });

    fireEvent.click(link);
    expect(nav.push).toHaveBeenCalledWith('/agensi');

    fireEvent.click(link, { shiftKey: true });
    expect(nav.openInSplit).toHaveBeenCalledWith('/agensi');

    fireEvent.click(link, { ctrlKey: true });
    expect(nav.openInTab).toHaveBeenCalledWith('/agensi');

    fireEvent.click(link, { metaKey: true });
    expect(nav.openInTab).toHaveBeenCalledTimes(2);

    fireEvent(link, new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));
    expect(nav.openInTab).toHaveBeenCalledTimes(3);
  });

  it('supports custom render prop and falls through cleanly outside PaneNavigationContext', () => {
    const onNativeClick = vi.fn((e: React.MouseEvent<HTMLAnchorElement>) => e.preventDefault());
    render(
      <PaneLink to='/menu' render={<a href='/menu' data-custom='true' onClick={onNativeClick} />}>
        Launch Menu
      </PaneLink>,
    );

    const link = screen.getByRole('link', { name: 'Launch Menu' });
    expect(link.getAttribute('data-custom')).toBe('true');
    fireEvent.click(link);
    expect(onNativeClick).toHaveBeenCalledTimes(1);
  });
});

describe('Docked TuiWindow chrome', () => {
  it('renders docked edge-to-edge without floating, resize handle, or duplicate Escape listener', () => {
    const nav = makePaneNav();
    const onClose = vi.fn();

    const { container } = render(
      <PaneNavigationContext.Provider value={nav}>
        <TuiWindow title='Agensi Storefront' onClose={onClose}>
          <div>Agensi content</div>
        </TuiWindow>
      </PaneNavigationContext.Provider>,
    );

    const section = container.querySelector('section') as HTMLElement;
    expect(section.getAttribute('data-docked')).toBe('true');
    expect(section.getAttribute('data-floating')).toBe('false');
    expect(container.querySelector('[data-drag-handle]')).toBeNull();
    expect(container.querySelector('[data-resize-handle]')).toBeNull();

    // Pointer drag on titlebar must not float
    const titlebar = container.querySelector('[data-tui-titlebar]') as HTMLElement;
    fireEvent.pointerDown(titlebar, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(titlebar, { clientX: 120, clientY: 80, pointerId: 1 });
    fireEvent.pointerUp(titlebar, { clientX: 120, clientY: 80, pointerId: 1 });
    expect(section.getAttribute('data-floating')).toBe('false');

    // Breadcrumb reflects parent stack context
    expect(titlebar.textContent).toContain('Agensi Storefront');

    // Unified controls: Go back -> pop, Exit TUI -> exitTui
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(nav.pop).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Exit TUI' }));
    expect(nav.exitTui).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    // Window Escape must NOT fire TuiWindow's own onClose when docked
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('CLI navigation flags in buildZshCommandHandlers and terminalFormSession', () => {
  const specs: TerminalCommandSpec[] = [
    {
      name: 'tui',
      description: 'open tui',
      kind: 'tui',
      output: 'opening TUI ...',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 1,
    },
    {
      name: 'agensi',
      description: 'open agensi',
      kind: 'navigate',
      output: 'opening /agensi ...',
      targetRoute: '/agensi',
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 2,
    },
    {
      name: 'cd',
      description: 'change route',
      kind: 'cd',
      output: 'cd /{{target}}',
      targetRoute: null,
      allowedRoutes: ['agensi', 'ask', 'menu'],
      errorTemplate: 'cd: no such route: {{input}}',
      sortOrder: 3,
    },
  ];

  it('forwards --split and --tab dispositions to navigateView and openTui', () => {
    const navigateView = vi.fn();
    const openTui = vi.fn();
    const handlers = buildZshCommandHandlers(specs, { navigateView, openTui });

    handlers['tui']?.([], 'tui');
    expect(openTui).toHaveBeenLastCalledWith();

    handlers['tui']?.(['--split'], 'tui --split');
    expect(openTui).toHaveBeenLastCalledWith('split');

    handlers['tui']?.(['--tab'], 'tui --tab');
    expect(openTui).toHaveBeenLastCalledWith('tab');

    handlers['agensi']?.([], 'agensi');
    expect(navigateView).toHaveBeenLastCalledWith('/agensi', 'in-pane');

    handlers['agensi']?.(['--split'], 'agensi --split');
    expect(navigateView).toHaveBeenLastCalledWith('/agensi', 'split');

    handlers['cd']?.(['ask', '--split', '--tab'], 'cd ask --split --tab');
    expect(navigateView).toHaveBeenLastCalledWith('/ask', 'tab');

    const bad = handlers['cd']?.(['nonexistent'], 'cd nonexistent');
    expect(bad).toEqual({ status: 'error', output: 'cd: no such route: nonexistent' });
  });

  it('parses contact --tui with optional --split and --tab flags', () => {
    const inPane = startTerminalFormSession(CONTACT_FORM_DEFINITION, 'contact --tui');
    expect(inPane).toMatchObject({ kind: 'open-tui', navTarget: 'in-pane' });

    const inSplit = startTerminalFormSession(CONTACT_FORM_DEFINITION, 'contact --tui --split');
    expect(inSplit).toMatchObject({ kind: 'open-tui', navTarget: 'split' });

    const inTab = startTerminalFormSession(CONTACT_FORM_DEFINITION, 'contact --tui --split --tab');
    expect(inTab).toMatchObject({ kind: 'open-tui', navTarget: 'tab' });
  });
});
