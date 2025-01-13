import { Player } from '@aklapper/games-components';
import { AllGameTypes, Color, SpaceType, IGame } from '@aklapper/types-game';
export declare class Game implements IGame {
    game: AllGameTypes;
    playersArray: Player[];
    playerInTurn: Player;
    readyToPlay: boolean;
    haveWinner: boolean;
    currentPlayer: number;
    constructor(instance: AllGameTypes);
    get instance(): AllGameTypes;
    register(playerName: string, id: string, avatarName: string, color: Color): void;
    generatePlayerOrder(player: Player): void;
    verifyReadyToPlay(min: number, max: number): boolean;
    rotatePlayers(): void;
    wonGame(locationType: SpaceType): locationType is SpaceType.FINISH;
}
//# sourceMappingURL=game.d.ts.map