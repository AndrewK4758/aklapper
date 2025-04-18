import type { Email, IActivePlayers, IPlayer } from '@aklapper/types';
import type { Avatar } from './avatar.js';

export class Player implements IPlayer {
  readonly _Name: string;
  readonly _Id: string;
  readonly _CurrentTimeEntered: string;
  readonly _Email: Email;
  _Order!: number;
  _Avatar!: Avatar;
  _ActiveGameID: string | null;
  _InLobby: boolean;
  _SocketIoId: string | undefined;

  static PrepareJsonPlayerToSend = function (player: Partial<IPlayer>) {
    const partialPlayer: Partial<IPlayer> = {
      name: player.name,
      id: player.id,
      email: player.email,
      activeGameID: player.activeGameID,
      inLobby: player.inLobby,
      currentTimeEntered: player.currentTimeEntered,
    };

    return partialPlayer;
  };

  static UpdateActivePlayer = function (player: IPlayer, activePlayerMap: IActivePlayers): IPlayer {
    const playerInstance: IPlayer = activePlayerMap.getPlayer(player.id);

    if (player.activeGameID && player.activeGameID !== playerInstance.activeGameID)
      playerInstance.activeGameID = player.activeGameID;
    if (player.socketIoId && playerInstance.socketIoId !== player.socketIoId)
      playerInstance.socketIoId = player.socketIoId;
    if (player.inLobby !== playerInstance.inLobby) playerInstance.inLobby = player.inLobby;

    return playerInstance;
  };

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

  public set activeGameID(activeGame: string) {
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

  public set socketIoId(socketId: string) {
    this._SocketIoId = socketId;
  }

  public get email() {
    return this._Email;
  }

  // prepareJsonPlayerToSend(): Partial<IPlayer> {
  //   const partialPlayer: Partial<IPlayer> = {
  //     name: this.name,
  //     id: this.id,
  //     email: this.email,
  //     activeGameID: this.activeGameID,
  //     inLobby: this.inLobby,
  //     currentTimeEntered: this.currentTimeEntered,
  //   };

  //   return partialPlayer;
  // }

  // parseJsonPlayerReceived(jsonPlayer: string): void {
  //   try {
  //     const parsedPlayer: IPlayer = JSON.parse(jsonPlayer);

  //     this.inLobby = parsedPlayer.inLobby;
  //     if (parsedPlayer.socketIoId) this.socketIoId = parsedPlayer.socketIoId;
  //     if (parsedPlayer.activeGameID) this.activeGameID = parsedPlayer.activeGameID;
  //   } catch (error) {
  //     console.error(error);
  //     throw error;
  //   }
  // }
}

export default Player;
