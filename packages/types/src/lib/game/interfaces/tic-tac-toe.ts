import type { AvatarTotem, Color } from '../types/game.js';
import type { ILiteSpace } from './lite-space.js';
import type { ISpace } from './space.js';

export interface ITicTacToe {
  NAME: string;
  MIN_PLAYERS: number;
  MAX_PLAYERS: number;
  startSpace: ISpace;
  avatarList: AvatarTotem[];
  colorList: typeof Color;

  makeGameBoard(): void;
  displayGameBoard(): ILiteSpace[];
}
