import { GameInstanceID, Minute, IInstanceOfGame, IGame } from '@aklapper/types-game';
export declare class InstanceOfGame implements IInstanceOfGame {
    gameInstanceID: GameInstanceID;
    instanceTime: Minute;
    lastActive: Minute;
    instance: IGame;
    constructor(minute: Minute, gameInstanceID: GameInstanceID, instance: IGame);
    updateLastActive(minute: Minute): void;
}
//# sourceMappingURL=instance-of-game.d.ts.map