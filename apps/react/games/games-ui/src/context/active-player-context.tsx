import { IPlayer } from '@aklapper/types';
import { createContext, type Dispatch, type SetStateAction } from 'react';

export interface ActivePlayerContextProps {
  activePlayer: Partial<IPlayer>;
  setActivePlayer: Dispatch<SetStateAction<Partial<IPlayer>>>;
}

const ActivePlayerContext = createContext<ActivePlayerContextProps>({
  activePlayer: { Name: '', Id: '', InLobby: false, ActiveGameID: null },
  setActivePlayer: () => ({})
});

export default ActivePlayerContext;
