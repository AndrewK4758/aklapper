import type { IRule } from './rule.ts';
import type { Chain } from './chain.ts';

export interface IBuiltGame {
  id: string;
  name: string;
  description?: string;
  imageURL?: string;
  rules: IRule[];
  chain: Chain | null;
  instance(): unknown;
}
