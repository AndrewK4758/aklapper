import { describe, expect, it } from 'vitest';

import {
  ADMIN_CHROME_SHORTCUT_HINT,
  buildSplitHelpLines,
  matchTerminalReadlineShortcut,
  matchWorkspaceShortcut,
  NEW_TAB_TOOLTIP_LABEL,
  PORTAL_CHROME_SHORTCUT_HINT,
  PORTAL_READLINE_HELP_LINES,
  type KeyboardShortcutInput,
} from '../src/index.ts';

function keyEvent(
  key: string,
  overrides: Partial<Omit<KeyboardShortcutInput, 'key'>> = {},
): KeyboardShortcutInput {
  return {
    key,
    code: overrides.code,
    ctrlKey: overrides.ctrlKey ?? false,
    metaKey: overrides.metaKey ?? false,
    altKey: overrides.altKey ?? false,
    shiftKey: overrides.shiftKey ?? false,
  };
}

describe('matchWorkspaceShortcut', () => {
  it('matches browser-safe split, directional focus, move, resize, rotate, zoom, equalize, close, tab, detach, tui, and menu shortcuts', () => {
    expect(
      matchWorkspaceShortcut(
        keyEvent('}', { code: 'BracketRight', ctrlKey: true, shiftKey: true }),
      ),
    ).toEqual({ type: 'split', direction: 'right' });
    expect(
      matchWorkspaceShortcut(keyEvent('D', { code: 'KeyD', altKey: true, shiftKey: true })),
    ).toEqual({ type: 'split', direction: 'right' });

    expect(
      matchWorkspaceShortcut(keyEvent('{', { code: 'BracketLeft', ctrlKey: true, shiftKey: true })),
    ).toEqual({ type: 'split', direction: 'down' });
    expect(
      matchWorkspaceShortcut(keyEvent('S', { code: 'KeyS', altKey: true, shiftKey: true })),
    ).toEqual({ type: 'split', direction: 'down' });

    expect(matchWorkspaceShortcut(keyEvent('h', { code: 'KeyH', altKey: true }))).toEqual({
      type: 'focus-direction',
      direction: 'left',
    });
    expect(matchWorkspaceShortcut(keyEvent('j', { code: 'KeyJ', altKey: true }))).toEqual({
      type: 'focus-direction',
      direction: 'down',
    });
    expect(matchWorkspaceShortcut(keyEvent('k', { code: 'KeyK', altKey: true }))).toEqual({
      type: 'focus-direction',
      direction: 'up',
    });
    expect(matchWorkspaceShortcut(keyEvent('l', { code: 'KeyL', altKey: true }))).toEqual({
      type: 'focus-direction',
      direction: 'right',
    });

    expect(
      matchWorkspaceShortcut(keyEvent('H', { code: 'KeyH', altKey: true, shiftKey: true })),
    ).toEqual({ type: 'move-split', direction: 'left' });
    expect(
      matchWorkspaceShortcut(keyEvent('J', { code: 'KeyJ', altKey: true, shiftKey: true })),
    ).toEqual({ type: 'move-split', direction: 'down' });
    expect(
      matchWorkspaceShortcut(keyEvent('K', { code: 'KeyK', altKey: true, shiftKey: true })),
    ).toEqual({ type: 'move-split', direction: 'up' });
    expect(
      matchWorkspaceShortcut(keyEvent('L', { code: 'KeyL', altKey: true, shiftKey: true })),
    ).toEqual({ type: 'move-split', direction: 'right' });

    expect(matchWorkspaceShortcut(keyEvent(']', { code: 'BracketRight', metaKey: true }))).toEqual({
      type: 'focus-relative',
      delta: 1,
    });
    expect(matchWorkspaceShortcut(keyEvent('[', { code: 'BracketLeft', metaKey: true }))).toEqual({
      type: 'focus-relative',
      delta: -1,
    });

    expect(
      matchWorkspaceShortcut(keyEvent('ArrowRight', { altKey: true, shiftKey: true })),
    ).toEqual({ type: 'resize', direction: 'right' });
    expect(
      matchWorkspaceShortcut(keyEvent('ArrowLeft', { ctrlKey: true, metaKey: true })),
    ).toEqual({ type: 'resize', direction: 'left' });

    expect(
      matchWorkspaceShortcut(keyEvent('R', { code: 'KeyR', altKey: true, shiftKey: true })),
    ).toEqual({ type: 'rotate-split' });
    expect(
      matchWorkspaceShortcut(
        keyEvent('R', { code: 'KeyR', ctrlKey: true, altKey: true, shiftKey: true }),
      ),
    ).toEqual({ type: 'rotate-split' });

    expect(matchWorkspaceShortcut(keyEvent('Enter', { ctrlKey: true, shiftKey: true }))).toEqual({
      type: 'toggle-zoom',
    });
    expect(matchWorkspaceShortcut(keyEvent('Enter', { metaKey: true, shiftKey: true }))).toEqual({
      type: 'toggle-zoom',
    });

    expect(
      matchWorkspaceShortcut(
        keyEvent('E', { code: 'KeyE', ctrlKey: true, altKey: true, shiftKey: true }),
      ),
    ).toEqual({ type: 'equalize' });

    expect(
      matchWorkspaceShortcut(keyEvent('W', { code: 'KeyW', altKey: true, shiftKey: true })),
    ).toEqual({ type: 'close-pane' });

    expect(
      matchWorkspaceShortcut(keyEvent('N', { code: 'KeyN', altKey: true, shiftKey: true })),
    ).toEqual({ type: 'new-tab' });

    expect(matchWorkspaceShortcut(keyEvent('F2', { code: 'F2' }))).toEqual({
      type: 'rename-tab',
    });
    expect(matchWorkspaceShortcut(keyEvent('F2', { code: 'F2', shiftKey: true }))).toBeNull();
    expect(matchWorkspaceShortcut(keyEvent('F2', { code: 'F2', ctrlKey: true }))).toBeNull();
    expect(matchWorkspaceShortcut(keyEvent('F2', { code: 'F2', altKey: true }))).toBeNull();
    expect(matchWorkspaceShortcut(keyEvent('F2', { code: 'F2', metaKey: true }))).toBeNull();

    expect(matchWorkspaceShortcut(keyEvent(']', { code: 'BracketRight', altKey: true }))).toEqual({
      type: 'focus-tab-relative',
      delta: 1,
    });
    expect(matchWorkspaceShortcut(keyEvent('[', { code: 'BracketLeft', altKey: true }))).toEqual({
      type: 'focus-tab-relative',
      delta: -1,
    });

    expect(
      matchWorkspaceShortcut(
        keyEvent('T', { code: 'KeyT', ctrlKey: true, altKey: true, shiftKey: true }),
      ),
    ).toEqual({ type: 'detach-pane' });

    expect(matchWorkspaceShortcut(keyEvent('t', { code: 'KeyT', altKey: true }))).toEqual({
      type: 'toggle-tui',
    });
    expect(matchWorkspaceShortcut(keyEvent('m', { code: 'KeyM', altKey: true }))).toEqual({
      type: 'open-menu',
    });
  });

  it('resolves shifted Alt+Shift+1..9 via Digit1..Digit9 codes, digits, and US shifted symbols', () => {
    expect(
      matchWorkspaceShortcut(keyEvent('@', { code: 'Digit2', altKey: true, shiftKey: true })),
    ).toEqual({ type: 'focus-tab-index', index: 1 });
    expect(
      matchWorkspaceShortcut(keyEvent('!', { code: '', altKey: true, shiftKey: true })),
    ).toEqual({ type: 'focus-tab-index', index: 0 });

    const shiftedSymbols = ['!', '@', '#', '$', '%', '^', '&', '*'] as const;
    shiftedSymbols.forEach((symbol, index) => {
      expect(
        matchWorkspaceShortcut(keyEvent(symbol, { altKey: true, shiftKey: true })),
      ).toEqual({ type: 'focus-tab-index', index });
    });

    expect(
      matchWorkspaceShortcut(keyEvent('(', { altKey: true, shiftKey: true })),
    ).toEqual({ type: 'focus-tab-index', index: 'last' });
    expect(
      matchWorkspaceShortcut(keyEvent('9', { code: 'Digit9', altKey: true, shiftKey: true })),
    ).toEqual({ type: 'focus-tab-index', index: 'last' });
  });

  it('returns null for all removed Chrome-hijacked, OS-conflicting, and browser-reserved shortcuts', () => {
    const forbiddenChords: readonly KeyboardShortcutInput[] = [
      keyEvent('w', { code: 'KeyW', ctrlKey: true }),
      keyEvent('n', { code: 'KeyN', ctrlKey: true }),
      keyEvent('1', { code: 'Digit1', altKey: true }),
      keyEvent('9', { code: 'Digit9', altKey: true }),
      keyEvent('ArrowLeft', { metaKey: true, altKey: true }),
      keyEvent('ArrowRight', { ctrlKey: true, altKey: true }),
      keyEvent('ArrowLeft', { ctrlKey: true, altKey: true, shiftKey: true }),
      keyEvent('T', { code: 'KeyT', altKey: true, shiftKey: true }),
      keyEvent('A', { code: 'KeyA', altKey: true, shiftKey: true }),
      keyEvent('O', { code: 'KeyO', ctrlKey: true, shiftKey: true }),
      keyEvent('E', { code: 'KeyE', ctrlKey: true, shiftKey: true }),
      keyEvent('d', { code: 'KeyD', metaKey: true }),
      keyEvent('D', { code: 'KeyD', metaKey: true, shiftKey: true }),
      keyEvent('+', { code: 'Equal', ctrlKey: true, shiftKey: true }),
      keyEvent('+', { code: 'Equal', metaKey: true, shiftKey: true }),
      keyEvent('W', { code: 'KeyW', ctrlKey: true, shiftKey: true }),
      keyEvent('W', { code: 'KeyW', metaKey: true, shiftKey: true }),
      keyEvent('T', { code: 'KeyT', ctrlKey: true, shiftKey: true }),
      keyEvent('A', { code: 'KeyA', ctrlKey: true, shiftKey: true }),
      keyEvent('R', { code: 'KeyR', ctrlKey: true, shiftKey: true }),
      keyEvent('Tab', { ctrlKey: true }),
      keyEvent('Tab', { ctrlKey: true, shiftKey: true }),
      keyEvent('PageUp', { ctrlKey: true }),
      keyEvent('PageDown', { ctrlKey: true }),
      // Browser system shortcuts
      keyEvent('I', { code: 'KeyI', ctrlKey: true, shiftKey: true }),
      keyEvent('r', { code: 'KeyR', metaKey: true }),
      keyEvent('r', { code: 'KeyR', ctrlKey: true }),
      keyEvent('l', { code: 'KeyL', metaKey: true }),
    ];

    for (const chord of forbiddenChords) {
      expect(matchWorkspaceShortcut(chord)).toBeNull();
      expect(matchTerminalReadlineShortcut(chord)).toBeNull();
    }
  });
});

