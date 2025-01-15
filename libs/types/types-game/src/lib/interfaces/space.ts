import { SpaceType } from '../types/game.ts';
import { IAvatar } from './avatar.ts';

export interface ISpace {
  Value: string;
  Type: SpaceType;
  Previous: ISpace;
  Next: ISpace;
  Special: ISpace | null;
  AvatarsInSpace: IAvatar[];
  Display: string;

  value: string;
  type: SpaceType;
  previous: ISpace;
  next: ISpace;
  special: ISpace | null;
  avatarsInSpace: IAvatar[];
  display: string;
  occupied: boolean;

  land(avatar: IAvatar): void;
  leave(): void;
  ifOccupied(): void;
}
