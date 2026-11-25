export type ShortcutDirection = 'left' | 'right' | 'up' | 'down';

export type WorkspaceShortcutAction =
  | { readonly type: 'split'; readonly direction: 'right' | 'down' }
  | { readonly type: 'focus-relative'; readonly delta: 1 | -1 }
  | { readonly type: 'focus-direction'; readonly direction: ShortcutDirection }
  | { readonly type: 'resize'; readonly direction: ShortcutDirection }
  | { readonly type: 'move-split'; readonly direction: ShortcutDirection }
  | { readonly type: 'rotate-split' }
  | { readonly type: 'toggle-zoom' }
  | { readonly type: 'equalize' }
  | { readonly type: 'close-pane' }
  | { readonly type: 'new-tab' }
  | { readonly type: 'rename-tab' }
  | { readonly type: 'focus-tab-relative'; readonly delta: 1 | -1 }
  | { readonly type: 'focus-tab-index'; readonly index: number | 'last' }
  | { readonly type: 'detach-pane' }
  | { readonly type: 'toggle-tui' }
  | { readonly type: 'open-menu' };

export type TerminalReadlineAction =
  | 'clear'
  | 'kill-to-start'
  | 'kill-to-end'
  | 'delete-word-back'
  | 'history-prev'
  | 'history-next';

export interface KeyboardShortcutInput {
  readonly key: string;
  readonly code?: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
}

export const PORTAL_CHROME_SHORTCUT_HINT =
  'Ctrl+⇧} / Alt+⇧D split · Ctrl+⇧{ / Alt+⇧S hsplit · Alt+⇧N tab · Alt+T tui';

export const ADMIN_CHROME_SHORTCUT_HINT =
  'Ctrl+⇧} / Alt+⇧D split · Ctrl+⇧{ / Alt+⇧S hsplit · Alt+⇧N tab';

export const NEW_TAB_TOOLTIP_LABEL = 'New Tab (Alt+Shift+N)';

export const PORTAL_READLINE_HELP_LINES: readonly string[] = [
  'Keybindings:',
  '  Tab / Right — accept autocomplete suggestion',
  '  Up / Down (Alt+P / Ctrl+P / Alt+N) — command history',
  '  Ctrl+L — clear · Ctrl+C — cancel line · Ctrl+U/K / Alt+Backspace — edit line',
  '  Alt+T — toggle TUI · Alt+M — open /menu · Esc — close TUI',
];

export function buildSplitHelpLines(options: { readonly includeTui: boolean }): readonly string[] {
  return [
    '',
    'Split panes & tabs (keybindings & commands):',
    '  Ctrl+Shift+} / Alt+Shift+D (or "split" / "vsplit")          — split terminal right',
    '  Ctrl+Shift+{ / Alt+Shift+S (or "hsplit")                    — split terminal down',
    ...(options.includeTui
      ? [
          '  Alt+T (or "tui")                                            — open or toggle TUI split pane',
        ]
      : []),
    '  Alt+H/J/K/L (or Cmd+] / Cmd+[)                              — focus neighbor pane',
    '  Alt+Shift+Arrows / drag pane divider (double-click=50/50)   — resize active split',
    '  Alt+Shift+H/J/K/L (or "swap" / drag pane titlebar)          — swap or dock split pane',
    '  Alt+Shift+R / Ctrl+Alt+Shift+R (or "rotate")                — rotate split orientation',
    '  Ctrl+Shift+Enter / Cmd+Shift+Enter (or "zoom")              — toggle active pane zoom',
    '  Ctrl+Alt+Shift+E                                            — equalize split sizes',
    '  Alt+Shift+N (or "tab")                                      — open a new tab',
    '  Ctrl+Alt+Shift+T (or "detach" / drag pane to tab strip)     — move split to new tab',
    '  F2 (or double-click tab)                                    — rename active tab',
    '  Alt+] / Alt+[ / Alt+Shift+1..9                              — switch tabs',
    '  Alt+Shift+W (or "exit")                                     — close active pane or tab',
  ];
}

