import { Space } from '@aklapper/games-components';
import { Color, AvatarTotem, type ITicTacToe, type ILiteSpace } from '@aklapper/types-game';
export declare const WINNING_POSITIONS: string[][];
export declare const TOTAL_SPACES = 9;
export declare const ROWS: number;
export declare class TicTacToe implements ITicTacToe {
    MIN_PLAYERS: number;
    MAX_PLAYERS: number;
    startSpace: Space;
    avatarList: AvatarTotem[];
    colorList: typeof Color;
    constructor();
    makeGameBoard: () => void;
    spaceMaker: (indexOfSpace: number) => Space;
    addAvatarSvgToDisplay: (name: string) => string;
    displayGameBoard: () => ILiteSpace[];
}
export default TicTacToe;
//# sourceMappingURL=tic-tac-toe.d.ts.map