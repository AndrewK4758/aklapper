import type { Minute, GamesInMinute, GameInstanceID } from '../types/game.js';

export interface IInstanceTimeMap {
  Map: Map<Minute, GamesInMinute>;
  addGameInstance(minute: Minute, gameInstanceID: GameInstanceID): void;
}
