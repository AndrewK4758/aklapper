import type { Minute, GamesInMinute, GameInstanceID } from '../types/game.ts';

export interface IInstanceTimeMap {
  Map: Map<Minute, GamesInMinute>;
  addGameInstance(minute: Minute, gameInstanceID: GameInstanceID): void;
}
