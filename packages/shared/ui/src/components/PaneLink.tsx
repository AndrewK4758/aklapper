import { useRender } from '@base-ui/react/use-render';
import { type MouseEvent } from 'react';

import { usePaneNavigation } from './paneNavigationContext';
import { useWorkspaceLauncher } from './workspaceLauncherContext';

export interface PaneLinkProps extends Omit<useRender.ComponentProps<'a'>, 'href'> {
  readonly to: string;
}

export function PaneLink({ to, render, onClick, onAuxClick, ...rest }: PaneLinkProps) {
  const paneNav = usePaneNavigation();
  const launcher = useWorkspaceLauncher();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || (!paneNav && !launcher)) {
      return;
    }
    if (event.button === 1 || event.ctrlKey || event.metaKey) {
      event.preventDefault();
      if (paneNav) {
        paneNav.openInTab(to);
      } else {
        launcher?.openPane(to, 'tab');
      }
      return;
    }
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    if (event.shiftKey) {
      if (paneNav) {
        paneNav.openInSplit(to);
      } else {
        launcher?.openPane(to, 'split');
      }
    } else if (paneNav) {
      paneNav.push(to);
    } else {
      launcher?.openPane(to, 'in-pane');
    }
  };

  const handleAuxClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onAuxClick?.(event);
    if (event.defaultPrevented || (!paneNav && !launcher)) {
      return;
    }
    if (event.button === 1) {
      event.preventDefault();
      if (paneNav) {
        paneNav.openInTab(to);
      } else {
        launcher?.openPane(to, 'tab');
      }
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
