import { useEffect, useRef, type ReactNode } from 'react';

import { cx } from '../elements/_internal/elementFactory';
import { ScrollArea } from '../elements/base/ScrollArea';
import { StatusPill } from '../elements/StatusPill';

import styles from './StreamingTextFeed.module.css';

export interface StreamingTextFeedProps {
  readonly content: string;
  readonly isStreaming: boolean;
  readonly ariaLabel?: string;
  readonly emptyText?: string;
  readonly header?: ReactNode;
  readonly statusLabel?: string;
  readonly className?: string;
}

const BOTTOM_PIN_THRESHOLD_RATIO = 0.05;
const BOTTOM_PIN_MIN_TOLERANCE = 24;

export function StreamingTextFeed({
  content,
  isStreaming,
  ariaLabel = 'Streaming output',
  emptyText = 'Waiting for output...',
  header,
  statusLabel,
  className,
}: StreamingTextFeedProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pinnedToBottomRef = useRef(true);

  const handleViewportScroll = (): void => {
    const el = viewportRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const tolerance = Math.max(
      BOTTOM_PIN_MIN_TOLERANCE,
      el.clientHeight * BOTTOM_PIN_THRESHOLD_RATIO,
    );
    pinnedToBottomRef.current = distanceFromBottom <= tolerance;
  };

  // Synchronize imperative browser DOM scroll box when pinned to bottom during active appends.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !pinnedToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [content, isStreaming]);

  const hasContent = content.length > 0;

  return (
    <section className={cx(styles.feed, className)} data-streaming={isStreaming ? 'true' : 'false'}>
      {header !== undefined || statusLabel !== undefined ? (
        <header className={styles.header}>
          <div className={styles.headerContent}>{header}</div>
          {statusLabel !== undefined ? (
            <StatusPill
              tone={isStreaming ? 'accent' : 'neutral'}
              size='sm'
              pulse={isStreaming}
              as='output'
            >
              {statusLabel}
            </StatusPill>
          ) : null}
        </header>
      ) : null}

      <ScrollArea.Root className={styles.scrollRoot}>
        <ScrollArea.Viewport
          ref={viewportRef}
          className={styles.viewport}
          onScroll={handleViewportScroll}
          role='log'
          aria-live='polite'
          aria-relevant='additions text'
          aria-busy={isStreaming}
          aria-label={ariaLabel}
        >
          <ScrollArea.Content className={styles.content}>
            {hasContent ? (
              <pre className={styles.output}>
                {content}
                {isStreaming ? <span className={styles.caret} aria-hidden='true' /> : null}
              </pre>
            ) : (
              <p className={styles.empty}>
                {emptyText}
                {isStreaming ? <span className={styles.caret} aria-hidden='true' /> : null}
              </p>
            )}
            <div className={styles.anchor} aria-hidden='true' />
          </ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation='vertical'>
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </section>
  );
}
