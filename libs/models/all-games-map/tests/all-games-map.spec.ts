import { ChutesAndLadders } from '@aklapper/chutes-and-ladders';
import { Game } from '@aklapper/game';
import { InstanceOfGame } from '@aklapper/game-instance';
import { GameInstanceID, Minute } from '@aklapper/types-game';
import { getCurrentMinute } from '@aklapper/utils';
import { AllGamesMap } from '../src/lib/all-games-map';

let activeGame: InstanceOfGame, minute: Minute, gameInstanceID: GameInstanceID, allGamesMap: AllGamesMap;

describe('test AllGamesMapClass', () => {
  beforeAll(() => {
    minute = getCurrentMinute();
    gameInstanceID = 'G@Me!D';
    activeGame = new InstanceOfGame(minute, gameInstanceID, new Game(new ChutesAndLadders(5, 5)));
    allGamesMap = new AllGamesMap();
  });

  it('Should pass', () => {
    allGamesMap.addGame(gameInstanceID, activeGame);

    expect(allGamesMap.AllGames.size).toEqual(1);
    expect(allGamesMap.AllGames.get(gameInstanceID)).toEqual(activeGame);
  });
});
