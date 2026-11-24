export type SplitDirection = 'vertical' | 'horizontal';
export type SplitCreateDirection = 'right' | 'down';
export type PaneNavDirection = 'left' | 'right' | 'up' | 'down';

export interface TerminalLeafPane {
  readonly type: 'leaf';
  readonly id: string;
  readonly ttyNumber: number;
  readonly tuiOpen: boolean;
  readonly pinned?: boolean;
}

export interface TerminalSplitPane {
  readonly type: 'split';
  readonly id: string;
  readonly direction: SplitDirection;
  readonly ratio: number;
  readonly first: TerminalPaneNode;
  readonly second: TerminalPaneNode;
}

export type TerminalPaneNode = TerminalLeafPane | TerminalSplitPane;

export interface TerminalWorkspaceState {
  readonly root: TerminalPaneNode;
  readonly activePaneId: string;
  readonly zoomedPaneId: string | null;
  readonly nextPaneNumber: number;
  readonly focusToken: number;
}

export interface PaneRect {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type GhosttyShortcutAction =
  | { readonly type: 'split'; readonly direction: SplitCreateDirection }
  | { readonly type: 'focus-relative'; readonly delta: 1 | -1 }
  | { readonly type: 'focus-direction'; readonly direction: PaneNavDirection }
  | { readonly type: 'resize'; readonly direction: PaneNavDirection }
  | { readonly type: 'toggle-zoom' }
  | { readonly type: 'equalize' }
  | { readonly type: 'close-pane' }
  | { readonly type: 'toggle-tui' }
  | { readonly type: 'open-menu' };

export interface KeyboardShortcutInput {
  readonly key: string;
  readonly code?: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
}

export interface InitialWorkspaceOptions {
  readonly pinnedPrimary?: boolean;
}

const MIN_SPLIT_RATIO = 0.2;
const MAX_SPLIT_RATIO = 0.8;
const DEFAULT_RESIZE_STEP = 0.05;
const EPSILON = 1e-6;

export function createInitialWorkspaceState(
  options?: InitialWorkspaceOptions,
): TerminalWorkspaceState {
  return {
    root: {
      type: 'leaf',
      id: 'pane-1',
      ttyNumber: 1,
      tuiOpen: false,
      ...(options?.pinnedPrimary ? { pinned: true } : {}),
    },
    activePaneId: 'pane-1',
    zoomedPaneId: null,
    nextPaneNumber: 2,
    focusToken: 1,
  };
}

export function listLeafPanes(node: TerminalPaneNode): TerminalLeafPane[] {
  if (node.type === 'leaf') {
    return [node];
  }
  return [...listLeafPanes(node.first), ...listLeafPanes(node.second)];
}

export function findLeafPane(node: TerminalPaneNode, paneId: string): TerminalLeafPane | null {
  if (node.type === 'leaf') {
    return node.id === paneId ? node : null;
  }
  return findLeafPane(node.first, paneId) ?? findLeafPane(node.second, paneId);
}

function containsPane(node: TerminalPaneNode, paneId: string): boolean {
  return findLeafPane(node, paneId) !== null;
}

function splitNode(
  node: TerminalPaneNode,
  targetId: string,
  direction: SplitDirection,
  splitId: string,
  newLeaf: TerminalLeafPane,
): TerminalPaneNode {
  if (node.type === 'leaf') {
    if (node.id !== targetId) {
      return node;
    }
    return {
      type: 'split',
      id: splitId,
      direction,
      ratio: 0.5,
      first: node,
      second: newLeaf,
    };
  }
  const nextFirst = splitNode(node.first, targetId, direction, splitId, newLeaf);
  if (nextFirst !== node.first) {
    return { ...node, first: nextFirst };
  }
  const nextSecond = splitNode(node.second, targetId, direction, splitId, newLeaf);
  if (nextSecond !== node.second) {
    return { ...node, second: nextSecond };
  }
  return node;
}

export function splitActivePane(
  state: TerminalWorkspaceState,
  direction: SplitCreateDirection,
): TerminalWorkspaceState {
  const paneNumber = state.nextPaneNumber;
  const newLeaf: TerminalLeafPane = {
    type: 'leaf',
    id: `pane-${paneNumber}`,
    ttyNumber: paneNumber,
    tuiOpen: false,
  };
  const splitDirection: SplitDirection = direction === 'right' ? 'vertical' : 'horizontal';
  const nextRoot = splitNode(
    state.root,
    state.activePaneId,
    splitDirection,
    `split-${paneNumber}`,
    newLeaf,
  );
  if (nextRoot === state.root) {
    return state;
  }
  return {
    root: nextRoot,
    activePaneId: newLeaf.id,
    zoomedPaneId: null,
    nextPaneNumber: paneNumber + 1,
    focusToken: state.focusToken + 1,
  };
}

function removeLeafNode(node: TerminalPaneNode, targetId: string): TerminalPaneNode | null {
  if (node.type === 'leaf') {
    return node.id === targetId ? null : node;
  }
  const nextFirst = removeLeafNode(node.first, targetId);
  if (nextFirst === null) {
    return node.second;
  }
  if (nextFirst !== node.first) {
    return { ...node, first: nextFirst };
  }
  const nextSecond = removeLeafNode(node.second, targetId);
  if (nextSecond === null) {
    return node.first;
  }
  if (nextSecond !== node.second) {
    return { ...node, second: nextSecond };
  }
  return node;
}

export function closePaneById(
  state: TerminalWorkspaceState,
  paneId: string,
): TerminalWorkspaceState {
  const leaves = listLeafPanes(state.root);
  if (leaves.length <= 1) {
    return state;
  }
  const targetIndex = leaves.findIndex(leaf => leaf.id === paneId);
  if (targetIndex < 0 || leaves[targetIndex]?.pinned) {
    return state;
  }
  const nextRoot = removeLeafNode(state.root, paneId);
  if (!nextRoot) {
    return state;
  }
  const remaining = listLeafPanes(nextRoot);
  const fallbackIndex = Math.min(targetIndex, remaining.length - 1);
  const nextActiveId =
    state.activePaneId === paneId
      ? (remaining[fallbackIndex]?.id ?? remaining[0]?.id ?? state.activePaneId)
      : state.activePaneId;
  const nextZoomedId =
    remaining.length <= 1 || state.zoomedPaneId === paneId ? null : state.zoomedPaneId;

  return {
    ...state,
    root: nextRoot,
    activePaneId: nextActiveId,
    zoomedPaneId: nextZoomedId,
    focusToken: state.focusToken + 1,
  };
}

export function focusPaneById(
  state: TerminalWorkspaceState,
  paneId: string,
  bumpFocusToken = false,
): TerminalWorkspaceState {
  if (!containsPane(state.root, paneId)) {
    return state;
  }
  const nextZoomed =
    state.zoomedPaneId && state.zoomedPaneId !== paneId ? null : state.zoomedPaneId;
  if (state.activePaneId === paneId && nextZoomed === state.zoomedPaneId && !bumpFocusToken) {
    return state;
  }
  return {
    ...state,
    activePaneId: paneId,
    zoomedPaneId: nextZoomed,
    focusToken: bumpFocusToken ? state.focusToken + 1 : state.focusToken,
  };
}

export function focusRelativePane(
  state: TerminalWorkspaceState,
  delta: 1 | -1,
): TerminalWorkspaceState {
  const leaves = listLeafPanes(state.root);
  if (leaves.length <= 1) {
    return state;
  }
  const currentIndex = Math.max(
    0,
    leaves.findIndex(leaf => leaf.id === state.activePaneId),
  );
  const nextIndex = (currentIndex + delta + leaves.length) % leaves.length;
  const nextLeaf = leaves[nextIndex];
  return nextLeaf ? focusPaneById(state, nextLeaf.id, true) : state;
}

export function computeLeafRects(
  node: TerminalPaneNode,
  bounds: Omit<PaneRect, 'id'> = { x: 0, y: 0, width: 1, height: 1 },
): PaneRect[] {
  if (node.type === 'leaf') {
    return [{ id: node.id, ...bounds }];
  }
  if (node.direction === 'vertical') {
    const firstWidth = bounds.width * node.ratio;
    return [
      ...computeLeafRects(node.first, {
        x: bounds.x,
        y: bounds.y,
        width: firstWidth,
        height: bounds.height,
      }),
      ...computeLeafRects(node.second, {
        x: bounds.x + firstWidth,
        y: bounds.y,
        width: bounds.width - firstWidth,
        height: bounds.height,
      }),
    ];
  }
  const firstHeight = bounds.height * node.ratio;
  return [
    ...computeLeafRects(node.first, {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: firstHeight,
    }),
    ...computeLeafRects(node.second, {
      x: bounds.x,
      y: bounds.y + firstHeight,
      width: bounds.width,
      height: bounds.height - firstHeight,
    }),
  ];
}

function overlapLength(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

export function focusDirectionalPane(
  state: TerminalWorkspaceState,
  direction: PaneNavDirection,
): TerminalWorkspaceState {
  const rects = computeLeafRects(state.root);
  if (rects.length <= 1) {
    return state;
  }
  const active = rects.find(rect => rect.id === state.activePaneId);
  if (!active) {
    return state;
  }

  const activeCx = active.x + active.width / 2;
  const activeCy = active.y + active.height / 2;
  let bestCandidate: { id: string; score: number } | null = null;

  for (const candidate of rects) {
    if (candidate.id === active.id) {
      continue;
    }
    const candCx = candidate.x + candidate.width / 2;
    const candCy = candidate.y + candidate.height / 2;
    let primaryGap = -1;
    let crossOverlap = 0;
    let crossDist = 0;

    switch (direction) {
      case 'right':
        primaryGap = candidate.x - (active.x + active.width);
        crossOverlap = overlapLength(
          active.y,
          active.y + active.height,
          candidate.y,
          candidate.y + candidate.height,
        );
        crossDist = Math.abs(candCy - activeCy);
        break;
      case 'left':
        primaryGap = active.x - (candidate.x + candidate.width);
        crossOverlap = overlapLength(
          active.y,
          active.y + active.height,
          candidate.y,
          candidate.y + candidate.height,
        );
        crossDist = Math.abs(candCy - activeCy);
        break;
      case 'down':
        primaryGap = candidate.y - (active.y + active.height);
        crossOverlap = overlapLength(
          active.x,
          active.x + active.width,
          candidate.x,
          candidate.x + candidate.width,
        );
        crossDist = Math.abs(candCx - activeCx);
        break;
      case 'up':
        primaryGap = active.y - (candidate.y + candidate.height);
        crossOverlap = overlapLength(
          active.x,
          active.x + active.width,
          candidate.x,
          candidate.x + candidate.width,
        );
        crossDist = Math.abs(candCx - activeCx);
        break;
    }

    if (primaryGap < -EPSILON || crossOverlap <= EPSILON) {
      continue;
    }
    const score = Math.max(0, primaryGap) * 10 + crossDist;
    if (!bestCandidate || score < bestCandidate.score) {
      bestCandidate = { id: candidate.id, score };
    }
  }

  return bestCandidate ? focusPaneById(state, bestCandidate.id, true) : state;
}

function clampRatio(ratio: number): number {
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, Number(ratio.toFixed(4))));
}

