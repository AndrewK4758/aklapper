import { Die, Space } from '@aklapper/games-components';
import { AvatarTotem, Color, type IChutesAndLadders, type ILiteSpace } from '@aklapper/types-game';
export declare const TOTAL_SPACES = 100;
export declare const START = 1;
export declare const ROWS: number;
export declare const MAX_SPECIAL_DISTANCE = 40;
export declare const uniqueSpecialValues: Map<number, Space>;
export declare const specialsDumps: Map<number, Space>;
export declare class ChutesAndLadders implements IChutesAndLadders {
    MAX_PLAYERS: number;
    MIN_PLAYERS: number;
    CHUTES: number;
    LADDERS: number;
    DIE: Die;
    startSpace: Space;
    colorList: typeof Color;
    avatarList: AvatarTotem[];
    /**
     *
     * @param {Number} chutes number of chutes
     * @param {Number} ladders number of ladders
     * @returns Active instance of Chutes And Ladders Game
     */
    constructor(chutes: number, ladders: number);
    /**
     *
     * @param indexOfSpace index of space in the game board array
     * @returns the cooresponding space type according to the index number
     */
    spaceMaker: (indexOfSpace: number) => Space;
    makeGameBoard: () => void;
    /**
     *
     * @param name Avatar name
     * @returns the cooresponding svg image associated with the name of the selected Avatar
     */
    addAvatarSvgToDisplay: (name: string) => string;
    /**
     *
     * @returns a complete game board array of LiteSpace instances
     */
    displayGameBoard(): ILiteSpace[];
    /**
     *
     * @param min Minimum number in the range used to select special space indexes
     * @param max Maximum number in the range used to select special space indexes
     * @returns A map containing the index of each special Space with the Space instance that coorespondes
     */
    specialValuesMaker: (min?: number, max?: number) => Map<number, Space>;
}
export default ChutesAndLadders;
//# sourceMappingURL=chutes_and_ladders.d.ts.map