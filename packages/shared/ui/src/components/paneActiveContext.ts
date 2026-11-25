import { createContext, useContext } from 'react';

export const PaneActiveContext = createContext<boolean>(true);

export function useIsPaneActive(): boolean {
  return useContext(PaneActiveContext);
}
