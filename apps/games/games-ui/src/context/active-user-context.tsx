import { createContext, Dispatch, SetStateAction } from 'react';

export interface ActiveUserData {
  id: string | undefined;
  playerName: string | undefined;
  friends: string[] | undefined;
  activeGames: string[] | undefined;
  thumbnail: string | undefined;
}

export interface IActiveUserContext {
  activeUser: ActiveUserData;
  setActiveUser: Dispatch<SetStateAction<ActiveUserData>>;
}

const activeUserInit: ActiveUserData = {
  id: '',
  playerName: '',
  activeGames: [],
  friends: [],
  thumbnail: ''
};

export const ActiveUserContext = createContext<IActiveUserContext>({
  activeUser: activeUserInit,
  setActiveUser: user => user
});
