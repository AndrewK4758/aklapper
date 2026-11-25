import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

import { Button } from '../elements/base';
import { ScrollArea } from '../elements/base';
import { Toolbar } from '../elements/base';
import { Tooltip } from '../elements/base';
import { useIsPaneActive } from './paneActiveContext';
import { usePaneNavigation } from './paneNavigationContext';
import { useViewportLayoutMode } from './terminalViewportSplit';

import styles from './TuiWindow.module.css';

export interface TuiWindowProps {
  title: string;
  badge?: ReactNode;
  children: ReactNode;
  onClose?: () => void;
  closeOnEscape?: boolean;
  docked?: boolean;
}

function formatStackSegmentLabel(viewId: string): string {
  if (viewId === 'tui') return 'Launcher';
  const cleaned = viewId.replace(/^\/+/, '');
  if (!cleaned) return 'Home';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

interface FloatingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const KEYBOARD_MOVE_STEP = 16;
const KEYBOARD_RESIZE_STEP = 24;
const MIN_WINDOW_WIDTH = 280;
const MIN_WINDOW_HEIGHT = 180;
const MIN_WINDOW_TOP = 8;

function getBaseRect(frame: HTMLElement | null, current: FloatingRect | null): FloatingRect {
  if (current) return current;
  const rect = frame?.getBoundingClientRect();
  return {
    x: rect ? rect.left : 48,
    y: rect ? rect.top : 48,
    width: rect && rect.width > 0 ? rect.width : 520,
    height: rect && rect.height > 0 ? rect.height : 340,
  };
}

interface WindowControlButtonProps {
  label: string;
  glyph: string;
  onClick: () => void;
}

function WindowControlButton({ label, glyph, onClick }: WindowControlButtonProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <Button.Root
            type='button'
            size='xs'
            className={styles.iconButton}
            onClick={onClick}
            aria-label={label}
          >
            <Button.Icon aria-hidden='true'>{glyph}</Button.Icon>
          </Button.Root>
        }
      />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup>{label}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function TuiWindow({
  title,
  badge,
  children,
  onClose,
  closeOnEscape = true,
  docked: dockedProp,
}: TuiWindowProps) {
  const isPaneActive = useIsPaneActive();
  const paneNav = usePaneNavigation();
  const layoutMode = useViewportLayoutMode();
  const isDocked = dockedProp ?? (Boolean(paneNav?.docked) || layoutMode !== 'desktop');
  const [floating, setFloating] = useState<FloatingRect | null>(null);
  const frameRef = useRef<HTMLElement | null>(null);
  const dragOrigin = useRef<{ dx: number; dy: number } | null>(null);
  const resizeOrigin = useRef<{ sx: number; sy: number; sw: number; sh: number } | null>(null);

  useEffect(() => {
    if (isDocked || !onClose || !closeOnEscape || !isPaneActive) return;
    const handleWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [closeOnEscape, isDocked, isPaneActive, onClose]);

  const onDragStart = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button:not([data-drag-handle])')) return;
    const base = getBaseRect(frameRef.current, floating);
    setFloating(base);
    dragOrigin.current = { dx: event.clientX - base.x, dy: event.clientY - base.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onDragMove = (event: PointerEvent<HTMLDivElement>) => {
    const origin = dragOrigin.current;
    if (!origin) return;
    setFloating(prev =>
      prev
        ? {
            ...prev,
            x: event.clientX - origin.dx,
            y: Math.max(MIN_WINDOW_TOP, event.clientY - origin.dy),
          }
        : prev,
    );
  };

  const onDragEnd = () => {
    dragOrigin.current = null;
  };

  const onResizeStart = (event: PointerEvent<HTMLDivElement>) => {
    const base = getBaseRect(frameRef.current, floating);
    setFloating(base);
    resizeOrigin.current = {
      sx: event.clientX,
      sy: event.clientY,
      sw: base.width,
      sh: base.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onResizeMove = (event: PointerEvent<HTMLDivElement>) => {
    const origin = resizeOrigin.current;
    if (!origin) return;
    setFloating(prev =>
      prev
        ? {
            ...prev,
            width: Math.max(MIN_WINDOW_WIDTH, origin.sw + (event.clientX - origin.sx)),
            height: Math.max(MIN_WINDOW_HEIGHT, origin.sh + (event.clientY - origin.sy)),
          }
        : prev,
    );
  };

  const onResizeEnd = () => {
    resizeOrigin.current = null;
  };

  const onTitleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key === '0' || event.key === 'Home') {
      event.preventDefault();
      setFloating(null);
      return;
    }

    if (event.key === 'Escape' && onClose) {
      event.preventDefault();
      onClose();
      return;
    }

    const deltas: Record<string, readonly [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const delta = deltas[event.key];
    if (!delta) return;

    event.preventDefault();
    const [dx, dy] = delta;
    const base = getBaseRect(frameRef.current, floating);
    if (event.shiftKey) {
      setFloating({
        ...base,
        width: Math.max(MIN_WINDOW_WIDTH, base.width + dx * KEYBOARD_RESIZE_STEP),
        height: Math.max(MIN_WINDOW_HEIGHT, base.height + dy * KEYBOARD_RESIZE_STEP),
      });
    } else {
      setFloating({
        ...base,
        x: base.x + dx * KEYBOARD_MOVE_STEP,
        y: Math.max(MIN_WINDOW_TOP, base.y + dy * KEYBOARD_MOVE_STEP),
      });
    }
  };

  const effectiveFloating = isDocked ? null : floating;
  const floatingVars = effectiveFloating
    ? ({
        '--tui-x': `${effectiveFloating.x}px`,
        '--tui-y': `${effectiveFloating.y}px`,
        '--tui-w': `${effectiveFloating.width}px`,
        '--tui-h': `${effectiveFloating.height}px`,
      } as CSSProperties)
    : undefined;

  const canGoBack = Boolean(isDocked && paneNav?.canGoBack);
  const handleExitTui = isDocked && paneNav ? paneNav.exitTui : onClose;
  const hasControls = Boolean(effectiveFloating || handleExitTui);
  const parentTrail =
    isDocked && paneNav && paneNav.stack.length > 1
      ? paneNav.stack.slice(0, -1).map(formatStackSegmentLabel).join(' › ')
      : null;

  return (
    <section
      ref={frameRef}
      className={styles.window}
      data-docked={isDocked ? 'true' : 'false'}
      data-floating={effectiveFloating ? 'true' : 'false'}
      style={floatingVars}
      aria-label={title}
    >
      <div
        className={styles.titlebar}
        data-tui-titlebar='true'
        onPointerDown={isDocked ? undefined : onDragStart}
        onPointerMove={isDocked ? undefined : onDragMove}
        onPointerUp={isDocked ? undefined : onDragEnd}
      >
        <div className={styles.titleGroup}>
          {canGoBack && paneNav ? (
            <Button.Root
              type='button'
              size='xs'
              className={styles.backButton}
              onClick={paneNav.pop}
              aria-label='Go back'
            >
              <Button.Icon aria-hidden='true'>←</Button.Icon>
              <Button.Label>Back</Button.Label>
            </Button.Root>
          ) : null}
          {isDocked ? (
            <span className={styles.title}>
              {parentTrail ? (
                <span className={styles.breadcrumbTrail}>{parentTrail} › </span>
              ) : null}
              {title}
            </span>
          ) : (
            <button
              type='button'
              className={styles.title}
              data-drag-handle='true'
              aria-label={`${title} window handle — arrows move, Shift+arrows resize, 0 snaps to grid`}
              onKeyDown={onTitleKeyDown}
            >
              {title}
            </button>
          )}
        </div>
        <div className={styles.actions}>
          {badge}
          {hasControls ? (
            <Toolbar.Root className={styles.actionToolbar} aria-label={`${title} window controls`}>
              {effectiveFloating ? (
                <WindowControlButton
                  label='Snap window back to grid'
                  glyph='⊞'
                  onClick={() => setFloating(null)}
                />
              ) : null}
              {handleExitTui ? (
                <WindowControlButton
                  label={isDocked ? 'Exit TUI' : 'Close window'}
                  glyph='×'
                  onClick={handleExitTui}
                />
              ) : null}
            </Toolbar.Root>
          ) : null}
        </div>
      </div>
      <ScrollArea.Root className={styles.scrollRoot}>
        <ScrollArea.Viewport className={styles.bodyViewport}>
          <ScrollArea.Content className={styles.body}>{children}</ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation='vertical'>
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
      {isDocked ? null : (
        <div
          className={styles.resize}
          data-resize-handle='true'
          onPointerDown={onResizeStart}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeEnd}
          aria-hidden='true'
        />
      )}
    </section>
  );
}
