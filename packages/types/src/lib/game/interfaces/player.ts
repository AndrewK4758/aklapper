import type { IAvatar } from './avatar.js';

export type Email = `${string}@${string}.${string}` | '';
export interface IPlayer {
  readonly name: string;
  readonly id: string;
  readonly currentTimeEntered: string;
  readonly email: Email;
  order: number;
  avatar: IAvatar;
  activeGameID: string | null;
  inLobby: boolean;
  websocketId: string;

  get Name(): string;
  get Id(): string;
  get CurrentTimeEntered(): string;

  get Order(): number;
  set Order(order: number);

  get Avatar(): IAvatar;
  set Avatar(avatar: IAvatar);

  get ActiveGameID(): string | null;
  set ActiveGameID(activeGameID: string);

  get InLobby(): boolean;
  set InLobby(inLobby: boolean);

  get WebsocketId(): string;
  set WebsocketId(socketId: string);

  get Email(): Email;
}
