import { IBoard } from '@aklapper/types-game';
import { Space } from './space.ts';
export declare class Board implements IBoard {
    TotalSpaces: number;
    SpaceMaker: (indexOfSpace: number) => Space;
    constructor(totalSpaces: number, spaceMaker: (indexOfSpace: number) => Space);
    boardSetup(): Space;
}
//# sourceMappingURL=board.d.ts.map