import { trackPaneOpen } from '@aklapper/core/analytics';
import {
  type TerminalNavTarget,
  WorkspaceLauncherContext,
  type WorkspaceLauncherContextValue,
} from '@aklapper/ui';
import { normalizeWorkspaceRouteKey } from '@aklapper/ui/workspace-storage';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import { portalPaneStreamStore } from './portalPaneStreamStore';
import { markGuestSessionPrimed } from './portalPaneTransport';
import { isPortalPaneRoute } from './portalWorkspaceSnapshot';
import { type PortalWorkspaceStore, portalWorkspaceStore } from './portalWorkspaceStore';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface PortalWorkspaceContextValue extends WorkspaceLauncherContextValue {
  readonly store: PortalWorkspaceStore;
  readonly pathname: string;
}

const PortalWorkspaceContext = createContext<PortalWorkspaceContextValue | null>(null);

export interface PortalWorkspaceProviderProps {
  readonly pathname: string;
  readonly locationKey: string;
  readonly children: ReactNode;
}

export function PortalWorkspaceProvider({
  pathname,
  locationKey,
  children,
}: PortalWorkspaceProviderProps) {
  const normalizedPathname = normalizeWorkspaceRouteKey(pathname);
  const lastLocationRef = useRef<{ readonly pathname: string; readonly locationKey: string }>({
    pathname: normalizedPathname,
    locationKey,
  });

  useIsomorphicLayoutEffect(() => {
    const unsubAdd = portalWorkspaceStore.onPaneViewsAdded(views => {
      for (const { paneId, routePath } of views) {
        portalPaneStreamStore.prewarm(paneId, routePath);
        trackPaneOpen(routePath, 'desktop');
      }
    });
    const unsubRemove = portalWorkspaceStore.onPaneViewsRemoved(views => {
      portalPaneStreamStore.evictPaneViews(views);
    });
    return () => {
      unsubAdd();
      unsubRemove();
    };
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (normalizedPathname === '/chat' || normalizedPathname === '/cadence') {
      markGuestSessionPrimed();
    }
    const prev = lastLocationRef.current;
    if (prev.pathname === normalizedPathname && prev.locationKey === locationKey) {
      return;
    }
    lastLocationRef.current = { pathname: normalizedPathname, locationKey };
    portalWorkspaceStore.syncRoute(normalizedPathname);
  }, [normalizedPathname, locationKey]);

  const launcherValue = useMemo<WorkspaceLauncherContextValue>(
    () => ({
      openPane: (viewId: string, target: TerminalNavTarget) => {
        const paneId = portalWorkspaceStore.openPane(viewId, target);
        if (isPortalPaneRoute(viewId)) {
          portalPaneStreamStore.prewarm(paneId, viewId);
        }
      },
      openTerminal: (target: 'split' | 'tab') => {
        portalWorkspaceStore.openTerminal(target);
      },
      focusPrimaryHostTab: () => {
        portalWorkspaceStore.focusPrimaryHostTab();
      },
    }),
    [],
  );

  const contextValue = useMemo<PortalWorkspaceContextValue>(
    () => ({
      store: portalWorkspaceStore,
      pathname: normalizedPathname,
      ...launcherValue,
    }),
    [launcherValue, normalizedPathname],
  );

  return (
    <PortalWorkspaceContext.Provider value={contextValue}>
      <WorkspaceLauncherContext.Provider value={launcherValue}>
        {children}
      </WorkspaceLauncherContext.Provider>
    </PortalWorkspaceContext.Provider>
  );
}

export function usePortalWorkspace(): PortalWorkspaceContextValue | null {
  return useContext(PortalWorkspaceContext);
}