const US_SHIFTED_DIGIT_INDEX: Readonly<Record<string, number | 'last'>> = {
  '!': 0,
  '@': 1,
  '#': 2,
  $: 3,
  '%': 4,
  '^': 5,
  '&': 6,
  '*': 7,
  '(': 'last',
};

function mapArrowKeyToDirection(key: string): ShortcutDirection | null {
  switch (key) {
    case 'ArrowLeft':
      return 'left';
    case 'ArrowRight':
      return 'right';
    case 'ArrowUp':
      return 'up';
    case 'ArrowDown':
      return 'down';
    default:
      return null;
  }
}

function matchesLetter(keyLower: string, code: string, letter: string): boolean {
  return keyLower === letter || code === `Key${letter.toUpperCase()}`;
}

function mapVimKeyToDirection(keyLower: string, code: string): ShortcutDirection | null {
  if (matchesLetter(keyLower, code, 'h')) {
    return 'left';
  }
  if (matchesLetter(keyLower, code, 'j')) {
    return 'down';
  }
  if (matchesLetter(keyLower, code, 'k')) {
    return 'up';
  }
  if (matchesLetter(keyLower, code, 'l')) {
    return 'right';
  }
  return null;
}

function parseDigitIndex(key: string, code: string): number | 'last' | null {
  if (/^[1-8]$/.test(key)) {
    return Number(key) - 1;
  }
  if (key === '9') {
    return 'last';
  }
  if (/^Digit[1-8]$/.test(code)) {
    return Number(code.slice(5)) - 1;
  }
  if (code === 'Digit9') {
    return 'last';
  }
  const shifted = US_SHIFTED_DIGIT_INDEX[key];
  return shifted ?? null;
}

/**
 * Matches uniform, browser-safe workspace pane and tab keybindings across Linux, Windows, and
 * macOS. Explicitly excludes browser-reserved chords (e.g., Ctrl+W/N, Alt+1..9, Cmd+D/R/L,
 * Ctrl+Shift+O/E/R/T/A/W/I/=).
 */
