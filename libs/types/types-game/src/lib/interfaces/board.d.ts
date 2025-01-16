import { ISpace } from './space.ts';
export interface IBoard {
    TotalSpaces: number;
    SpaceMaker: (indexOfSpace: number) => ISpace;
    boardSetup(): void;
}
//# sourceMappingURL=board.d.ts.map