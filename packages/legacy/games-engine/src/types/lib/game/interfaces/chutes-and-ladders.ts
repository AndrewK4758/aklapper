import type { AvatarTotem, Color } from '../types/game.ts';
import type { IDie } from './die.ts';
import type { ILiteSpace } from './lite-space.ts';
import type { ISpace } from './space.ts';

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