export function matchWorkspaceShortcut(
  event: KeyboardShortcutInput,
): WorkspaceShortcutAction | null {
  const keyLower = event.key.toLowerCase();
  const code = event.code ?? '';
  const arrowDir = mapArrowKeyToDirection(event.key);
  const isBracketRight = event.key === ']' || event.key === '}' || code === 'BracketRight';
  const isBracketLeft = event.key === '[' || event.key === '{' || code === 'BracketLeft';
  const isNoModifiers = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
  const isAltOnly = event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
  const isCtrlShiftOnly = event.ctrlKey && event.shiftKey && !event.metaKey && !event.altKey;
  const isCtrlAltShiftOnly = event.ctrlKey && event.altKey && event.shiftKey && !event.metaKey;
  const isAltShiftOnly = event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey;

  // Rename active tab: plain F2
  if (isNoModifiers && (event.key === 'F2' || code === 'F2')) {
    return { type: 'rename-tab' };
  }

  // Resize active split: Alt+Shift+Arrow* or Ctrl+Cmd+Arrow*
  if (arrowDir && (isAltShiftOnly || (event.ctrlKey && event.metaKey && !event.altKey))) {
    return { type: 'resize', direction: arrowDir };
  }

  // Split right (side-by-side): Ctrl+Shift+} or Alt+Shift+D
  if (
    (isCtrlShiftOnly && isBracketRight) ||
    (isAltShiftOnly && matchesLetter(keyLower, code, 'd'))
  ) {
    return { type: 'split', direction: 'right' };
  }

  // Split down (stacked): Ctrl+Shift+{ or Alt+Shift+S
  if (
    (isCtrlShiftOnly && isBracketLeft) ||
    (isAltShiftOnly && matchesLetter(keyLower, code, 's'))
  ) {
    return { type: 'split', direction: 'down' };
  }

  // Rotate active split orientation: Alt+Shift+R or Ctrl+Alt+Shift+R
  if ((isAltShiftOnly || isCtrlAltShiftOnly) && matchesLetter(keyLower, code, 'r')) {
    return { type: 'rotate-split' };
  }

  // Detach active split pane to a new tab: Ctrl+Alt+Shift+T
  if (isCtrlAltShiftOnly && matchesLetter(keyLower, code, 't')) {
    return { type: 'detach-pane' };
  }

  // Equalize splits: Ctrl+Alt+Shift+E
  if (isCtrlAltShiftOnly && matchesLetter(keyLower, code, 'e')) {
    return { type: 'equalize' };
  }

  // Alt+Shift shortcuts: move split (H/J/K/L), new tab (N), close pane/tab (W), tab index (1..9)
  if (isAltShiftOnly) {
    const moveDir = mapVimKeyToDirection(keyLower, code);
    if (moveDir) {
      return { type: 'move-split', direction: moveDir };
    }
    if (matchesLetter(keyLower, code, 'n')) {
      return { type: 'new-tab' };
    }
    if (matchesLetter(keyLower, code, 'w')) {
      return { type: 'close-pane' };
    }
    const tabIndex = parseDigitIndex(event.key, code);
    if (tabIndex !== null) {
      return { type: 'focus-tab-index', index: tabIndex };
    }
  }

  // Cycle next / previous split: Cmd+] / Cmd+[
  if (event.metaKey && !event.shiftKey && !event.ctrlKey && !event.altKey) {
    if (isBracketRight) {
      return { type: 'focus-relative', delta: 1 };
    }
    if (isBracketLeft) {
      return { type: 'focus-relative', delta: -1 };
    }
  }

  // Toggle split zoom: Cmd+Shift+Enter or Ctrl+Shift+Enter
  if (
    event.key === 'Enter' &&
    event.shiftKey &&
    !event.altKey &&
    ((event.metaKey && !event.ctrlKey) || (event.ctrlKey && !event.metaKey))
  ) {
    return { type: 'toggle-zoom' };
  }

  // Alt-only shortcuts: directional focus (H/J/K/L), tab cycling (]/[), TUI toggle (T), menu (M)
  if (isAltOnly) {
    const focusDir = mapVimKeyToDirection(keyLower, code);
    if (focusDir) {
      return { type: 'focus-direction', direction: focusDir };
    }
    if (isBracketRight) {
      return { type: 'focus-tab-relative', delta: 1 };
    }
    if (isBracketLeft) {
      return { type: 'focus-tab-relative', delta: -1 };
    }
    if (matchesLetter(keyLower, code, 't')) {
      return { type: 'toggle-tui' };
    }
    if (matchesLetter(keyLower, code, 'm')) {
      return { type: 'open-menu' };
    }
  }

  return null;
}

/**
 * Returns true when the keypress is physical Alt+N (macOS Option+N dead-key tilde chord) so
 * capture-phase handling can intercept it before dead-key composition begins.
 */
export function isAltNReadlineChord(event: KeyboardShortcutInput): boolean {
  return (
    event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    (event.code === 'KeyN' || event.key.toLowerCase() === 'n')
  );
}

/**
 * Matches browser-safe terminal readline shortcuts (clear, line-kill, word-delete, history).
 * Intentionally excludes Ctrl+C (selection-aware cancel in terminal input), Ctrl+W, and Ctrl+N.
 */
export function matchTerminalReadlineShortcut(
  event: KeyboardShortcutInput,
): TerminalReadlineAction | null {
  const keyLower = event.key.toLowerCase();
  const code = event.code ?? '';
  const isCtrlOnly = event.ctrlKey && !event.shiftKey && !event.metaKey && !event.altKey;
  const isAltOnly = event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;

  if (isCtrlOnly) {
    if (matchesLetter(keyLower, code, 'l')) {
      return 'clear';
    }
    if (matchesLetter(keyLower, code, 'u')) {
      return 'kill-to-start';
    }
    if (matchesLetter(keyLower, code, 'k')) {
      return 'kill-to-end';
    }
    if (matchesLetter(keyLower, code, 'p')) {
      return 'history-prev';
    }
  }

  if (isAltOnly) {
    if (event.key === 'Backspace' || code === 'Backspace') {
      return 'delete-word-back';
    }
    if (matchesLetter(keyLower, code, 'p')) {
      return 'history-prev';
    }
    if (matchesLetter(keyLower, code, 'n')) {
      return 'history-next';
    }
  }

  return null;
}
