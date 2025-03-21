import { createContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { IActivePlayerContext } from '../types/types';

export interface ActivePlayerContextProps {
  activePlayer: IActivePlayerContext;
  setActivePlayer: Dispatch<SetStateAction<IActivePlayerContext>>;
}

const activePlayerInit: IActivePlayerContext = {
  id: '',
  name: '',
  inLobby: false,
  activeGameID: null
};

export const ActivePlayerContext = createContext<ActivePlayerContextProps>({
  activePlayer: activePlayerInit,
  setActivePlayer: () => ({})
});

interface ActivePlayerContextProviderProps {
  children?: ReactNode;
}

export default function ActivePlayerContextProvider({ children }: ActivePlayerContextProviderProps) {
  const [activePlayer, setActivePlayer] = useState<IActivePlayerContext>(activePlayerInit);

  return (
    <ActivePlayerContext.Provider value={{ activePlayer, setActivePlayer }}>{children}</ActivePlayerContext.Provider>
  );
}
