import type { IAvatar } from './avatar.js';

export type Email = `${string}@${string}.${string}` | '';

export interface IPlayer {
  get name(): string;
  get id(): string;
  get currentTimeEntered(): string;

  get order(): number;
  set order(order: number);

  get avatar(): IAvatar;
  set avatar(avatar: IAvatar);

  get activeGameID(): string | null;
  set activeGameID(activeGameID: string);

  get inLobby(): boolean;
  set inLobby(inLobby: boolean);

  get socketIoId(): string | null;
  set socketIoId(socketId: string);

  get email(): Email;
}

export type IPlayerClientData = Pick<
  IPlayer,
  'name' | 'id' | 'email' | 'activeGameID' | 'inLobby' | 'currentTimeEntered' | 'socketIoId'
>;
