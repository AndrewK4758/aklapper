import { GameInstanceID, GamesInMinute, IInstanceTimeMap, Minute } from '@aklapper/types-game';
export declare class InstanceTimeMap implements IInstanceTimeMap {
    Map: Map<Minute, GamesInMinute>;
    constructor();
    addGameInstance(minute: Minute, gameInstanceID: GameInstanceID): void;
}
export declare const reaper: (instanceTimeMap: IInstanceTimeMap) => void;
//# sourceMappingURL=instance-time-map.d.ts.map