function resizeTargetSplit(
  node: TerminalPaneNode,
  targetId: string,
  axis: SplitDirection,
  delta: number,
): { node: TerminalPaneNode; resized: boolean } {
  if (node.type === 'leaf') {
    return { node, resized: false };
  }
  const inFirst = containsPane(node.first, targetId);
  const inSecond = !inFirst && containsPane(node.second, targetId);
  if (!inFirst && !inSecond) {
    return { node, resized: false };
  }

  const childResult = inFirst
    ? resizeTargetSplit(node.first, targetId, axis, delta)
    : resizeTargetSplit(node.second, targetId, axis, delta);

  if (childResult.resized) {
    return {
      node: inFirst ? { ...node, first: childResult.node } : { ...node, second: childResult.node },
      resized: true,
    };
  }

  if (node.direction === axis) {
    const nextRatio = clampRatio(node.ratio + delta);
    return {
      node: nextRatio === node.ratio ? node : { ...node, ratio: nextRatio },
      resized: true,
    };
  }

  return { node, resized: false };
}

export function resizeActiveSplit(
  state: TerminalWorkspaceState,
  direction: PaneNavDirection,
  step = DEFAULT_RESIZE_STEP,
): TerminalWorkspaceState {
  const axis: SplitDirection =
    direction === 'left' || direction === 'right' ? 'vertical' : 'horizontal';
  const delta = direction === 'right' || direction === 'down' ? step : -step;
  const result = resizeTargetSplit(state.root, state.activePaneId, axis, delta);
  if (result.node === state.root) {
    return state;
  }
  return {
    ...state,
    root: result.node,
  };
}

