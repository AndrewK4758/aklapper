import { createContext, useContext } from 'react';

export interface PaneNavigationContextValue {
  readonly paneId: string;
  readonly ttyNumber: number;
  readonly isActive: boolean;
  readonly isSinglePane: boolean;
  readonly docked: boolean;
  readonly stack: readonly string[];
  readonly canGoBack: boolean;
  readonly push: (viewId: string) => void;
  readonly pop: () => void;
  readonly exitTui: () => void;
  readonly openInSplit: (viewId: string) => void;
  readonly openInTab: (viewId: string) => void;
}

export const PaneNavigationContext = createContext<PaneNavigationContextValue | null>(null);

export function usePaneNavigation(): PaneNavigationContextValue | null {
  return useContext(PaneNavigationContext);
}
