import { ISpace } from './space';

export interface IBoard {
  TotalSpaces: number;
  SpaceMaker: (indexOfSpace: number) => ISpace;
  boardSetup(): void;
}