function resetRatios(node: TerminalPaneNode): TerminalPaneNode {
  if (node.type === 'leaf') {
    return node;
  }
  return {
    ...node,
    ratio: 0.5,
    first: resetRatios(node.first),
    second: resetRatios(node.second),
  };
}

export function equalizeAllSplits(state: TerminalWorkspaceState): TerminalWorkspaceState {
  return {
    ...state,
    root: resetRatios(state.root),
  };
}

export function toggleZoomActivePane(state: TerminalWorkspaceState): TerminalWorkspaceState {
  const leaves = listLeafPanes(state.root);
  if (leaves.length <= 1) {
    return { ...state, zoomedPaneId: null };
  }
  return {
    ...state,
    zoomedPaneId: state.zoomedPaneId === state.activePaneId ? null : state.activePaneId,
    focusToken: state.focusToken + 1,
  };
}

function updateLeafTui(
  node: TerminalPaneNode,
  paneId: string,
  mode: boolean | 'toggle',
): TerminalPaneNode {
  if (node.type === 'leaf') {
    if (node.id !== paneId) {
      return node;
    }
    const nextOpen = mode === 'toggle' ? !node.tuiOpen : mode;
    return nextOpen === node.tuiOpen ? node : { ...node, tuiOpen: nextOpen };
  }
  const nextFirst = updateLeafTui(node.first, paneId, mode);
  if (nextFirst !== node.first) {
    return { ...node, first: nextFirst };
  }
  const nextSecond = updateLeafTui(node.second, paneId, mode);
  if (nextSecond !== node.second) {
    return { ...node, second: nextSecond };
  }
  return node;
}

