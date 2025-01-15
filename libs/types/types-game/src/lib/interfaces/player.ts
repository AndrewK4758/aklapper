import { IAvatar } from './avatar.ts';

export interface IPlayer {
  Name: string;
  Id: string;
  Order: number;
  Avatar: IAvatar;

  name: string;
  id: string;
  order: number;
  avatar: IAvatar;
}