describe('matchTerminalReadlineShortcut', () => {
  it('matches browser-safe readline chords and never matches Ctrl+C, Ctrl+W, or Ctrl+N', () => {
    expect(matchTerminalReadlineShortcut(keyEvent('l', { code: 'KeyL', ctrlKey: true }))).toBe(
      'clear',
    );
    expect(matchTerminalReadlineShortcut(keyEvent('u', { code: 'KeyU', ctrlKey: true }))).toBe(
      'kill-to-start',
    );
    expect(matchTerminalReadlineShortcut(keyEvent('k', { code: 'KeyK', ctrlKey: true }))).toBe(
      'kill-to-end',
    );
    expect(
      matchTerminalReadlineShortcut(keyEvent('Backspace', { code: 'Backspace', altKey: true })),
    ).toBe('delete-word-back');
    expect(matchTerminalReadlineShortcut(keyEvent('p', { code: 'KeyP', ctrlKey: true }))).toBe(
      'history-prev',
    );
    expect(matchTerminalReadlineShortcut(keyEvent('p', { code: 'KeyP', altKey: true }))).toBe(
      'history-prev',
    );
    expect(matchTerminalReadlineShortcut(keyEvent('n', { code: 'KeyN', altKey: true }))).toBe(
      'history-next',
    );
    // macOS Option+N produces key "Dead" with code "KeyN"
    expect(matchTerminalReadlineShortcut(keyEvent('Dead', { code: 'KeyN', altKey: true }))).toBe(
      'history-next',
    );

    expect(matchTerminalReadlineShortcut(keyEvent('c', { code: 'KeyC', ctrlKey: true }))).toBeNull();
    expect(matchTerminalReadlineShortcut(keyEvent('w', { code: 'KeyW', ctrlKey: true }))).toBeNull();
    expect(matchTerminalReadlineShortcut(keyEvent('n', { code: 'KeyN', ctrlKey: true }))).toBeNull();
  });
});