export function setPaneTuiOpen(
  state: TerminalWorkspaceState,
  paneId: string,
  mode: boolean | 'toggle',
): TerminalWorkspaceState {
  const nextRoot = updateLeafTui(state.root, paneId, mode);
  if (nextRoot === state.root) {
    return state;
  }
  return {
    ...state,
    root: nextRoot,
  };
}

function mapArrowKeyToDirection(key: string): PaneNavDirection | null {
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

/**
 * Matches Ghostty's default split/pane keybindings across macOS (Cmd) and Linux (Ctrl+Shift /
 * Ctrl+Alt), plus browser-safe Alt+Shift fallbacks and Solar Forge's Alt+T / Alt+M shortcuts.
 */
export function matchGhosttyShortcut(event: KeyboardShortcutInput): GhosttyShortcutAction | null {
  const keyLower = event.key.toLowerCase();
  const code = event.code ?? '';
  const arrowDir = mapArrowKeyToDirection(event.key);

  // Resize active split: Ctrl+Cmd+Arrow* (macOS Ghostty) or Ctrl+Shift+Alt+Arrow* (Linux)
  if (
    arrowDir &&
    ((event.ctrlKey && event.metaKey && !event.altKey) ||
      (event.ctrlKey && event.shiftKey && event.altKey && !event.metaKey))
  ) {
    return { type: 'resize', direction: arrowDir };
  }

  // Directional split focus: Cmd+Alt+Arrow* (macOS Ghostty) or Ctrl+Alt+Arrow* (Linux Ghostty)
  if (
    arrowDir &&
    event.altKey &&
    !event.shiftKey &&
    ((event.metaKey && !event.ctrlKey) || (event.ctrlKey && !event.metaKey))
  ) {
    return { type: 'focus-direction', direction: arrowDir };
  }

  // Split right: Cmd+D (macOS Ghostty), Ctrl+Shift+O (Linux Ghostty), Alt+Shift+D (browser fallback)
  if (
    (event.metaKey &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.altKey &&
      matchesLetter(keyLower, code, 'd')) ||
    (event.ctrlKey &&
      event.shiftKey &&
      !event.metaKey &&
      !event.altKey &&
      matchesLetter(keyLower, code, 'o')) ||
    (event.altKey &&
      event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      matchesLetter(keyLower, code, 'd'))
  ) {
    return { type: 'split', direction: 'right' };
  }

  // Split down: Cmd+Shift+D (macOS Ghostty), Ctrl+Shift+E (Linux Ghostty), Alt+Shift+S (browser fallback)
  if (
    (event.metaKey &&
      event.shiftKey &&
      !event.ctrlKey &&
      !event.altKey &&
      matchesLetter(keyLower, code, 'd')) ||
    (event.ctrlKey &&
      event.shiftKey &&
      !event.metaKey &&
      !event.altKey &&
      matchesLetter(keyLower, code, 'e')) ||
    (event.altKey &&
      event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      matchesLetter(keyLower, code, 's'))
  ) {
    return { type: 'split', direction: 'down' };
  }

  // Cycle next / previous split: Cmd+] / Cmd+[ (macOS Ghostty) or Ctrl+Shift+] / Ctrl+Shift+[
  const isBracketRight = event.key === ']' || event.key === '}' || code === 'BracketRight';
  const isBracketLeft = event.key === '[' || event.key === '{' || code === 'BracketLeft';
  if (
    (event.metaKey && !event.shiftKey && !event.ctrlKey && !event.altKey && isBracketRight) ||
    (event.ctrlKey && event.shiftKey && !event.metaKey && !event.altKey && isBracketRight)
  ) {
    return { type: 'focus-relative', delta: 1 };
  }
  if (
    (event.metaKey && !event.shiftKey && !event.ctrlKey && !event.altKey && isBracketLeft) ||
    (event.ctrlKey && event.shiftKey && !event.metaKey && !event.altKey && isBracketLeft)
  ) {
    return { type: 'focus-relative', delta: -1 };
  }

  // Toggle split zoom: Cmd+Shift+Enter (macOS Ghostty) or Ctrl+Shift+Enter (Linux Ghostty)
  if (
    event.key === 'Enter' &&
    event.shiftKey &&
    !event.altKey &&
    ((event.metaKey && !event.ctrlKey) || (event.ctrlKey && !event.metaKey))
  ) {
    return { type: 'toggle-zoom' };
  }

  // Equalize splits: Cmd+Shift+= / Ctrl+Shift+=
  const isEqualKey = event.key === '=' || event.key === '+' || code === 'Equal';
  if (
    isEqualKey &&
    event.shiftKey &&
    !event.altKey &&
    ((event.metaKey && !event.ctrlKey) || (event.ctrlKey && !event.metaKey))
  ) {
    return { type: 'equalize' };
  }

  // Close active split pane: Cmd+Shift+W / Ctrl+Shift+W / Alt+Shift+W
  if (
    matchesLetter(keyLower, code, 'w') &&
    event.shiftKey &&
    ((event.metaKey && !event.ctrlKey && !event.altKey) ||
      (event.ctrlKey && !event.metaKey && !event.altKey) ||
      (event.altKey && !event.ctrlKey && !event.metaKey))
  ) {
    return { type: 'close-pane' };
  }

  // Active pane TUI toggle & launch menu shortcut
  if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    if (matchesLetter(keyLower, code, 't')) {
      return { type: 'toggle-tui' };
    }
    if (matchesLetter(keyLower, code, 'm')) {
      return { type: 'open-menu' };
    }
  }

  return null;
}
