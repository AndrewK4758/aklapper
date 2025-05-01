import type { InstanceOfGame } from '@aklapper/models';
import type { GameInstanceLobbyData, GameNameString, IGamesInLobby } from '@aklapper/types';

class GamesInLobby implements IGamesInLobby {
  games: Map<string, InstanceOfGame>;
  constructor() {
    this.games = new Map<GameNameString, InstanceOfGame>();
  }

  get map(): Map<string, InstanceOfGame> {
    return this.games;
  }

  hasGame(gameId: string): boolean {
    return this.games.has(gameId);
  }

  getGameActiveGame(gameId: string): InstanceOfGame {
    if (this.hasGame(gameId) && this.hasGame(gameId) !== undefined) return this.games.get(gameId) as InstanceOfGame;
    else throw new Error('No Instance Of Game exists');
  }

  addGame(gameId: string, gameInstance: InstanceOfGame): void {
    this.map.set(gameId, gameInstance);
  }

  deleteGame(gameId: string): void | string {
    const errorString = `Game ID: ${gameId} does not exist`;

    if (!this.map.has(gameId)) throw ReferenceError(errorString);
    else this.map.delete(gameId);
  }

  prepDataToSend(): GameInstanceLobbyData[] {
    const dataToSend: GameInstanceLobbyData[] = [];

    for (const [gameId, instance] of this.map) {
      const gameInLobby: GameInstanceLobbyData = {
        gameName: instance.instance.instance.NAME,
        gameInstanceID: gameId,
        inLobby: instance.inLobby,
        playersArray: instance.instance.playersArray.map(p => p.prepareJsonPlayerToSend()),
      };

      dataToSend.push(gameInLobby);
    }
    return dataToSend;
  }
}

const gamesInLobby = new GamesInLobby();

export default gamesInLobby;
