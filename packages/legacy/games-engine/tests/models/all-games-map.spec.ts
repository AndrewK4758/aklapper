import { Game } from '@aklapper/legacy-games/game';
import type { AllGameTypes, GameInstanceID, Minute } from '@aklapper/legacy-games/types';

import { AllGamesMap } from '../../src/models/lib/all-games-map/all-games-map.js';
import { InstanceOfGame } from '../../src/models/lib/game-instance/instance-of-game.js';

let activeGame: InstanceOfGame,
  minute: Minute,
  gameInstanceID: GameInstanceID,
  allGamesMap: AllGamesMap;

describe('test AllGamesMapClass', () => {
  beforeAll(() => {
    minute = 1;
    gameInstanceID = 'G@Me!D';
    activeGame = new InstanceOfGame(minute, gameInstanceID, new Game({} as AllGameTypes));
    allGamesMap = new AllGamesMap();
  });

  it('Should pass', () => {
    allGamesMap.addGame(gameInstanceID, activeGame);

    expect(allGamesMap.AllGames.size).toEqual(1);
    expect(allGamesMap.AllGames.get(gameInstanceID)).toEqual(activeGame);
  });
});
