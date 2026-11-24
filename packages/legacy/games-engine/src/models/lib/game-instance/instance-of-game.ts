import { Game } from '../../../game/index.ts';
import type { GameInstanceID, IInstanceOfGame, Minute } from '../../../types/index.ts';

export class InstanceOfGame implements IInstanceOfGame {
  gameInstanceID: GameInstanceID;
  instanceTime: Minute;
  lastActive: Minute;
  instance: Game;
  inLobby: boolean;
  constructor(minute: Minute, gameInstanceID: GameInstanceID, instance: Game) {
    this.instanceTime = minute;
    this.lastActive = minute;
    this.gameInstanceID = gameInstanceID;
    this.instance = instance;
    this.inLobby = true;
  }

  updateLastActive(minute: Minute): void {
    // GET THE CURRENT MINUTE OF THE DAY
    this.lastActive = minute;
  }
}
