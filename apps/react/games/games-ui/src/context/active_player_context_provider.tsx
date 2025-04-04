import type { IPlayer } from '@aklapper/types';
import { useState, type ReactNode } from 'react';
import ActivePlayerContext from './active-player-context';

const storedPlayerData = sessionStorage.getItem('activePlayer');

const activePlayerInit: Partial<IPlayer> = storedPlayerData
  ? JSON.parse(storedPlayerData)
  : {
      Id: '',
      Name: '',
      InLobby: false,
      ActiveGameID: null
    };

interface ActivePlayerContextProviderProps {
  children?: ReactNode;
}

export default function ActivePlayerContextProvider({ children }: ActivePlayerContextProviderProps) {
  const [activePlayer, setActivePlayer] = useState<Partial<IPlayer>>(activePlayerInit);

  return (
    <ActivePlayerContext.Provider value={{ activePlayer, setActivePlayer }}>{children}</ActivePlayerContext.Provider>
  );
}
