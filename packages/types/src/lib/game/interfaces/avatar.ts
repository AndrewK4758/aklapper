import type { Color } from '../types/game.js';
import type { ISpace } from './space.js';

export interface IAvatar {
  Name: string;
  Color: Color;
  Location: ISpace | undefined;

  name: string;
  color: Color;
  location: ISpace | undefined;

  _moveForward(numberOfSpaces: number): ISpace | null;

  _moveBackward(numberOfSpaces: number): ISpace | null;

  move(numberOfSpaces: number): void;
}
