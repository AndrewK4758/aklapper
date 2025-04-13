import type { IPlayer } from '@aklapper/types';
import { useState, type ReactNode } from 'react';
import ActivePlayerContext from './active-player-context';

const savedPlayer = localStorage.getItem('activePlayer');

const activePlayerInit: Partial<IPlayer> = savedPlayer
  ? (JSON.parse(savedPlayer) as Partial<IPlayer>)
  : { Name: '', Id: '', InLobby: false, ActiveGameID: null };

interface ActivePlayerContextProviderProps {
  children?: ReactNode;
}

export default function ActivePlayerContextProvider({ children }: ActivePlayerContextProviderProps) {
  const [activePlayer, setActivePlayer] = useState<Partial<IPlayer>>(activePlayerInit);

  const deleteActivePlayer = () => {
    localStorage.removeItem('activePlayer');
    setActivePlayer(activePlayerInit);
  };

  const removeFromLobby = () => {
    const p = JSON.parse(localStorage.getItem('activePlayer') as string) as Partial<IPlayer>;
    p.InLobby = false;
    localStorage.setItem('activePlayer', JSON.stringify(p));
  };

  return (
    <ActivePlayerContext.Provider value={{ activePlayer, setActivePlayer, deleteActivePlayer, removeFromLobby }}>
      {children}
    </ActivePlayerContext.Provider>
  );
}
