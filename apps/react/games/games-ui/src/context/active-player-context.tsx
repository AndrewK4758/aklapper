import { IPlayer } from '@aklapper/types';
import { createContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';

export interface ActivePlayerContextProps {
  activePlayer: Partial<IPlayer>;
  setActivePlayer: Dispatch<SetStateAction<Partial<IPlayer>>>;
}

const storedPlayerData = sessionStorage.getItem('activePlayer');

const activePlayerInit: Partial<IPlayer> = storedPlayerData
  ? JSON.parse(storedPlayerData)
  : {
      Id: '',
      Name: '',
      InLobby: false,
      ActiveGameID: null
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
