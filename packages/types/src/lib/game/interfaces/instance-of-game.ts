import type { GameInstanceID, Minute } from '../types/game.js';
import type { IGame } from './game.js';

export interface IInstanceOfGame {
  gameInstanceID: GameInstanceID;
  inLobby: boolean;
  instanceTime: Minute;
  lastActive: Minute;
  instance: IGame;
  updateLastActive(minute: Minute): void;
}
