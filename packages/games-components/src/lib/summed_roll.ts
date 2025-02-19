import { ISummedRoll } from '@aklapper/types';

export class SummedRoll implements ISummedRoll {
  RollValues: number[];
  Sum: number;
  constructor(numbers: number[]) {
    this.RollValues = numbers;
    this.Sum = this.RollValues.reduce((a, b) => a + b, 0);
  }
  get rollValues(): number[] {
    return this.RollValues;
  }

  get sum(): number {
    return this.Sum;
  }
}

export default SummedRoll;
