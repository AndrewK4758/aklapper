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
  socketIoId: null,
};

function activePlayerInit() {
  const savedPlayer = localStorage.getItem('active-player');
  return savedPlayer ? (JSON.parse(savedPlayer) as IPlayerClientData) : activePlayerDefault;
}
interface ActivePlayerContextProviderProps {
  children?: ReactNode;
}

export default function ActivePlayerContextProvider({ children }: ActivePlayerContextProviderProps) {
  const [activePlayer, setActivePlayer] = useState<IPlayerClientData>(activePlayerInit());

  const addActivePlayer = (activePlayer: IPlayerClientData) => {
    setActivePlayer(prev => ({ ...prev, ...activePlayer }));
    localStorage.setItem('active-player', JSON.stringify(activePlayer));
  };

  const deleteActivePlayer = () => {
    localStorage.removeItem('active-player');
    setActivePlayer(activePlayerDefault);
  };

  const removeFromLobby = () => {
    const storedPlayer = localStorage.getItem('active-player');
    if (storedPlayer) {
      const activePlayer: IPlayerClientData = JSON.parse(storedPlayer);
      activePlayer.inLobby = false;
      localStorage.setItem('active-player', JSON.stringify(activePlayer));
    }
  };

  return (
    <ActivePlayerContext.Provider value={{ activePlayer, addActivePlayer, deleteActivePlayer, removeFromLobby }}>
      {children}
    </ActivePlayerContext.Provider>
  );
}
