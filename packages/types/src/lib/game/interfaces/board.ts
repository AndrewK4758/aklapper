import type { ISpace } from './space.js';

export interface IBoard {
  TotalSpaces: number;
  SpaceMaker: (indexOfSpace: number) => ISpace;
  boardSetup(): void;
}
