import { mockReqObj } from '@aklapper/mocks';
import type { IBuiltGame } from '@aklapper/types';
import type { Request } from 'express';
import games from '../../src/data/games-list.js';
import useSelectedGame from '../../src/middleware/use-selected-game.js';

let req: Partial<Request>;

describe('Test use selected game middleware', () => {
  beforeAll(() => {
    req = mockReqObj();

    req.selectedGame = games[0];
  });
  it('Should pass and add the BuiltGame to the req object', () => {
    useSelectedGame(req as Request);

    expect(req.selectedGame).toBeTruthy();
    expect((req.selectedGame as IBuiltGame).name).toEqual(games[0].name);
  });

  it('Should pass and return an error message and 404 status', () => {
    req.selectedGame = games[1];
    useSelectedGame(req as Request);

    expect(req.selectedGameName).not.toEqual('Chutes & Ladders');
  });
});
