import type { IAvatar } from './avatar.js';

export interface IPlayer {
  readonly name: string;
  readonly id: string;
  readonly currentTimeEntered: string;
  order: number;
  avatar: IAvatar;
  activeGameID: string | null;
  inLobby: boolean;

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
}
