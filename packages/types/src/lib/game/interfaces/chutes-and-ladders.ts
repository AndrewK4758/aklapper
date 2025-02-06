import type { AvatarTotem, Color } from '../types/game.ts';
import type { IDie } from './die.ts';
import type { ISpace } from './space.ts';

import type { ILiteSpace } from './lite-space.js';

export interface IChutesAndLadders {
  MAX_PLAYERS: number;
  MIN_PLAYERS: number;
  CHUTES: number;
  LADDERS: number;
  DIE: IDie;
  startSpace: ISpace;
  colorList: typeof Color;
  avatarList: AvatarTotem[];

  makeGameBoard(): void;
  displayGameBoard(): ILiteSpace[];
}
