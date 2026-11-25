import {
  type ComponentPropsWithoutRef,
  createContext,
  type JSX,
  type ReactNode,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';

import {
  resolveViewportLayoutMode,
  subscribeViewportLayoutMode,
  type ViewportLayoutMode,
} from './terminalViewportSplit';

export interface ViewportContextValue {
  readonly layoutMode: ViewportLayoutMode;
  readonly isMobile: boolean;
  readonly isScopedOverride: boolean;
  readonly portalContainer: HTMLElement | null;
}

const DEFAULT_VIEWPORT_CONTEXT: ViewportContextValue = {
  layoutMode: 'desktop',
  isMobile: false,
  isScopedOverride: false,
  portalContainer: null,
};

export const ViewportContext = createContext<ViewportContextValue | null>(null);

export interface ViewportProviderProps {
  readonly initialMode?: ViewportLayoutMode;
  readonly mode?: ViewportLayoutMode;
  readonly portalContainer?: HTMLElement | null;
  readonly children: ReactNode;
}

function LiveViewportProvider({
  initialMode = 'desktop',
  portalContainer = null,
  children,
}: {
  readonly initialMode?: ViewportLayoutMode;
  readonly portalContainer?: HTMLElement | null;
  readonly children: ReactNode;
}): JSX.Element {
  const layoutMode = useSyncExternalStore(
    subscribeViewportLayoutMode,
    resolveViewportLayoutMode,
    () => initialMode,
  );

  const value = useMemo<ViewportContextValue>(
    () => ({
      layoutMode,
      isMobile: layoutMode !== 'desktop',
      isScopedOverride: false,
      portalContainer,
    }),
    [layoutMode, portalContainer],
  );

  return <ViewportContext.Provider value={value}>{children}</ViewportContext.Provider>;
}

export function ViewportProvider({
  initialMode = 'desktop',
  mode,
  portalContainer = null,
  children,
}: ViewportProviderProps): JSX.Element {
  const parent = useContext(ViewportContext);

  const scopedValue = useMemo<ViewportContextValue | null>(() => {
    if (!mode) {
      return null;
    }
    return {
      layoutMode: mode,
      isMobile: mode !== 'desktop',
      isScopedOverride: true,
      portalContainer: portalContainer ?? parent?.portalContainer ?? null,
    };
  }, [mode, parent?.portalContainer, portalContainer]);

  if (scopedValue) {
    return <ViewportContext.Provider value={scopedValue}>{children}</ViewportContext.Provider>;
  }

  return (
    <LiveViewportProvider
      initialMode={initialMode}
      portalContainer={portalContainer ?? parent?.portalContainer ?? null}
    >
      {children}
    </LiveViewportProvider>
  );
}

export function useViewportContext(): ViewportContextValue {
  const ctx = useContext(ViewportContext);
  return ctx ?? DEFAULT_VIEWPORT_CONTEXT;
}

export function useViewportLayoutMode(): ViewportLayoutMode {
  const ctx = useContext(ViewportContext);
  const liveMode = useSyncExternalStore(
    subscribeViewportLayoutMode,
    resolveViewportLayoutMode,
    () => DEFAULT_VIEWPORT_CONTEXT.layoutMode,
  );
  return ctx ? ctx.layoutMode : liveMode;
}

export function ViewportHtml({
  lang = 'en',
  children,
  ...htmlProps
}: ComponentPropsWithoutRef<'html'>): JSX.Element {
  const { layoutMode } = useViewportContext();
  return (
    <html lang={lang} {...htmlProps} data-viewport={layoutMode}>
      {children}
    </html>
  );
}
