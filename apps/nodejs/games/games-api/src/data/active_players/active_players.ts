import type { ActivePlayerMap, IActivePlayers, IPlayer } from '@aklapper/types';

export default class ActivePlayers implements IActivePlayers {
  _Map: ActivePlayerMap;
  constructor() {
    this._Map = new Map<string, IPlayer>();
  }

  get map() {
    return this._Map;
  }

  addPlayer(id: string, player: IPlayer): void {
    if (!this.map.has(id)) this.map.set(id, player);
    else throw new Error('Player already exists');
  }

  getPlayer(id: string): IPlayer {
    const player = this.map.get(id);
    if (player) return player;
    else throw new Error(`Player ID: ${id} does not exist`);
  }

  deletePlayerFromLobby(id: string): void {
    if (this.map.has(id)) this.map.delete(id);
    else throw new Error(`Player ID: ${id} does not exist`);
  }
}
