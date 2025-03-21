import { IPlayer } from '@aklapper/types';
import { Avatar } from './avatar.js';

export class Player implements IPlayer {
  #Id: string;
  #Name: string;
  #Order!: number;
  #Avatar!: Avatar;
  #ActiveGameID: string | null;
  #InLobby: boolean;
  #CurrentTimeEntered: string;
  constructor(name: string, id: string) {
    this.#Name = name;
    this.#Id = id;
    this.#ActiveGameID = null;
    this.#InLobby = false;
    this.#CurrentTimeEntered = new Date().toUTCString();
  }

  get id(): string {
    return this.#Id;
  }

  get name(): string {
    return this.#Name;
  }

  get order(): number {
    return this.#Order;
  }

  set order(order: number) {
    this.#Order = order;
  }

  get avatar(): Avatar {
    return this.#Avatar;
  }

  set avatar(avatar: Avatar) {
    this.#Avatar = avatar;
  }

  public get activeGameID(): string | null {
    return this.#ActiveGameID;
  }

  public set activeGameID(activeGame: string) {
    this.#ActiveGameID = activeGame;
  }

  public get inLobby(): boolean {
    return this.#InLobby;
  }

  public set inLobby(inLobby: boolean) {
    this.#InLobby = inLobby;
  }

  public get currentTimeEntered(): string {
    return this.#CurrentTimeEntered;
  }
}

export default Player;
