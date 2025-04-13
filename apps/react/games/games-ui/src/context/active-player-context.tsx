import type { IPlayer } from '@aklapper/types';
import { createContext, type Dispatch, type SetStateAction } from 'react';

export interface ActivePlayerContextProps {
  activePlayer: Partial<IPlayer>;
  setActivePlayer: Dispatch<SetStateAction<Partial<IPlayer>>>;
  deleteActivePlayer: () => void;
  removeFromLobby: () => void;
}

const ActivePlayerContext = createContext<ActivePlayerContextProps>({
  activePlayer: { Name: '', Id: '', InLobby: false, ActiveGameID: null },
  setActivePlayer: () => ({}),
  /**
   * Deletes the activePlayer from session storage and resets the context object to initial state
   * @returns void
   */
  deleteActivePlayer: () => ({}),
  removeFromLobby: () => ({}),
});

export default ActivePlayerContext;
