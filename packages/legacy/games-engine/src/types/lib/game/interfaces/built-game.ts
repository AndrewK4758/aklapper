import type { Chain } from './chain.ts';
import type { IRule } from './rule.ts';

export interface IBuiltGame {
  id: string;
  name: string;
  description?: string;
  imageURL?: string;
  rules: IRule[];
  players: {
    min: number;
    max: number;
  };
  chain: Chain | null;
  instance(): unknown;
}
