import { IPlayer } from '@aklapper/types';
import { createContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';

export interface ActivePlayerContextProps {
  activePlayer: Partial<IPlayer>;
  setActivePlayer: Dispatch<SetStateAction<Partial<IPlayer>>>;
}

const activePlayerInit: Partial<IPlayer> = {
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
  const [activePlayer, setActivePlayer] = useState<Partial<IPlayer>>(activePlayerInit);

  return (
    <ActivePlayerContext.Provider value={{ activePlayer, setActivePlayer }}>{children}</ActivePlayerContext.Provider>
  );
}
