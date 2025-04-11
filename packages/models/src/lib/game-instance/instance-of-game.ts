import { Game } from '@aklapper/game';
import type { GameInstanceID, IInstanceOfGame, Minute } from '@aklapper/types';

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
