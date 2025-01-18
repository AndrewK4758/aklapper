import { AvatarTotem, Color } from '../types/game.ts';
import { IDie } from './die.ts';
import { ISpace } from './space.ts';

import type { ILiteSpace } from './lite-space.ts';

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
