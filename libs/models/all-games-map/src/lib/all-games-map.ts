import { GameInstanceID, IInstanceOfGame, IAllGamesMap } from '@aklapper/types-game';

export class AllGamesMap implements IAllGamesMap {
  AllGames: Map<GameInstanceID, IInstanceOfGame>;
  constructor() {
    this.AllGames = new Map<GameInstanceID, IInstanceOfGame>();
  }

  addGame(gameInstanceID: GameInstanceID, game: IInstanceOfGame) {
    this.AllGames.set(gameInstanceID, game);
  }
}
