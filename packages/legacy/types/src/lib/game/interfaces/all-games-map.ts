import type { GameInstanceID } from '../types/game.js';
import type { IInstanceOfGame } from './instance-of-game.js';

export interface IAllGamesMap {
  AllGames: Map<GameInstanceID, IInstanceOfGame>;
  addGame(gameInstanceID: GameInstanceID, game: IInstanceOfGame): void;
}
