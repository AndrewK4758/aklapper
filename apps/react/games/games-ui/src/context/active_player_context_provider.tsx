import type { IPlayerClientData } from '@aklapper/types';
import { useState, type ReactNode } from 'react';
import ActivePlayerContext from './active-player-context';

const savedPlayer = localStorage.getItem('activePlayer');

const activePlayerInit: IPlayerClientData = savedPlayer
  ? (JSON.parse(savedPlayer) as IPlayerClientData)
  : {
      name: '',
      id: '',
      inLobby: false,
      activeGameID: null,
      email: '',
      currentTimeEntered: '',
      socketIoId: undefined,
    };

interface ActivePlayerContextProviderProps {
  children?: ReactNode;
}

export default function ActivePlayerContextProvider({ children }: ActivePlayerContextProviderProps) {
  const [activePlayer, setActivePlayer] = useState<IPlayerClientData>(activePlayerInit);

  const deleteActivePlayer = () => {
    localStorage.removeItem('activePlayer');
    setActivePlayer({
      name: '',
      id: '',
      inLobby: false,
      activeGameID: null,
      email: '',
      currentTimeEntered: '',
      socketIoId: undefined,
    });
  };

  const removeFromLobby = () => {
    const activePlayer = JSON.parse(localStorage.getItem('activePlayer') as string) as IPlayerClientData;
    activePlayer.inLobby = false;
    localStorage.setItem('activePlayer', JSON.stringify(activePlayer));
  };

  return (
    <ActivePlayerContext.Provider value={{ activePlayer, setActivePlayer, deleteActivePlayer, removeFromLobby }}>
      {children}
    </ActivePlayerContext.Provider>
  );
}
