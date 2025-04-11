import { Player } from '@aklapper/games-components';

interface IActivePlayers {
  Map: Map<string, Player>;
}

export default class ActivePlayers implements IActivePlayers {
  Map: Map<string, Player>;
  constructor() {
    this.Map = new Map<string, Player>();
  }

  get map() {
    return this.Map;
  }

  addPlayer(id: string, player: Player): void {
    if (!this.map.has(id)) this.map.set(id, player);
    else throw new Error('Player already exists');
  }

  getPlayer(id: string): Player {
    const player = this.map.get(id);
    if (player) return player;
    else throw new Error(`Player ID: ${id} does not exist`);
  }

  deletePlayerFromLobby(id: string): void {
    if (this.map.has(id)) this.map.delete(id);
    else throw new Error(`Player ID: ${id} does not exist`);
  }
}
