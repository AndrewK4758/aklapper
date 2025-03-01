import type { IRule } from './rule.js';
import type { Chain } from './chain.js';

export interface IBuiltGame {
  id: string;
  name: string;
  description?: string;
  imageURL?: string;
  rules: IRule[];
  chain: Chain | null;
  instance(): unknown;
}
