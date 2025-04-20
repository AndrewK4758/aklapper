import type { GameInsanceLobbyData, GameNameString, IGamesInLobby, IInstanceOfGame } from '@aklapper/types';

class GamesInLobby implements IGamesInLobby {
  games: Map<string, IInstanceOfGame>;
  constructor() {
    this.games = new Map<GameNameString, IInstanceOfGame>();
  }

  get map(): Map<string, IInstanceOfGame> {
    return this.games;
  }

  hasGame(gameId: string): boolean {
    return this.games.has(gameId);
  }

  getGameActiveGame(gameId: string): IInstanceOfGame {
    if (this.hasGame(gameId) && this.hasGame(gameId) !== undefined) return this.games.get(gameId) as IInstanceOfGame;
    else throw new Error('No Instance Of Game exists');
  }

  addGame(gameId: string, gameInstance: IInstanceOfGame): void {
    this.map.set(gameId, gameInstance);
  }

  deleteGame(gameId: string): void | string {
    const errorString = `Game ID: ${gameId} does not exist`;

    if (!this.map.has(gameId)) throw ReferenceError(errorString);
    else this.map.delete(gameId);
  }

  prepDataToSend(): GameInsanceLobbyData[] {
    const dataToSend: GameInsanceLobbyData[] = [];

    for (const [gameId, instance] of this.map) {
      const gameInLobby: GameInsanceLobbyData = {
        gameName: instance.instance.instance.NAME,
        gameInstanceID: gameId,
        inLobby: instance.inLobby,
        playersArray: instance.instance.playersArray,
      };

      dataToSend.push(gameInLobby);
    }
    return dataToSend;
  }
}

const gamesInLobby = new GamesInLobby();

export default gamesInLobby;
