import { IDie, ISummedRoll } from '@aklapper/types-game';
export declare const generateRandomNumber: (upperBound: number) => number;
export declare const rollDice: (dice: IDie[]) => number[];
export declare const rollSingleDiceMultipleTimes: (count: number, die: IDie, rolls?: Array<number>) => number[];
export declare const rollMultipleDiceMultipleTimes: (totalRolls: number, dice: IDie[], rolls?: number[][]) => number[][];
export declare const rollSingleDiceMultipleTimesAndSum: (count: number, dice: IDie, rolls?: number[]) => ISummedRoll;
export declare const rollMultipleDiceAndSum: (dice: IDie[]) => ISummedRoll;
export declare const rangeSelector: (min: number, max: number) => number;
export declare const rowFinder: (indexOfSpace: number, totalSpaces: number) => number;
export declare const rowMaker: (totalSpaces: number) => number;
//# sourceMappingURL=utils.d.ts.map