import type { GameInstanceID, GameNameString, GamesInLobbyToSend } from '@aklapper/types';
import games from '../games-list.js';

interface IGamesInLobby {
  games: Map<GameNameString, GameInstanceID[]>;
}

class GamesInLobby implements IGamesInLobby {
  games: Map<string, GameInstanceID[]>;
  constructor() {
    this.games = new Map<GameNameString, GameInstanceID[]>();
    games.forEach(game => this.games.set(game.name, []));
  }

  get Map(): Map<string, GameInstanceID[]> {
    return this.Map;
  }

  hasGame(gameName: string): boolean {
    return this.games.has(gameName);
  }

  getGameActiveGames(gameName: string): string[] | undefined {
    if (this.hasGame(gameName)) return this.games.get(gameName);
    else return undefined;
  }

  addGame(gameName: string, gameId: string): string | void {
    const errorString = `${gameName} does not exist in game library`;
    try {
      const game = this.getGameActiveGames(gameName);
      if (game) game.push(gameId);
      else throw new ReferenceError(errorString);
    } catch (error) {
      console.error(error);
      return errorString;
    }
  }

  deleteGame(gameName: string, gameId: string): void | string {
    const errorString = `Game ID: ${gameId} for ${gameName} does not exist`;
    try {
      const game = this.getGameActiveGames(gameName);
      if (game) {
        const gameIdIdx = game.indexOf(gameId);

        if (gameIdIdx < 0) throw ReferenceError(errorString);
        else game.slice(gameIdIdx, gameIdIdx);
      }
    } catch (error) {
      console.error(error);
      return errorString;
    }
  }

  prepDataToSend(): GamesInLobbyToSend[] {
    const dataToSend: GamesInLobbyToSend[] = [];

    for (const [gameName, gameIds] of this.games) {
      if (gameIds.length) {
        const gameWithActiveIdsInLobby: GamesInLobbyToSend = {
          [gameName]: gameIds,
        };
        dataToSend.push(gameWithActiveIdsInLobby);
      }
    }
    return dataToSend;
  }
}

const gamesInLobby = new GamesInLobby();

export default gamesInLobby;
