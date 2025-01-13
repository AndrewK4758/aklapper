import { GameInstanceID, IInstanceOfGame, IAllGamesMap } from '@aklapper/types-game';
export declare class AllGamesMap implements IAllGamesMap {
    AllGames: Map<GameInstanceID, IInstanceOfGame>;
    constructor();
    addGame(gameInstanceID: GameInstanceID, game: IInstanceOfGame): void;
}
//# sourceMappingURL=all-games-map.d.ts.map