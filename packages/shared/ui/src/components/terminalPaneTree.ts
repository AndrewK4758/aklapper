export type SplitDirection = 'vertical' | 'horizontal';
export type SplitCreateDirection = 'right' | 'down';
export type PaneNavDirection = 'left' | 'right' | 'up' | 'down';
export type PaneDropZone =
  | 'none'
  | 'center-swap'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'root-left'
  | 'root-right'
  | 'root-top'
  | 'root-bottom'
  | 'detach-tab';

export type TerminalPaneKind = 'terminal' | 'tui';

export interface TerminalLeafPane {
  readonly type: 'leaf';
  readonly id: string;
  readonly ttyNumber: number;
  readonly kind?: TerminalPaneKind;
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

export interface TerminalWorkspaceTab {
  readonly id: string;
  readonly title: string | null;
  readonly pinned?: boolean;
  readonly workspace: TerminalWorkspaceState;
}

export interface TerminalTabbedWorkspaceState {
  readonly tabs: readonly TerminalWorkspaceTab[];
  readonly activeTabId: string;
  readonly tabHistory: readonly string[];
  readonly nextTabNumber: number;
  readonly nextPaneNumber: number;
}

export interface PaneRect {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SplitDividerRect {
  readonly id: string;
  readonly direction: SplitDirection;
  readonly ratio: number;
  readonly x: number;
  readonly y: number;
  readonly length: number;
  readonly containerStart: number;
  readonly containerSpan: number;
}

export interface NormalizedBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PaneDropTarget {
  readonly targetId: string | null;
  readonly zone: Exclude<PaneDropZone, 'none'>;
  readonly previewRect: NormalizedBox;
  readonly label: string;
}

export type WorkspaceShortcutAction =
  | { readonly type: 'split'; readonly direction: SplitCreateDirection }
  | { readonly type: 'focus-relative'; readonly delta: 1 | -1 }
  | { readonly type: 'focus-direction'; readonly direction: PaneNavDirection }
  | { readonly type: 'resize'; readonly direction: PaneNavDirection }
  | { readonly type: 'move-split'; readonly direction: PaneNavDirection }
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

export function findTuiPane(node: TerminalPaneNode): TerminalLeafPane | null {
  if (node.type === 'leaf') {
    return node.kind === 'tui' ? node : null;
  }
  return findTuiPane(node.first) ?? findTuiPane(node.second);
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

function splitPaneWithKind(
  state: TerminalWorkspaceState,
  targetPaneId: string,
  direction: SplitCreateDirection,
  kind?: TerminalPaneKind,
): TerminalWorkspaceState {
  const paneNumber = state.nextPaneNumber;
  const newLeaf: TerminalLeafPane = {
    type: 'leaf',
    id: `pane-${paneNumber}`,
    ttyNumber: paneNumber,
    ...(kind ? { kind } : {}),
    tuiOpen: kind === 'tui',
  };
  const splitDirection: SplitDirection = direction === 'right' ? 'vertical' : 'horizontal';
  const nextRoot = splitNode(
    state.root,
    targetPaneId,
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

export function splitActivePane(
  state: TerminalWorkspaceState,
  direction: SplitCreateDirection,
): TerminalWorkspaceState {
  return splitPaneWithKind(state, state.activePaneId, direction);
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

export function computeSplitDividers(
  node: TerminalPaneNode,
  bounds: Omit<PaneRect, 'id'> = { x: 0, y: 0, width: 1, height: 1 },
): SplitDividerRect[] {
  if (node.type === 'leaf') {
    return [];
  }
  if (node.direction === 'vertical') {
    const firstWidth = bounds.width * node.ratio;
    const divider: SplitDividerRect = {
      id: node.id,
      direction: 'vertical',
      ratio: node.ratio,
      x: bounds.x + firstWidth,
      y: bounds.y,
      length: bounds.height,
      containerStart: bounds.x,
      containerSpan: bounds.width,
    };
    return [
      divider,
      ...computeSplitDividers(node.first, {
        x: bounds.x,
        y: bounds.y,
        width: firstWidth,
        height: bounds.height,
      }),
      ...computeSplitDividers(node.second, {
        x: bounds.x + firstWidth,
        y: bounds.y,
        width: bounds.width - firstWidth,
        height: bounds.height,
      }),
    ];
  }
  const firstHeight = bounds.height * node.ratio;
  const divider: SplitDividerRect = {
    id: node.id,
    direction: 'horizontal',
    ratio: node.ratio,
    x: bounds.x,
    y: bounds.y + firstHeight,
    length: bounds.width,
    containerStart: bounds.y,
    containerSpan: bounds.height,
  };
  return [
    divider,
    ...computeSplitDividers(node.first, {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: firstHeight,
    }),
    ...computeSplitDividers(node.second, {
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

function findDirectionalNeighborId(
  root: TerminalPaneNode,
  originId: string,
  direction: PaneNavDirection,
): string | null {
  const rects = computeLeafRects(root);
  if (rects.length <= 1) {
    return null;
  }
  const active = rects.find(rect => rect.id === originId);
  if (!active) {
    return null;
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

  return bestCandidate?.id ?? null;
}

export function focusDirectionalPane(
  state: TerminalWorkspaceState,
  direction: PaneNavDirection,
): TerminalWorkspaceState {
  const neighborId = findDirectionalNeighborId(state.root, state.activePaneId, direction);
  return neighborId ? focusPaneById(state, neighborId, true) : state;
}

function replaceTwoLeaves(
  node: TerminalPaneNode,
  leafA: TerminalLeafPane,
  leafB: TerminalLeafPane,
): TerminalPaneNode {
  if (node.type === 'leaf') {
    if (node.id === leafA.id) {
      return leafB;
    }
    if (node.id === leafB.id) {
      return leafA;
    }
    return node;
  }
  const nextFirst = replaceTwoLeaves(node.first, leafA, leafB);
  const nextSecond = replaceTwoLeaves(node.second, leafA, leafB);
  if (nextFirst === node.first && nextSecond === node.second) {
    return node;
  }
  return { ...node, first: nextFirst, second: nextSecond };
}

export function swapPanes(
  state: TerminalWorkspaceState,
  paneIdA: string,
  paneIdB: string,
): TerminalWorkspaceState {
  if (paneIdA === paneIdB) {
    return state;
  }
  const leafA = findLeafPane(state.root, paneIdA);
  const leafB = findLeafPane(state.root, paneIdB);
  if (!leafA || !leafB) {
    return state;
  }
  const nextRoot = replaceTwoLeaves(state.root, leafA, leafB);
  if (nextRoot === state.root) {
    return state;
  }
  return {
    ...state,
    root: nextRoot,
    activePaneId: paneIdA,
    zoomedPaneId: null,
    focusToken: state.focusToken + 1,
  };
}

function wrapTargetLeafWithPane(
  node: TerminalPaneNode,
  targetId: string,
  sourceLeaf: TerminalLeafPane,
  direction: SplitDirection,
  insertBefore: boolean,
  splitId: string,
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
      first: insertBefore ? sourceLeaf : node,
      second: insertBefore ? node : sourceLeaf,
    };
  }
  const nextFirst = wrapTargetLeafWithPane(
    node.first,
    targetId,
    sourceLeaf,
    direction,
    insertBefore,
    splitId,
  );
  if (nextFirst !== node.first) {
    return { ...node, first: nextFirst };
  }
  const nextSecond = wrapTargetLeafWithPane(
    node.second,
    targetId,
    sourceLeaf,
    direction,
    insertBefore,
    splitId,
  );
  if (nextSecond !== node.second) {
    return { ...node, second: nextSecond };
  }
  return node;
}

export function dockPane(
  state: TerminalWorkspaceState,
  sourceId: string,
  targetId: string | null,
  zone: PaneDropZone,
): TerminalWorkspaceState {
  if (zone === 'none' || zone === 'detach-tab') {
    return state;
  }
  if (zone === 'center-swap') {
    return targetId ? swapPanes(state, sourceId, targetId) : state;
  }
  const sourceLeaf = findLeafPane(state.root, sourceId);
  if (!sourceLeaf || listLeafPanes(state.root).length < 2) {
    return state;
  }

  const splitId = `split-dock-${state.focusToken + 1}`;
  const isRootZone =
    zone === 'root-left' || zone === 'root-right' || zone === 'root-top' || zone === 'root-bottom';

  if (isRootZone) {
    const remaining = removeLeafNode(state.root, sourceId);
    if (!remaining) {
      return state;
    }
    const direction: SplitDirection =
      zone === 'root-left' || zone === 'root-right' ? 'vertical' : 'horizontal';
    const insertFirst = zone === 'root-left' || zone === 'root-top';
    const nextRoot: TerminalSplitPane = {
      type: 'split',
      id: splitId,
      direction,
      ratio: 0.5,
      first: insertFirst ? sourceLeaf : remaining,
      second: insertFirst ? remaining : sourceLeaf,
    };
    return {
      ...state,
      root: nextRoot,
      activePaneId: sourceId,
      zoomedPaneId: null,
      focusToken: state.focusToken + 1,
    };
  }

  if (!targetId || targetId === sourceId || !containsPane(state.root, targetId)) {
    return state;
  }
  const remaining = removeLeafNode(state.root, sourceId);
  if (!remaining) {
    return state;
  }
  const direction: SplitDirection = zone === 'left' || zone === 'right' ? 'vertical' : 'horizontal';
  const insertBefore = zone === 'left' || zone === 'top';
  const nextRoot = wrapTargetLeafWithPane(
    remaining,
    targetId,
    sourceLeaf,
    direction,
    insertBefore,
    splitId,
  );
  if (nextRoot === remaining) {
    return state;
  }
  return {
    ...state,
    root: nextRoot,
    activePaneId: sourceId,
    zoomedPaneId: null,
    focusToken: state.focusToken + 1,
  };
}

export function moveActiveSplit(
  state: TerminalWorkspaceState,
  direction: PaneNavDirection,
): TerminalWorkspaceState {
  if (state.zoomedPaneId || listLeafPanes(state.root).length < 2) {
    return state;
  }
  const neighborId = findDirectionalNeighborId(state.root, state.activePaneId, direction);
  if (neighborId) {
    return swapPanes(state, state.activePaneId, neighborId);
  }
  const rootZone: PaneDropZone =
    direction === 'left'
      ? 'root-left'
      : direction === 'right'
        ? 'root-right'
        : direction === 'up'
          ? 'root-top'
          : 'root-bottom';
  return dockPane(state, state.activePaneId, null, rootZone);
}

export function swapActivePaneWithNeighbor(state: TerminalWorkspaceState): TerminalWorkspaceState {
  if (state.zoomedPaneId || listLeafPanes(state.root).length < 2) {
    return state;
  }
  const directions: readonly PaneNavDirection[] = ['right', 'left', 'down', 'up'];
  for (const direction of directions) {
    const neighborId = findDirectionalNeighborId(state.root, state.activePaneId, direction);
    if (neighborId) {
      return swapPanes(state, state.activePaneId, neighborId);
    }
  }
  return state;
}

function flipParentSplitOrientation(
  node: TerminalPaneNode,
  targetId: string,
): { node: TerminalPaneNode; rotated: boolean } {
  if (node.type === 'leaf') {
    return { node, rotated: false };
  }
  const isDirectChild =
    (node.first.type === 'leaf' && node.first.id === targetId) ||
    (node.second.type === 'leaf' && node.second.id === targetId);
  if (isDirectChild) {
    return {
      node: {
        ...node,
        direction: node.direction === 'vertical' ? 'horizontal' : 'vertical',
      },
      rotated: true,
    };
  }
  const firstRes = flipParentSplitOrientation(node.first, targetId);
  if (firstRes.rotated) {
    return { node: { ...node, first: firstRes.node }, rotated: true };
  }
  const secondRes = flipParentSplitOrientation(node.second, targetId);
  if (secondRes.rotated) {
    return { node: { ...node, second: secondRes.node }, rotated: true };
  }
  return { node, rotated: false };
}

export function rotateActiveSplit(state: TerminalWorkspaceState): TerminalWorkspaceState {
  if (state.zoomedPaneId || listLeafPanes(state.root).length < 2) {
    return state;
  }
  const res = flipParentSplitOrientation(state.root, state.activePaneId);
  if (!res.rotated) {
    return state;
  }
  return {
    ...state,
    root: res.node,
    focusToken: state.focusToken + 1,
  };
}

export interface DropTargetOptions {
  readonly allowDetachTab?: boolean;
  readonly detachBandHeight?: number;
}

const ROOT_EDGE_MARGIN_PX = 18;
const DEFAULT_DETACH_BAND_PX = 52;

/**
 * Pure geometric drop-zone resolver for pane drag-and-drop: tab-strip detach band, 18px outer
 * root-dock margins, and per-pane center-swap / 25% edge zones.
 */
export function computePaneDropTarget(
  root: TerminalPaneNode,
  sourceId: string,
  point: { readonly x: number; readonly y: number },
  containerRect: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  },
  options?: DropTargetOptions,
): PaneDropTarget | null {
  if (containerRect.width <= 0 || containerRect.height <= 0) {
    return null;
  }
  const leaves = listLeafPanes(root);
  if (leaves.length < 2 || !leaves.some(leaf => leaf.id === sourceId)) {
    return null;
  }

  const localX = point.x - containerRect.left;
  const localY = point.y - containerRect.top;
  const detachBand = options?.detachBandHeight ?? DEFAULT_DETACH_BAND_PX;

  if (
    options?.allowDetachTab &&
    localY < 0 &&
    localY >= -detachBand &&
    localX >= 0 &&
    localX <= containerRect.width
  ) {
    return {
      targetId: null,
      zone: 'detach-tab',
      previewRect: { x: 0, y: 0, width: 1, height: 0.14 },
      label: 'Move Split to New Tab',
    };
  }

  if (localX < 0 || localX > containerRect.width || localY < 0 || localY > containerRect.height) {
    return null;
  }

  const dLeft = localX;
  const dRight = containerRect.width - localX;
  const dTop = localY;
  const dBottom = containerRect.height - localY;
  const minEdgeDist = Math.min(dLeft, dRight, dTop, dBottom);

  if (minEdgeDist < ROOT_EDGE_MARGIN_PX) {
    let zone: PaneDropTarget['zone'];
    let candidateAxis: SplitDirection;
    let previewRect: NormalizedBox;
    let label: string;
    if (minEdgeDist === dLeft) {
      zone = 'root-left';
      candidateAxis = 'vertical';
      previewRect = { x: 0, y: 0, width: 1 / 3, height: 1 };
      label = 'Dock Full Left';
    } else if (minEdgeDist === dRight) {
      zone = 'root-right';
      candidateAxis = 'vertical';
      previewRect = { x: 2 / 3, y: 0, width: 1 / 3, height: 1 };
      label = 'Dock Full Right';
    } else if (minEdgeDist === dTop) {
      zone = 'root-top';
      candidateAxis = 'horizontal';
      previewRect = { x: 0, y: 0, width: 1, height: 1 / 3 };
      label = 'Dock Full Top';
    } else {
      zone = 'root-bottom';
      candidateAxis = 'horizontal';
      previewRect = { x: 0, y: 2 / 3, width: 1, height: 1 / 3 };
      label = 'Dock Full Bottom';
    }

    if (leaves.length > 2 || (root.type === 'split' && root.direction !== candidateAxis)) {
      return { targetId: null, zone, previewRect, label };
    }
  }

  const normX = localX / containerRect.width;
  const normY = localY / containerRect.height;
  const rects = computeLeafRects(root);
  const candidate = rects.find(
    rect =>
      normX >= rect.x - EPSILON &&
      normX <= rect.x + rect.width + EPSILON &&
      normY >= rect.y - EPSILON &&
      normY <= rect.y + rect.height + EPSILON,
  );
  if (!candidate || candidate.id === sourceId) {
    return null;
  }

  const rx = (normX - candidate.x) / Math.max(EPSILON, candidate.width);
  const ry = (normY - candidate.y) / Math.max(EPSILON, candidate.height);
  const eL = rx;
  const eR = 1 - rx;
  const eT = ry;
  const eB = 1 - ry;
  const minNorm = Math.min(eL, eR, eT, eB);

  if (minNorm >= 0.25) {
    return {
      targetId: candidate.id,
      zone: 'center-swap',
      previewRect: {
        x: candidate.x,
        y: candidate.y,
        width: candidate.width,
        height: candidate.height,
      },
      label: 'Swap Panes',
    };
  }

  if (minNorm === eL) {
    return {
      targetId: candidate.id,
      zone: 'left',
      previewRect: {
        x: candidate.x,
        y: candidate.y,
        width: candidate.width / 2,
        height: candidate.height,
      },
      label: 'Dock Left',
    };
  }
  if (minNorm === eR) {
    return {
      targetId: candidate.id,
      zone: 'right',
      previewRect: {
        x: candidate.x + candidate.width / 2,
        y: candidate.y,
        width: candidate.width / 2,
        height: candidate.height,
      },
      label: 'Dock Right',
    };
  }
  if (minNorm === eT) {
    return {
      targetId: candidate.id,
      zone: 'top',
      previewRect: {
        x: candidate.x,
        y: candidate.y,
        width: candidate.width,
        height: candidate.height / 2,
      },
      label: 'Dock Top',
    };
  }
  return {
    targetId: candidate.id,
    zone: 'bottom',
    previewRect: {
      x: candidate.x,
      y: candidate.y + candidate.height / 2,
      width: candidate.width,
      height: candidate.height / 2,
    },
    label: 'Dock Bottom',
  };
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

function updateSplitRatioById(
  node: TerminalPaneNode,
  splitId: string,
  ratio: number,
): TerminalPaneNode {
  if (node.type === 'leaf') {
    return node;
  }
  if (node.id === splitId) {
    const nextRatio = clampRatio(ratio);
    return nextRatio === node.ratio ? node : { ...node, ratio: nextRatio };
  }
  const nextFirst = updateSplitRatioById(node.first, splitId, ratio);
  if (nextFirst !== node.first) {
    return { ...node, first: nextFirst };
  }
  const nextSecond = updateSplitRatioById(node.second, splitId, ratio);
  if (nextSecond !== node.second) {
    return { ...node, second: nextSecond };
  }
  return node;
}

export function setSplitRatio(
  state: TerminalWorkspaceState,
  splitId: string,
  ratio: number,
): TerminalWorkspaceState {
  const nextRoot = updateSplitRatioById(state.root, splitId, ratio);
  if (nextRoot === state.root) {
    return state;
  }
  return {
    ...state,
    root: nextRoot,
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

export function openTuiPane(
  state: TerminalWorkspaceState,
  anchorPaneId?: string,
  direction: SplitCreateDirection = 'right',
): TerminalWorkspaceState {
  const existing = findTuiPane(state.root);
  if (existing) {
    return focusPaneById(state, existing.id, true);
  }
  const targetPaneId =
    anchorPaneId && containsPane(state.root, anchorPaneId) ? anchorPaneId : state.activePaneId;
  return splitPaneWithKind(state, targetPaneId, direction, 'tui');
}

export function toggleTuiPane(
  state: TerminalWorkspaceState,
  anchorPaneId?: string,
  direction: SplitCreateDirection = 'right',
): TerminalWorkspaceState {
  const existing = findTuiPane(state.root);
  if (existing && state.activePaneId === existing.id) {
    return closePaneById(state, existing.id);
  }
  return openTuiPane(state, anchorPaneId, direction);
}

function recordTabHistory(history: readonly string[], tabId: string): readonly string[] {
  return [tabId, ...history.filter(id => id !== tabId)];
}

export function createInitialTabbedWorkspaceState(
  options?: InitialWorkspaceOptions,
): TerminalTabbedWorkspaceState {
  const initialWorkspace = createInitialWorkspaceState(options);
  return {
    tabs: [
      {
        id: 'tab-1',
        title: null,
        ...(options?.pinnedPrimary ? { pinned: true } : {}),
        workspace: initialWorkspace,
      },
    ],
    activeTabId: 'tab-1',
    tabHistory: ['tab-1'],
    nextTabNumber: 2,
    nextPaneNumber: initialWorkspace.nextPaneNumber,
  };
}

export function getActiveWorkspaceTab(state: TerminalTabbedWorkspaceState): TerminalWorkspaceTab {
  return state.tabs.find(tab => tab.id === state.activeTabId) ?? state.tabs[0]!;
}

export function updateActiveTabWorkspace(
  state: TerminalTabbedWorkspaceState,
  updater: (workspace: TerminalWorkspaceState) => TerminalWorkspaceState,
): TerminalTabbedWorkspaceState {
  const activeTab = getActiveWorkspaceTab(state);
  const syncedWorkspace: TerminalWorkspaceState =
    activeTab.workspace.nextPaneNumber < state.nextPaneNumber
      ? { ...activeTab.workspace, nextPaneNumber: state.nextPaneNumber }
      : activeTab.workspace;
  const nextWorkspace = updater(syncedWorkspace);
  if (nextWorkspace === syncedWorkspace) {
    return state;
  }
  const nextPaneNumber = Math.max(state.nextPaneNumber, nextWorkspace.nextPaneNumber);
  return {
    ...state,
    nextPaneNumber,
    tabs: state.tabs.map(tab =>
      tab.id === activeTab.id ? { ...tab, workspace: nextWorkspace } : tab,
    ),
  };
}

export function addWorkspaceTab(state: TerminalTabbedWorkspaceState): TerminalTabbedWorkspaceState {
  const tabNumber = state.nextTabNumber;
  const paneNumber = state.nextPaneNumber;
  const leaf: TerminalLeafPane = {
    type: 'leaf',
    id: `pane-${paneNumber}`,
    ttyNumber: paneNumber,
    tuiOpen: false,
  };
  const newTab: TerminalWorkspaceTab = {
    id: `tab-${tabNumber}`,
    title: null,
    workspace: {
      root: leaf,
      activePaneId: leaf.id,
      zoomedPaneId: null,
      nextPaneNumber: paneNumber + 1,
      focusToken: 1,
    },
  };
  return {
    tabs: [...state.tabs, newTab],
    activeTabId: newTab.id,
    tabHistory: recordTabHistory(state.tabHistory, newTab.id),
    nextTabNumber: tabNumber + 1,
    nextPaneNumber: paneNumber + 1,
  };
}

export function selectWorkspaceTab(
  state: TerminalTabbedWorkspaceState,
  tabId: string,
): TerminalTabbedWorkspaceState {
  const target = state.tabs.find(tab => tab.id === tabId);
  if (!target) {
    return state;
  }
  if (state.activeTabId === tabId) {
    return state;
  }
  return {
    ...state,
    activeTabId: tabId,
    tabHistory: recordTabHistory(state.tabHistory, tabId),
    tabs: state.tabs.map(tab =>
      tab.id === tabId
        ? {
            ...tab,
            workspace: {
              ...tab.workspace,
              focusToken: tab.workspace.focusToken + 1,
            },
          }
        : tab,
    ),
  };
}

export function selectRelativeWorkspaceTab(
  state: TerminalTabbedWorkspaceState,
  delta: 1 | -1,
): TerminalTabbedWorkspaceState {
  if (state.tabs.length <= 1) {
    return state;
  }
  const currentIdx = Math.max(
    0,
    state.tabs.findIndex(tab => tab.id === state.activeTabId),
  );
  const nextIdx = (currentIdx + delta + state.tabs.length) % state.tabs.length;
  const nextTab = state.tabs[nextIdx];
  return nextTab ? selectWorkspaceTab(state, nextTab.id) : state;
}

export function selectWorkspaceTabByIndex(
  state: TerminalTabbedWorkspaceState,
  index: number | 'last',
): TerminalTabbedWorkspaceState {
  if (state.tabs.length === 0) {
    return state;
  }
  const resolvedIndex = index === 'last' ? state.tabs.length - 1 : index;
  const target = state.tabs[resolvedIndex];
  return target ? selectWorkspaceTab(state, target.id) : state;
}

export function renameWorkspaceTab(
  state: TerminalTabbedWorkspaceState,
  tabId: string,
  title: string | null,
): TerminalTabbedWorkspaceState {
  const normalized = title?.trim() ? title.trim() : null;
  let changed = false;
  const nextTabs = state.tabs.map(tab => {
    if (tab.id !== tabId) {
      return tab;
    }
    if (tab.title === normalized) {
      return tab;
    }
    changed = true;
    return { ...tab, title: normalized };
  });
  return changed ? { ...state, tabs: nextTabs } : state;
}

export function closeWorkspaceTab(
  state: TerminalTabbedWorkspaceState,
  tabId: string,
): TerminalTabbedWorkspaceState {
  if (state.tabs.length <= 1) {
    return state;
  }
  const targetIndex = state.tabs.findIndex(tab => tab.id === tabId);
  const target = state.tabs[targetIndex];
  if (!target || target.pinned) {
    return state;
  }

  const remainingTabs = state.tabs.filter(tab => tab.id !== tabId);
  const remainingHistory = state.tabHistory.filter(id => id !== tabId);
  let nextActiveTabId = state.activeTabId;
  if (state.activeTabId === tabId) {
    const mruTabId = remainingHistory.find(id => remainingTabs.some(tab => tab.id === id));
    const fallbackTab = remainingTabs[Math.min(targetIndex, remainingTabs.length - 1)];
    nextActiveTabId = mruTabId ?? fallbackTab?.id ?? remainingTabs[0]!.id;
  }

  const nextTabs = remainingTabs.map(tab =>
    tab.id === nextActiveTabId && state.activeTabId === tabId
      ? {
          ...tab,
          workspace: {
            ...tab.workspace,
            focusToken: tab.workspace.focusToken + 1,
          },
        }
      : tab,
  );

  return {
    ...state,
    tabs: nextTabs,
    activeTabId: nextActiveTabId,
    tabHistory: recordTabHistory(remainingHistory, nextActiveTabId),
  };
}

export function closeActivePaneOrTab(
  state: TerminalTabbedWorkspaceState,
): TerminalTabbedWorkspaceState {
  const activeTab = getActiveWorkspaceTab(state);
  const leaves = listLeafPanes(activeTab.workspace.root);
  if (leaves.length > 1) {
    return updateActiveTabWorkspace(state, workspace =>
      closePaneById(workspace, workspace.activePaneId),
    );
  }
  return closeWorkspaceTab(state, activeTab.id);
}

export function detachPaneToNewTab(
  state: TerminalTabbedWorkspaceState,
  paneId: string,
): TerminalTabbedWorkspaceState {
  const activeTab = getActiveWorkspaceTab(state);
  const leaves = listLeafPanes(activeTab.workspace.root);
  if (leaves.length < 2) {
    return state;
  }
  const targetLeaf = leaves.find(leaf => leaf.id === paneId);
  if (!targetLeaf || targetLeaf.pinned) {
    return state;
  }

  const nextSourceWorkspace = closePaneById(activeTab.workspace, paneId);
  if (nextSourceWorkspace === activeTab.workspace) {
    return state;
  }

  const tabNumber = state.nextTabNumber;
  const detachedTab: TerminalWorkspaceTab = {
    id: `tab-${tabNumber}`,
    title: null,
    workspace: {
      root: targetLeaf,
      activePaneId: targetLeaf.id,
      zoomedPaneId: null,
      nextPaneNumber: state.nextPaneNumber,
      focusToken: 1,
    },
  };

  return {
    tabs: [
      ...state.tabs.map(tab =>
        tab.id === activeTab.id ? { ...tab, workspace: nextSourceWorkspace } : tab,
      ),
      detachedTab,
    ],
    activeTabId: detachedTab.id,
    tabHistory: recordTabHistory(state.tabHistory, detachedTab.id),
    nextTabNumber: tabNumber + 1,
    nextPaneNumber: state.nextPaneNumber,
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
  return null;
}

/**
 * Matches split/pane/tab keybindings across Linux (`Ctrl+Shift+}`/`]`/`O`, `Ctrl+Shift+{`/`[`/`E`,
 * `Ctrl+Alt+Arrow`, `Alt+Shift+Arrow`, `Ctrl+Alt+Shift+Arrow`, `Ctrl+Shift+R`, `Ctrl+Alt+Shift+E`,
 * `Ctrl+Shift+T`/`A`/`W`, `Ctrl+Tab`/`PageUp`/`PageDown`, `Alt+1..9`) and macOS (`Cmd+D`,
 * `Cmd+Shift+D`, `Cmd+]`/`[`, `Cmd+Alt+Arrow`, `Ctrl+Cmd+Arrow`), plus browser-safe
 * `Alt`/`Alt+Shift` fallbacks and Solar Forge's `Alt+T` / `Alt+M` shortcuts.
 */
export function matchWorkspaceShortcut(
  event: KeyboardShortcutInput,
): WorkspaceShortcutAction | null {
  const keyLower = event.key.toLowerCase();
  const code = event.code ?? '';
  const arrowDir = mapArrowKeyToDirection(event.key);
  const isBracketRight = event.key === ']' || event.key === '}' || code === 'BracketRight';
  const isBracketLeft = event.key === '[' || event.key === '{' || code === 'BracketLeft';
  const isCtrlShiftOnly = event.ctrlKey && event.shiftKey && !event.metaKey && !event.altKey;
  const isCtrlAltShiftOnly = event.ctrlKey && event.altKey && event.shiftKey && !event.metaKey;
  const isAltShiftOnly = event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey;

  // Move / swap active split directionally: Ctrl+Alt+Shift+Arrow*
  if (arrowDir && isCtrlAltShiftOnly) {
    return { type: 'move-split', direction: arrowDir };
  }

  // Resize active split: Alt+Shift+Arrow* or Ctrl+Cmd+Arrow*
  if (arrowDir && (isAltShiftOnly || (event.ctrlKey && event.metaKey && !event.altKey))) {
    return { type: 'resize', direction: arrowDir };
  }

  // Directional split focus: Cmd+Alt+Arrow* or Ctrl+Alt+Arrow*
  if (
    arrowDir &&
    event.altKey &&
    !event.shiftKey &&
    ((event.metaKey && !event.ctrlKey) || (event.ctrlKey && !event.metaKey))
  ) {
    return { type: 'focus-direction', direction: arrowDir };
  }

  // Split right (side-by-side): Ctrl+Shift+}/], Ctrl+Shift+O, Cmd+D, Alt+Shift+D (browser fallback)
  if (
    (event.metaKey &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.altKey &&
      matchesLetter(keyLower, code, 'd')) ||
    (isCtrlShiftOnly && (isBracketRight || matchesLetter(keyLower, code, 'o'))) ||
    (isAltShiftOnly && matchesLetter(keyLower, code, 'd'))
  ) {
    return { type: 'split', direction: 'right' };
  }

  // Split down (stacked): Ctrl+Shift+{/[, Ctrl+Shift+E, Cmd+Shift+D, Alt+Shift+S (browser fallback)
  if (
    (event.metaKey &&
      event.shiftKey &&
      !event.ctrlKey &&
      !event.altKey &&
      matchesLetter(keyLower, code, 'd')) ||
    (isCtrlShiftOnly && (isBracketLeft || matchesLetter(keyLower, code, 'e'))) ||
    (isAltShiftOnly && matchesLetter(keyLower, code, 's'))
  ) {
    return { type: 'split', direction: 'down' };
  }

  // Rotate active split orientation: Ctrl+Shift+R or Ctrl+Alt+Shift+R (browser-safe)
  if ((isCtrlShiftOnly || isCtrlAltShiftOnly) && matchesLetter(keyLower, code, 'r')) {
    return { type: 'rotate-split' };
  }

  // Detach active split pane to a new tab: Ctrl+Alt+Shift+T
  if (isCtrlAltShiftOnly && matchesLetter(keyLower, code, 't')) {
    return { type: 'detach-pane' };
  }

  // New tab: Ctrl+Shift+T or Alt+Shift+T (browser-safe)
  if ((isCtrlShiftOnly || isAltShiftOnly) && matchesLetter(keyLower, code, 't')) {
    return { type: 'new-tab' };
  }

  // Rename active tab: Ctrl+Shift+A or Alt+Shift+A (browser-safe)
  if ((isCtrlShiftOnly || isAltShiftOnly) && matchesLetter(keyLower, code, 'a')) {
    return { type: 'rename-tab' };
  }

  // Tab switching: Ctrl+Tab / Ctrl+PageDown (next), Ctrl+Shift+Tab / Ctrl+PageUp (prev)
  if (event.ctrlKey && !event.metaKey && !event.altKey) {
    if ((event.key === 'Tab' && !event.shiftKey) || event.key === 'PageDown') {
      return { type: 'focus-tab-relative', delta: 1 };
    }
    if ((event.key === 'Tab' && event.shiftKey) || event.key === 'PageUp') {
      return { type: 'focus-tab-relative', delta: -1 };
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

  // Equalize splits: Ctrl+Alt+Shift+E, Cmd+Shift+= / Ctrl+Shift+=
  const isEqualKey = event.key === '=' || event.key === '+' || code === 'Equal';
  if (
    (isCtrlAltShiftOnly && matchesLetter(keyLower, code, 'e')) ||
    (isEqualKey &&
      event.shiftKey &&
      !event.altKey &&
      ((event.metaKey && !event.ctrlKey) || (event.ctrlKey && !event.metaKey)))
  ) {
    return { type: 'equalize' };
  }

  // Close active split pane (or active tab if last pane): Cmd+Shift+W / Ctrl+Shift+W / Alt+Shift+W
  if (
    matchesLetter(keyLower, code, 'w') &&
    event.shiftKey &&
    ((event.metaKey && !event.ctrlKey && !event.altKey) ||
      (event.ctrlKey && !event.metaKey && !event.altKey) ||
      (event.altKey && !event.ctrlKey && !event.metaKey))
  ) {
    return { type: 'close-pane' };
  }

  // Alt-only shortcuts: Alt+1..9 tab switching, Alt+]/[ tab cycling, Alt+T TUI toggle, Alt+M launch menu
  if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    const tabIndex = parseDigitIndex(event.key, code);
    if (tabIndex !== null) {
      return { type: 'focus-tab-index', index: tabIndex };
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
