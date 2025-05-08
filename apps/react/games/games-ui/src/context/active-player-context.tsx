import type { IPlayerClientData } from '@aklapper/types';
import { createContext } from 'react';

export interface ActivePlayerContextProps {
  activePlayer: IPlayerClientData;
  addActivePlayer: (activePlayer: IPlayerClientData) => void;
  deleteActivePlayer: () => void;
  removeFromLobby: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const ActivePlayerContext = createContext<ActivePlayerContextProps>(null!);

export default ActivePlayerContext;
