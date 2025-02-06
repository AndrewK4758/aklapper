import type { AvatarTotem, Color } from '../types/game.ts';
import type { ILiteSpace } from './lite-space.ts';
import type { ISpace } from './space.ts';

export interface ITicTacToe {
  MIN_PLAYERS: number;
  MAX_PLAYERS: number;
  startSpace: ISpace;
  avatarList: AvatarTotem[];
  colorList: typeof Color;

  makeGameBoard(): void;
  displayGameBoard(): ILiteSpace[];
}
