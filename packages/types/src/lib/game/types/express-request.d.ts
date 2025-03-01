import { IAllGamesMap } from '../interfaces/all-games-map.ts';
import { IInstanceTimeMap } from '../interfaces/instance-time-map.js';
import { Chain } from '../interfaces/chain.ts';
import { GameNameString, PlayerID } from './game.js';
import { IBuiltGame } from '../interfaces/built-game.ts';
import { IInstanceOfGame } from '../interfaces/interfaces.ts';
import { LoginData } from '../types/login-data.ts';

export declare global {
  namespace Express {
    interface Request {
      allGamesMap: IAllGamesMap;
      instanceMap: IInstanceTimeMap;
      gameSpecificChain: Chain | null;
      selectedGameName: GameNameString;
      selectedGame: IBuiltGame | undefined;
      loginData: LoginData;
      activeGameInstance: IInstanceOfGame | null;
      playerID: PlayerID;
    }
  }
}

export {};
