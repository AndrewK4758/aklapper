import type { GameNameString, GamesInLobbyPending, IGamesInLobby, IInstanceOfGame } from '@aklapper/types';
import games from '../games-list.js';

class GamesInLobby implements IGamesInLobby {
  games: Map<string, IInstanceOfGame[]>;
  constructor() {
    this.games = new Map<GameNameString, IInstanceOfGame[]>();
    games.forEach(game => this.games.set(game.name, []));
  }

  get Map(): Map<string, IInstanceOfGame[]> {
    return this.games;
  }

  hasGame(gameName: string): boolean {
    return this.games.has(gameName);
  }

  getGameActiveGames(gameName: string): IInstanceOfGame[] {
    if (this.hasGame(gameName) && this.hasGame(gameName) !== undefined)
      return this.games.get(gameName) as IInstanceOfGame[];
    else throw new Error('No Instance Of Game exists');
  }

  addGame(gameName: string, gameInstance: IInstanceOfGame): string | void {
    const errorString = `${gameName} does not exist in game library`;
    const game = this.getGameActiveGames(gameName);
    if (game) game.push(gameInstance);
    else throw new ReferenceError(errorString);
  }

  deleteGame(gameName: string, gameId: string): void | string {
    const errorString = `Game ID: ${gameId} for ${gameName} does not exist`;

    const gameInstancesArray = this.getGameActiveGames(gameName);
    if (gameInstancesArray) {
      const gameIdIdx = gameInstancesArray.findIndex(({ gameInstanceID }) => gameInstanceID === gameId);

      if (gameIdIdx < 0) throw ReferenceError(errorString);
      else gameInstancesArray.slice(gameIdIdx, gameIdIdx);
    }
  }

  prepDataToSend(): GamesInLobbyPending[] {
    const dataToSend: GamesInLobbyPending[] = [];

    for (const [gameName, instances] of this.Map) {
      const instancesToSend = instances.map(instance => ({
        gameInstanceID: instance.gameInstanceID,
        inLobby: instance.inLobby,
        instance: { playersArray: instance.instance.playersArray },
      })) as Partial<IInstanceOfGame>[];
      dataToSend.push({ [gameName]: instancesToSend });
    }
    return dataToSend;
  }
}

const gamesInLobby = new GamesInLobby();

export default gamesInLobby;
