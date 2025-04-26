import type { Email, IPlayer, IPlayerClientData } from '@aklapper/types';
import type { Avatar } from './avatar.js';

export class Player implements IPlayer {
  private readonly _Name: string;
  private readonly _Id: string;
  private readonly _CurrentTimeEntered: string;
  private readonly _Email: Email;
  private _Order!: number;
  private _Avatar!: Avatar;
  private _ActiveGameID: string | null;
  private _InLobby: boolean;
  private _SocketIoId: string | undefined;

  constructor(name: string, id: string, email: Email) {
    this._Name = name;
    this._Id = id;
    this._ActiveGameID = null;
    this._InLobby = false;
    this._CurrentTimeEntered = new Date().toISOString();
    this._Email = email;
    this._SocketIoId = undefined;
  }

  public get id(): string {
    return this._Id;
  }

  public get name(): string {
    return this._Name;
  }

  public get order(): number {
    return this._Order;
  }

  public set order(order: number) {
    this._Order = order;
  }

  public get avatar(): Avatar {
    return this._Avatar;
  }

  public set avatar(avatar: Avatar) {
    this._Avatar = avatar;
  }

  public get activeGameID(): string | null {
    return this._ActiveGameID;
  }

  public set activeGameID(activeGame: string | null) {
    this._ActiveGameID = activeGame;
  }

  public get inLobby(): boolean {
    return this._InLobby;
  }

  public set inLobby(inLobby: boolean) {
    this._InLobby = inLobby;
  }

  public get currentTimeEntered(): string {
    return this._CurrentTimeEntered;
  }

  public get socketIoId(): string | undefined {
    return this._SocketIoId;
  }

  public set socketIoId(socketId: string | undefined) {
    this._SocketIoId = socketId;
  }

  public get email() {
    return this._Email;
  }

  prepareJsonPlayerToSend(): IPlayerClientData {
    const partialPlayer: IPlayerClientData = {
      name: this.name,
      id: this.id,
      email: this.email,
      activeGameID: this.activeGameID,
      inLobby: this.inLobby,
      currentTimeEntered: this.currentTimeEntered,
      socketIoId: this.socketIoId,
    };

    return partialPlayer;
  }

  updateActivePlayerDetails(player: IPlayerClientData): void {
    if (this.inLobby === false) this.inLobby = player.inLobby;
    if (this.socketIoId !== player.socketIoId) this.socketIoId = player.socketIoId;
    if (this.activeGameID !== player.activeGameID) this.activeGameID = player.activeGameID;
  }
}

export default Player;
