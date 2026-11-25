import { createContext, useContext } from 'react';

import type { TerminalNavTarget } from './terminalPaneNav';

export interface WorkspaceLauncherContextValue {
  readonly openPane: (viewId: string, target: TerminalNavTarget) => void;
  readonly openTerminal: (target: 'split' | 'tab') => void;
  readonly focusPrimaryHostTab: () => void;
}

export const WorkspaceLauncherContext = createContext<WorkspaceLauncherContextValue | null>(null);

export function useWorkspaceLauncher(): WorkspaceLauncherContextValue | null {
  return useContext(WorkspaceLauncherContext);
}
