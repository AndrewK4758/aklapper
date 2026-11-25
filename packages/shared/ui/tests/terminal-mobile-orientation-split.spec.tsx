import type { TerminalProfileData } from '@aklapper/core';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { isPortraitViewport, resolveAutoSplitDirection, TerminalWorkspace, Tooltip } from '../src';

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
  quickCommands: ['help', 'split', 'clear'],
  initialEntries: [],
  commands: [
    {
      name: 'help',
      description: 'list commands',
      kind: 'static',
      output: 'Available terminal commands',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 1,
    },
    {
      name: 'menu',
      description: 'open menu',
      kind: 'navigate',
      output: 'opening /menu ...',
      targetRoute: '/menu',
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 2,
    },
  ],
};

interface MockMatchMediaController {
  setPortrait: (portrait: boolean) => void;
  restore: () => void;
}

function mockPortraitMedia(initialPortrait: boolean): MockMatchMediaController {
  let portrait = initialPortrait;
  const listeners = new Set<() => void>();
  const originalMatchMedia = window.matchMedia;

  const mockMatchMedia = vi.fn<(query: string) => MediaQueryList>(
    (query: string): MediaQueryList => {
      const matches = query.includes('portrait') ? portrait : !portrait;
      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
          if (typeof listener === 'function') {
            listeners.add(() => listener(new Event('change')));
          }
        },
        removeEventListener: () => {
          listeners.clear();
        },
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      };
    },
  );

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: mockMatchMedia,
  });

  return {
    setPortrait(nextPortrait: boolean) {
      portrait = nextPortrait;
      for (const listener of listeners) {
        listener();
      }
    },
    restore() {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    },
  };
}

describe('terminal mobile orientation auto-split', () => {
  let controller: MockMatchMediaController | null = null;

  afterEach(() => {
    controller?.restore();
    controller = null;
  });

  it('resolves horizontal split (down) in portrait and vertical split (right) in landscape', () => {
    controller = mockPortraitMedia(true);
    expect(isPortraitViewport()).toBe(true);
    expect(resolveAutoSplitDirection()).toBe('down');

    controller.setPortrait(false);
    expect(isPortraitViewport()).toBe(false);
    expect(resolveAutoSplitDirection()).toBe('right');
  });

  it('creates horizontal splits automatically in portrait mode via button, split command, and --split view', () => {
    controller = mockPortraitMedia(true);
    const { container } = render(
      <Tooltip.Provider>
        <TerminalWorkspace
          terminal={TERMINAL_FIXTURE}
          renderPaneView={({ viewId }) => <div data-testid='mock-pane-view'>{viewId}</div>}
        />
      </Tooltip.Provider>,
    );

    const splitBtn = screen.getByRole('button', { name: 'Split active pane horizontally' });
    fireEvent.click(splitBtn);

    const dividers = container.querySelectorAll<HTMLButtonElement>('[data-split-divider]');
    expect(dividers).toHaveLength(1);
    expect(dividers[0]?.dataset.direction).toBe('horizontal');

    const input = screen.getByRole('textbox', { name: 'Terminal command input' });
    fireEvent.change(input, { target: { value: 'menu --split' } });
    fireEvent.submit(input.closest('form')!);

    const updatedDividers = container.querySelectorAll<HTMLButtonElement>('[data-split-divider]');
    expect(updatedDividers).toHaveLength(2);
    for (const divider of updatedDividers) {
      expect(divider.dataset.direction).toBe('horizontal');
    }
  });

  it('creates vertical splits automatically in landscape mode and reacts to orientation rotation', () => {
    controller = mockPortraitMedia(false);
    const { container } = render(
      <Tooltip.Provider>
        <TerminalWorkspace terminal={TERMINAL_FIXTURE} />
      </Tooltip.Provider>,
    );

    const splitBtn = screen.getByRole('button', { name: 'Split active pane vertically' });
    fireEvent.click(splitBtn);

    const dividers = container.querySelectorAll<HTMLButtonElement>('[data-split-divider]');
    expect(dividers).toHaveLength(1);
    expect(dividers[0]?.dataset.direction).toBe('vertical');

    // Rotate device to portrait and run `split` command
    act(() => {
      controller?.setPortrait(true);
    });

    expect(screen.getByRole('button', { name: 'Split active pane horizontally' })).toBeTruthy();

    const input = screen.getByRole('textbox', { name: 'Terminal command input' });
    fireEvent.change(input, { target: { value: 'split' } });
    fireEvent.submit(input.closest('form')!);

    const updatedDividers = container.querySelectorAll<HTMLButtonElement>('[data-split-divider]');
    expect(updatedDividers).toHaveLength(2);
    expect(updatedDividers[1]?.dataset.direction).toBe('horizontal');
  });
});
