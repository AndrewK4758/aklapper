import type { IAvatar } from './avatar.js';

export interface IPlayer {
  name: string;
  id: string;
  order: number;
  avatar: IAvatar;
  activeGameID: string | null;
  inLobby: boolean;
  currentTimeEntered: string;
}
