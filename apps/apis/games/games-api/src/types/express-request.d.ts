import type {
  IAllGamesMap,
  IInstanceTimeMap,
  Chain,
  GameNameString,
  IBuiltGame,
  PlayerID,
  IInstanceOfGame
} from '@aklapper/types';

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