describe('shortcut hints and help formatters', () => {
  it('advertises only browser-safe shortcuts with zero stale Chrome-hijacked chords', () => {
    expect(NEW_TAB_TOOLTIP_LABEL).toBe('New Tab (Alt+Shift+N)');

    const portalHelp = [
      ...PORTAL_READLINE_HELP_LINES,
      ...buildSplitHelpLines({ includeTui: true }),
    ].join('\n');
    const adminHelp = buildSplitHelpLines({ includeTui: false }).join('\n');

    expect(PORTAL_CHROME_SHORTCUT_HINT).toContain('Alt+⇧N');
    expect(ADMIN_CHROME_SHORTCUT_HINT).toContain('Alt+⇧N');

    for (const expected of [
      'Alt+Shift+N',
      'F2',
      'Alt+Shift+1..9',
      'Alt+H/J/K/L',
      'Alt+Shift+H/J/K/L',
      'Alt+Backspace',
      'Alt+P',
      'Alt+N',
      'Ctrl+Alt+Shift+E',
    ]) {
      expect(portalHelp).toContain(expected);
    }
    expect(adminHelp).not.toContain('Alt+T');

    const allRenderedStrings = [
      PORTAL_CHROME_SHORTCUT_HINT,
      ADMIN_CHROME_SHORTCUT_HINT,
      NEW_TAB_TOOLTIP_LABEL,
      portalHelp,
      adminHelp,
    ].join('\n');

    const forbiddenPatterns: readonly RegExp[] = [
      /(?<!Ctrl\+)Alt\+Shift\+T\b/,
      /\bAlt\+Shift\+A\b/,
      /Alt\+⇧T/,
      /⌘D/,
      /⌘⇧D/,
      /\bCmd\+D\b/,
      /\bCmd\+Shift\+D\b/,
      /\bCtrl\+Shift\+O\b/,
      /\bCtrl\+Shift\+E\b/,
      /Ctrl\+Shift\+=/,
      /Cmd\+Shift\+=/,
      /\bCtrl\+W\b/,
      /\bCtrl\+N\b/,
      /\bAlt\+1\.\.9\b/,
      /\bCmd\+Alt\+Arrows\b/,
      /\bCtrl\+Alt\+Arrows\b/,
      /\bCtrl\+Alt\+Shift\+Arrows\b/,
      /\bCtrl\+Tab\b/,
      /\bCtrl\+PageUp\b/,
      /\bCtrl\+PageDown\b/,
    ];

    for (const stalePattern of forbiddenPatterns) {
      expect(allRenderedStrings).not.toMatch(stalePattern);
    }
  });
});
