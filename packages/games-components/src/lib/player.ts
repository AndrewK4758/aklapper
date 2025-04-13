import type { Email, IPlayer } from '@aklapper/types';
import type { Avatar } from './avatar.js';

export class Player implements IPlayer {
  readonly id: string;
  readonly name: string;
  readonly currentTimeEntered: string;
  readonly email: Email;
  order!: number;
  avatar!: Avatar;
  activeGameID: string | null;
  inLobby: boolean;
  websocketId!: string;
  constructor(name: string, id: string, email: Email) {
    this.name = name;
    this.id = id;
    this.activeGameID = null;
    this.inLobby = false;
    this.currentTimeEntered = new Date().toISOString();
    this.email = email;
  }

  public get Id(): string {
    return this.id;
  }

  public get Name(): string {
    return this.name;
  }

  public get Order(): number {
    return this.order;
  }

  public set Order(order: number) {
    this.order = order;
  }

  public get Avatar(): Avatar {
    return this.avatar;
  }

  public set Avatar(avatar: Avatar) {
    this.avatar = avatar;
  }

  public get ActiveGameID(): string | null {
    return this.activeGameID;
  }

  public set ActiveGameID(activeGame: string) {
    this.activeGameID = activeGame;
  }

  public get InLobby(): boolean {
    return this.inLobby;
  }

  public set InLobby(inLobby: boolean) {
    this.inLobby = inLobby;
  }

  public get CurrentTimeEntered(): string {
    return this.currentTimeEntered;
  }

  public get WebsocketId(): string {
    return this.websocketId;
  }

  public set WebsocketId(socketId: string) {
    this.websocketId = socketId;
  }

  public get Email() {
    return this.email;
  }
}

export default Player;
