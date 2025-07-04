import type { IBoard } from '@aklapper/types';
import { Space } from './space.js';

export class Board implements IBoard {
  TotalSpaces: number;
  SpaceMaker: (indexOfSpace: number) => Space;

  constructor(totalSpaces: number, spaceMaker: (indexOfSpace: number) => Space) {
    this.TotalSpaces = totalSpaces;
    this.SpaceMaker = spaceMaker;
    this.boardSetup();
  }

  boardSetup() {
    let space = this.SpaceMaker(this.TotalSpaces);
    for (let indexOfSpace = this.TotalSpaces - 1; indexOfSpace > 0; indexOfSpace--) {
      space.previous = this.SpaceMaker(indexOfSpace);
      space.previous.next = space;
      space = space.previous;
    }

    return space;
  }
}
