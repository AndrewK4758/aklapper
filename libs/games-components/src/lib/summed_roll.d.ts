import { ISummedRoll } from '@aklapper/types-game';
export declare class SummedRoll implements ISummedRoll {
    RollValues: number[];
    Sum: number;
    constructor(numbers: number[]);
    get rollValues(): number[];
    get sum(): number;
}
//# sourceMappingURL=summed_roll.d.ts.map