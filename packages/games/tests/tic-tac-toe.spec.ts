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

  it('Should pass and return avatar photo svg file name', () => {
    expect(game.addAvatarSvgToDisplay('X')).toEqual('x.svg');
    expect(game.addAvatarSvgToDisplay('O')).toEqual('o.svg');
  });
});
