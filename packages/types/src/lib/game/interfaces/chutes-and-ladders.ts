import type { AvatarTotem, Color } from '../types/game.js';
import type { IDie } from './die.js';
import type { ISpace } from './space.js';

import type { ILiteSpace } from './lite-space.js';

export interface IChutesAndLadders {
  NAME: string;
  MAX_PLAYERS: number;
  MIN_PLAYERS: number;
  CHUTES: number;
  LADDERS: number;
  DIE: IDie;
  startSpace: ISpace;
  endSpace: ISpace;
  colorList: typeof Color;
  avatarList: AvatarTotem[];

  makeGameBoard(): void;
  displayGameBoard(): ILiteSpace[];
}
