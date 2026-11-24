import {
  type AnchorHTMLAttributes,
  cloneElement,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';

import { usePaneNavigation } from './paneNavigationContext';

type RenderElementProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  readonly ref?: Ref<HTMLAnchorElement>;
  readonly children?: ReactNode;
};

export interface PaneLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  readonly to: string;
  readonly render?: ReactElement<RenderElementProps>;
  readonly ref?: Ref<HTMLAnchorElement>;
}

function mergeEventHandlers<E>(
  first?: (event: E) => void,
  second?: (event: E) => void,
): ((event: E) => void) | undefined {
  if (!first) return second;
  if (!second) return first;
  return (event: E) => {
    first(event);
    second(event);
  };
}

export function PaneLink({
  to,
  render,
  onClick,
  onAuxClick,
  className,
  children,
  ref,
  ...rest
}: PaneLinkProps) {
  const paneNav = usePaneNavigation();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !paneNav) {
      return;
    }
    if (event.button === 1 || event.ctrlKey || event.metaKey) {
      event.preventDefault();
      paneNav.openInTab(to);
      return;
    }
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    if (event.shiftKey) {
      paneNav.openInSplit(to);
    } else {
      paneNav.push(to);
    }
  };

  const handleAuxClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onAuxClick?.(event);
    if (event.defaultPrevented || !paneNav) {
      return;
    }
    if (event.button === 1) {
      event.preventDefault();
      paneNav.openInTab(to);
    }
  };

  if (render) {
    const mergedClassName = [render.props.className, className].filter(Boolean).join(' ') || undefined;
    return cloneElement(render, {
      ...rest,
      ...render.props,
      ...(ref ? { ref } : {}),
      ...(mergedClassName ? { className: mergedClassName } : {}),
      onClick: mergeEventHandlers(render.props.onClick, handleClick),
      onAuxClick: mergeEventHandlers(render.props.onAuxClick, handleAuxClick),
      children: children ?? render.props.children,
    });
  }

  return (
    <a
      ref={ref}
      href={to}
      className={className}
      onClick={handleClick}
      onAuxClick={handleAuxClick}
      {...rest}
    >
      {children}
    </a>
  );
}
