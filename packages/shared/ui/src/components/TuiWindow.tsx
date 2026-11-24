import { type CSSProperties, type PointerEvent, type ReactNode, useRef, useState } from 'react';

import styles from './TuiWindow.module.css';

export interface TuiWindowProps {
  title: string;
  badge?: ReactNode;
  children: ReactNode;
  onClose?: () => void;
}

interface FloatingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function TuiWindow({ title, badge, children, onClose }: TuiWindowProps) {
  const [floating, setFloating] = useState<FloatingRect | null>(null);
  const frameRef = useRef<HTMLElement | null>(null);
  const dragOrigin = useRef<{ dx: number; dy: number } | null>(null);
  const resizeOrigin = useRef<{ sx: number; sy: number; sw: number; sh: number } | null>(null);

  const onDragStart = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    const rect = frameRef.current?.getBoundingClientRect();
    const base = floating ?? {
      x: rect ? rect.left : 48,
      y: rect ? rect.top : 48,
      width: rect ? rect.width : 520,
      height: rect ? rect.height : 340,
    };
    setFloating(base);
    dragOrigin.current = { dx: event.clientX - base.x, dy: event.clientY - base.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onDragMove = (event: PointerEvent<HTMLDivElement>) => {
    const origin = dragOrigin.current;
    if (!origin) return;
    setFloating(prev =>
      prev
        ? { ...prev, x: event.clientX - origin.dx, y: Math.max(8, event.clientY - origin.dy) }
        : prev,
    );
  };

  const onDragEnd = () => {
    dragOrigin.current = null;
  };

  const onResizeStart = (event: PointerEvent<HTMLDivElement>) => {
    const rect = frameRef.current?.getBoundingClientRect();
    const base = floating ?? {
      x: rect ? rect.left : 48,
      y: rect ? rect.top : 48,
      width: rect ? rect.width : 520,
      height: rect ? rect.height : 340,
    };
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
            width: Math.max(280, origin.sw + (event.clientX - origin.sx)),
            height: Math.max(180, origin.sh + (event.clientY - origin.sy)),
          }
        : prev,
    );
  };

  const onResizeEnd = () => {
    resizeOrigin.current = null;
  };

  const floatingVars = floating
    ? ({
        '--tui-x': `${floating.x}px`,
        '--tui-y': `${floating.y}px`,
        '--tui-w': `${floating.width}px`,
        '--tui-h': `${floating.height}px`,
      } as CSSProperties)
    : undefined;

  return (
    <section
      ref={frameRef}
      className={styles.window}
      data-floating={floating ? 'true' : 'false'}
      style={floatingVars}
      aria-label={title}
    >
      <div
        className={styles.titlebar}
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
      >
        <span className={styles.title}>{title}</span>
        <div className={styles.actions}>
          {badge}
          {floating ? (
            <button
              type='button'
              className={styles.iconButton}
              onClick={() => setFloating(null)}
              title='Snap back to grid'
              aria-label='Snap window back to grid'
            >
              ⊞
            </button>
          ) : null}
          {onClose ? (
            <button
              type='button'
              className={styles.iconButton}
              onClick={onClose}
              title='Close window'
              aria-label='Close window'
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
      <div className={styles.body}>{children}</div>
      <div
        className={styles.resize}
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
        aria-hidden='true'
      />
    </section>
  );
}
