import type { IPlayerClientData } from '@aklapper/types';
import { useState, type ReactNode } from 'react';
import ActivePlayerContext from './active-player-context';

const activePlayerDefault: IPlayerClientData = {
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
  const [activePlayer, setActivePlayer] = useState<IPlayerClientData>(() => {
    const savedPlayer = localStorage.getItem('activePlayer');

    const activePlayerInit: IPlayerClientData = savedPlayer
      ? (JSON.parse(savedPlayer) as IPlayerClientData)
      : activePlayerDefault;

    return activePlayerInit;
  });

  const deleteActivePlayer = () => {
    localStorage.removeItem('activePlayer');
    setActivePlayer(activePlayerDefault);
  };

  const removeFromLobby = () => {
    const storedPlayer = localStorage.getItem('activePlayer');
    if (storedPlayer) {
      const activePlayer = JSON.parse(storedPlayer);
      activePlayer.inLobby = false;
      localStorage.setItem('activePlayer', JSON.stringify(activePlayer));
    } else return;
  };

  return (
    <ActivePlayerContext.Provider value={{ activePlayer, setActivePlayer, deleteActivePlayer, removeFromLobby }}>
      {children}
    </ActivePlayerContext.Provider>
  );
}
