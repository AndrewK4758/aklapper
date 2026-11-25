import {
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  UNSAFE_DataRouterDataContext,
  UNSAFE_DataRouterStateContext,
} from 'react-router';

import { cx } from '../elements/_internal/elementFactory';
import { normalizeWorkspaceRouteKey } from './routeWorkspaceSnapshot';

import styles from './RouteWorkspaceHost.module.css';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface ScrollCoords {
  readonly top: number;
  readonly left: number;
}

interface CachedRouteEntry {
  readonly routeKey: string;
  readonly outlet: ReactNode;
}

export interface RouteWorkspaceEntry {
  readonly routeKey: string;
  readonly outlet: ReactNode;
  readonly isActive: boolean;
}

export interface RouteWorkspaceHostProps {
  readonly activeRouteKey: string;
  readonly outlet: ReactNode;
  readonly renderWorkspace: (entry: RouteWorkspaceEntry) => ReactNode;
  readonly className?: string;
}

interface RouteWorkspaceLayerProps {
  readonly routeKey: string;
  readonly isActive: boolean;
  readonly children: ReactNode;
}

function RouteWorkspaceLayer({ routeKey, isActive, children }: RouteWorkspaceLayerProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const scrollCoordsRef = useRef<WeakMap<Element, ScrollCoords>>(new WeakMap());
  const scrolledElementsRef = useRef<Set<Element>>(new Set());
  const wasActiveRef = useRef<boolean>(isActive);

  const liveRouterState = useContext(UNSAFE_DataRouterStateContext);
  const liveRouterData = useContext(UNSAFE_DataRouterDataContext);
  const frozenRouterStateRef = useRef(liveRouterState);
  const frozenRouterDataRef = useRef(liveRouterData);

  if (isActive) {
    frozenRouterStateRef.current = liveRouterState;
    frozenRouterDataRef.current = liveRouterData;
  }

  const effectiveRouterState = isActive ? liveRouterState : frozenRouterStateRef.current;
  const effectiveRouterData = isActive ? liveRouterData : frozenRouterDataRef.current;

  useEffect(() => {
    const layerEl = layerRef.current;
    if (!layerEl || !isActive) {
      return;
    }

    const handleScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      scrollCoordsRef.current.set(target, {
        top: target.scrollTop,
        left: target.scrollLeft,
      });
      scrolledElementsRef.current.add(target);
    };

    layerEl.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => {
      layerEl.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [isActive]);

  useIsomorphicLayoutEffect(() => {
    const wasActive = wasActiveRef.current;
    wasActiveRef.current = isActive;

    if (wasActive && !isActive) {
      const layerEl = layerRef.current;
      const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
      if (layerEl && activeEl instanceof HTMLElement && layerEl.contains(activeEl)) {
        activeEl.blur();
      }
      return;
    }

    if (!wasActive && isActive) {
      for (const el of Array.from(scrolledElementsRef.current)) {
        if (!el.isConnected) {
          scrolledElementsRef.current.delete(el);
          continue;
        }
        const coords = scrollCoordsRef.current.get(el);
        if (coords) {
          el.scrollTop = coords.top;
          el.scrollLeft = coords.left;
        }
      }
    }
  }, [isActive]);

  let content: ReactNode = children;
  if (effectiveRouterData !== null) {
    content = (
      <UNSAFE_DataRouterDataContext.Provider value={effectiveRouterData}>
        {content}
      </UNSAFE_DataRouterDataContext.Provider>
    );
  }
  if (effectiveRouterState !== null) {
    content = (
      <UNSAFE_DataRouterStateContext.Provider value={effectiveRouterState}>
        {content}
      </UNSAFE_DataRouterStateContext.Provider>
    );
  }

  return (
    <div
      ref={layerRef}
      className={styles.layer}
      data-route-workspace={routeKey}
      data-route-active={isActive ? 'true' : 'false'}
      hidden={!isActive}
      inert={!isActive}
      aria-hidden={!isActive ? 'true' : undefined}
    >
      {content}
    </div>
  );
}

export function RouteWorkspaceHost({
  activeRouteKey,
  outlet,
  renderWorkspace,
  className,
}: RouteWorkspaceHostProps) {
  const normalizedActiveKey = normalizeWorkspaceRouteKey(activeRouteKey);
  const [cachedEntries, setCachedEntries] = useState<readonly CachedRouteEntry[]>(() => [
    { routeKey: normalizedActiveKey, outlet },
  ]);
  const lastActiveRef = useRef<CachedRouteEntry>({
    routeKey: normalizedActiveKey,
    outlet,
  });

  const activeChanged = lastActiveRef.current.routeKey !== normalizedActiveKey;
  const hasActiveInCache = cachedEntries.some(entry => entry.routeKey === normalizedActiveKey);

  if (activeChanged || !hasActiveInCache) {
    const previousActive = lastActiveRef.current;
    const nextEntries = cachedEntries.map(entry =>
      entry.routeKey === previousActive.routeKey
        ? { routeKey: entry.routeKey, outlet: previousActive.outlet }
        : entry.routeKey === normalizedActiveKey
          ? { routeKey: entry.routeKey, outlet }
          : entry,
    );
    if (!hasActiveInCache) {
      nextEntries.push({ routeKey: normalizedActiveKey, outlet });
    }
    lastActiveRef.current = { routeKey: normalizedActiveKey, outlet };
    setCachedEntries(nextEntries);
  } else {
    lastActiveRef.current = { routeKey: normalizedActiveKey, outlet };
  }

  const effectiveEntries = hasActiveInCache
    ? cachedEntries
    : [...cachedEntries, { routeKey: normalizedActiveKey, outlet }];

  return (
    <div className={cx(styles.host, className)} data-route-workspace-host='true'>
      {effectiveEntries.map(entry => {
        const isActive = entry.routeKey === normalizedActiveKey;
        const layerOutlet = isActive ? outlet : entry.outlet;
        return (
          <RouteWorkspaceLayer key={entry.routeKey} routeKey={entry.routeKey} isActive={isActive}>
            {renderWorkspace({
              routeKey: entry.routeKey,
              outlet: layerOutlet,
              isActive,
            })}
          </RouteWorkspaceLayer>
        );
      })}
    </div>
  );
}
