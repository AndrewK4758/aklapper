import { useRender } from '@base-ui/react/use-render';
import { type MouseEvent } from 'react';

import { usePaneNavigation } from './paneNavigationContext';

export interface PaneLinkProps extends Omit<useRender.ComponentProps<'a'>, 'href'> {
  readonly to: string;
}

export function PaneLink({ to, render, onClick, onAuxClick, ...rest }: PaneLinkProps) {
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

  return useRender({
    defaultTagName: 'a',
    render,
    props: {
      ...rest,
      href: to,
      onClick: handleClick,
      onAuxClick: handleAuxClick,
    },
  });
}
