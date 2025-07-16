import type {
  Chain,
  GameNameString,
  IAllGamesMap,
  IBuiltGame,
  IInstanceOfGame,
  IInstanceTimeMap,
  PlayerID,
} from '@aklapper/types';

import 'express';

export declare global {
  namespace Express {
    interface Request {
      allGamesMap: IAllGamesMap;
      instanceMap: IInstanceTimeMap;
      gameSpecificChain: Chain | null;
      selectedGameName: GameNameString;
      selectedGame: IBuiltGame | undefined;
      activeGameInstance: IInstanceOfGame | null;
      playerID: PlayerID;
    }
  }
}

export {};
