import type { IPlayerClientData } from '@aklapper/types';
import { createContext, type Dispatch, type SetStateAction } from 'react';

export interface ActivePlayerContextProps {
  activePlayer: IPlayerClientData;
  setActivePlayer: Dispatch<SetStateAction<IPlayerClientData>>;
  deleteActivePlayer: () => void;
  removeFromLobby: () => void;
}

const ActivePlayerContext = createContext<ActivePlayerContextProps>({
  activePlayer: {
    name: '',
    id: '',
    inLobby: false,
    activeGameID: null,
    email: '',
    socketIoId: undefined,
    currentTimeEntered: '',
  },
  setActivePlayer: (
    activePlayer: SetStateAction<IPlayerClientData> | ((prev: IPlayerClientData[]) => IPlayerClientData),
  ) => {
    return activePlayer;
  },
  /**
   * Deletes the activePlayer from session storage and resets the context object to initial state
   * @returns void
   */
  deleteActivePlayer: () => {
    localStorage.removeItem('activePlayer');
  },
  removeFromLobby: () => {
    const activePlayer = JSON.parse(localStorage.getItem('activePlayer') as string) as IPlayerClientData;

    activePlayer.inLobby = false;

    localStorage.setItem('activePlayer', JSON.stringify(activePlayer));
  },
});

export default ActivePlayerContext;
