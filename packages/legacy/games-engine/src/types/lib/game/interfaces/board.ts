import type { ISpace } from './space.ts';

export interface IBoard {
  TotalSpaces: number;
  SpaceMaker: (indexOfSpace: number) => ISpace;
  boardSetup(): void;
}
