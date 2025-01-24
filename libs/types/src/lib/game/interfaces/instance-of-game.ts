import type { GameInstanceID, Minute } from '../types/game.ts';
import type { IGame } from './game.ts';

export interface IInstanceOfGame {
  gameInstanceID: GameInstanceID;
  instanceTime: Minute;
  lastActive: Minute;
  instance: IGame;
  updateLastActive(minute: Minute): void;
}
