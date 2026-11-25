import { type CSSProperties, type JSX, type MouseEvent, useSyncExternalStore } from 'react';

import { cx } from '../elements/_internal/elementFactory';
import { Button } from '../elements/base/Button';

import styles from './TerminalAccessoryBar.module.css';

export type TerminalAccessoryAction =
  | 'tab'
  | 'escape'
  | 'ctrl-c'
  | 'history-prev'
  | 'history-next'
  | { readonly type: 'command'; readonly command: string };

export interface TerminalAccessoryBarProps {
  readonly visible: boolean;
  readonly onAction: (action: TerminalAccessoryAction) => void;
  readonly quickCommands?: readonly string[];
  readonly className?: string;
}

function getVisualViewportKeyboardOffset(): number {
  if (typeof window === 'undefined' || !window.visualViewport) {
    return 0;
  }
  const delta = window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop;
  return delta > 80 ? Math.round(delta) : 0;
}

function subscribeVisualViewport(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.visualViewport) {
    return () => {};
  }
  const vv = window.visualViewport;
  vv.addEventListener('resize', onStoreChange);
  vv.addEventListener('scroll', onStoreChange);
  return () => {
    vv.removeEventListener('resize', onStoreChange);
    vv.removeEventListener('scroll', onStoreChange);
  };
}

function getServerKeyboardOffset(): number {
  return 0;
}

export function useVisualViewportKeyboardOffset(): number {
  return useSyncExternalStore(
    subscribeVisualViewport,
    getVisualViewportKeyboardOffset,
    getServerKeyboardOffset,
  );
}

export function dispatchTerminalAccessoryAction(
  action: TerminalAccessoryAction,
  target: HTMLInputElement | HTMLTextAreaElement | null,
  runCommand: (command: string) => void,
): void {
  if (typeof action === 'object' && action.type === 'command') {
    runCommand(action.command);
    return;
  }
  if (!target) {
    return;
  }
  const keyMap: Record<Exclude<TerminalAccessoryAction, { readonly type: 'command' }>, KeyboardEventInit> = {
    tab: { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true },
    escape: { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true },
    'ctrl-c': { key: 'c', code: 'KeyC', ctrlKey: true, bubbles: true, cancelable: true },
    'history-prev': { key: 'ArrowUp', code: 'ArrowUp', bubbles: true, cancelable: true },
    'history-next': { key: 'ArrowDown', code: 'ArrowDown', bubbles: true, cancelable: true },
  };
  target.focus();
  target.dispatchEvent(new KeyboardEvent('keydown', keyMap[action]));
}

function preventFocusLoss(event: MouseEvent<HTMLButtonElement>): void {
  event.preventDefault();
}

export function TerminalAccessoryBar({
  visible,
  onAction,
  quickCommands = [],
  className,
}: TerminalAccessoryBarProps): JSX.Element | null {
  const keyboardOffset = useVisualViewportKeyboardOffset();

  if (!visible) {
    return null;
  }

  const inlineStyle: CSSProperties | undefined =
    keyboardOffset > 0
      ? ({ '--sf-keyboard-offset': `${keyboardOffset}px` } as CSSProperties)
      : undefined;

  return (
    <div
      role='toolbar'
      aria-label='Terminal touch accessory keys'
      data-terminal-accessory-bar='true'
      className={cx(styles.bar, className)}
      style={inlineStyle}
    >
      <div className={styles.keyGroup}>
        <Button.Root
          type='button'
          variant='secondary'
          size='sm'
          className={styles.keyButton}
          onMouseDown={preventFocusLoss}
          onClick={() => onAction('tab')}
        >
          Tab
        </Button.Root>
        <Button.Root
          type='button'
          variant='secondary'
          size='sm'
          className={styles.keyButton}
          onMouseDown={preventFocusLoss}
          onClick={() => onAction('escape')}
        >
          Esc
        </Button.Root>
        <Button.Root
          type='button'
          variant='secondary'
          size='sm'
          className={styles.keyButton}
          onMouseDown={preventFocusLoss}
          onClick={() => onAction('ctrl-c')}
        >
          Ctrl+C
        </Button.Root>
        <Button.Root
          type='button'
          variant='secondary'
          size='sm'
          aria-label='Previous command'
          className={styles.keyButton}
          onMouseDown={preventFocusLoss}
          onClick={() => onAction('history-prev')}
        >
          ↑
        </Button.Root>
        <Button.Root
          type='button'
          variant='secondary'
          size='sm'
          aria-label='Next command'
          className={styles.keyButton}
          onMouseDown={preventFocusLoss}
          onClick={() => onAction('history-next')}
        >
          ↓
        </Button.Root>
      </div>

      {quickCommands.length > 0 ? (
        <>
          <span className={styles.divider} aria-hidden='true' />
          <div className={styles.quickGroup}>
            {quickCommands.map(cmd => (
              <Button.Root
                key={cmd}
                type='button'
                variant='ghost'
                size='sm'
                className={styles.quickButton}
                onMouseDown={preventFocusLoss}
                onClick={() => onAction({ type: 'command', command: cmd })}
              >
                {cmd}
              </Button.Root>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
