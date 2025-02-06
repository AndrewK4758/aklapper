import type { IInstanceOfGame } from './instance-of-game.ts';
import type { GameInstanceID } from '../types/game.ts';

export interface IAllGamesMap {
  AllGames: Map<GameInstanceID, IInstanceOfGame>;
  addGame(gameInstanceID: GameInstanceID, game: IInstanceOfGame): void;
}
