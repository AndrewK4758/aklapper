import type { Player } from '@aklapper/games-components';

export type ActivePlayerMap = Map<string, Player>;

export interface IActivePlayers {
  _Map: ActivePlayerMap;

  get map(): ActivePlayerMap;

  addPlayer(id: string, player: Player): void;

  getPlayer(id: string): Player;

  deletePlayerFromLobby(id: string): void;
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
    else throw new Error('Player already exists');
  }

  getPlayer(id: string): Player {
    const player = this.map.get(id);
    if (player) {
      return player;
    } else throw new Error(`Player ID: ${id} does not exist`);
  }

  deletePlayerFromLobby(id: string): void {
    if (this.map.has(id)) this.map.delete(id);
    else throw new Error(`Player ID: ${id} does not exist`);
  }
}
