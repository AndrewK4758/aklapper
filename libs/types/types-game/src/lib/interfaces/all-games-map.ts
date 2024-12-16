import { IInstanceOfGame } from './game-instance';
import { GameInstanceID } from '../types/game';

export interface IAllGamesMap {
  AllGames: Map<GameInstanceID, IInstanceOfGame>;
  addGame(gameInstanceID: GameInstanceID, game: IInstanceOfGame): void;
}
