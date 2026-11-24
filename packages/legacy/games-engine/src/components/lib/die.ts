import type { IDie } from '../../types/index.ts';
import { generateRandomNumber } from './utils.js';

export class Die implements IDie {
  Sides: number;
  constructor(sides: number) {
    this.Sides = sides;
  }

  get sides() {
    return this.Sides;
  }

  roll(): number {
    return generateRandomNumber(this.sides);
  }
}

export default Die;
