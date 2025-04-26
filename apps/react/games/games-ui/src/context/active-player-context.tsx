import type { IPlayerClientData } from '@aklapper/types';
import { createContext, type Dispatch, type SetStateAction } from 'react';

export interface ActivePlayerContextProps {
  activePlayer: IPlayerClientData;
  setActivePlayer: Dispatch<SetStateAction<IPlayerClientData>>;
  deleteActivePlayer: () => void;
  removeFromLobby: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const ActivePlayerContext = createContext<ActivePlayerContextProps>(null!);

export default ActivePlayerContext;
