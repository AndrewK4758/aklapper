import { Player } from '@aklapper/games-components';

export type ActivePlayerMap = Map<string, Player>;

export interface IActivePlayers {
  _Map: ActivePlayerMap;

  get map(): ActivePlayerMap;

  addPlayer(id: string, player: Player): void;

  getPlayer(id: string): Player | null;

  deletePlayerFromLobby(id: string): void;

  NoPlayer(id: string): Error;
}

export default class ActivePlayers implements IActivePlayers {
  _Map: ActivePlayerMap;

  constructor() {
    this._Map = new Map<string, Player>();
  }

  get map() {
    return this._Map;
  }

  addPlayer(id: string, player: Player): void {
    if (!this.map.has(id)) this.map.set(id, player);
  }

  getPlayer(id: string): Player | null {
    const player = this.map.get(id);
    if (player) return player;
    else return null;
  }

  deletePlayerFromLobby(id: string): void {
    if (this.map.has(id)) this.map.delete(id);
  }

  NoPlayer(id: string) {
    return new Error(`Player with ID: ${id} does not exist. Please Register or login to continue.`);
  }
}
