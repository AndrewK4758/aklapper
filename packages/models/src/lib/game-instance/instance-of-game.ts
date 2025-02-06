import { GameInstanceID, Minute, IInstanceOfGame } from '@aklapper/types';
import { Game } from '@aklapper/game';

export class InstanceOfGame implements IInstanceOfGame {
  gameInstanceID: GameInstanceID;
  instanceTime: Minute;
  lastActive: Minute;
  instance: Game;
  constructor(minute: Minute, gameInstanceID: GameInstanceID, instance: Game) {
    this.instanceTime = minute;
    this.lastActive = minute;
    this.gameInstanceID = gameInstanceID;
    this.instance = instance;
  }

  updateLastActive(minute: Minute): void {
    // GET THE CURRENT MINUTE OF THE DAY
    this.lastActive = minute;
  }
}
