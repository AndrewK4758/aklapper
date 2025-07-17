import { Space } from '@aklapper/games-components';
import { TicTacToe } from '../src/lib/tic-tac-toe.js';

let game: TicTacToe;

describe('Test Tic Tac Toe', () => {
  beforeAll(() => {
    game = new TicTacToe();
  });

  it('Should pass and return game board with length of 9', () => {
    expect(game.displayGameBoard().length).toEqual(9);
  });

  it('Should pass and return a normal Space', () => {
    const space = game.spaceMaker(2);

    expect(space).toBeInstanceOf(Space);
  });

  it('Should pass and return avatar photo webp file name', () => {
    expect(game.addAvatarToDisplay('X')).toEqual('x.webp');
    expect(game.addAvatarToDisplay('O')).toEqual('o.webp');
  });
});
