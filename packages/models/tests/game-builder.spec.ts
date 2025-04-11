import type { AllGameTypes } from '@aklapper/types';
import { GameBuilder } from '../src/lib/game-builder/game-builder.js';

let gb: GameBuilder;

describe('Test Game Builder', () => {
  beforeAll(() => {
    gb = new GameBuilder();
  });

  it('Should build a game and pass', () => {
    const game = gb
      .setId('1')
      .setName('game 1')
      .setDescription('description of game 1')
      .setImageURL('http://imageOfGame1.com')
      .setRule(1, 'rule title', 'rule value')
      .setGameFunctionality([], true)
      .setInstance(() => ({ MAX_PLAYERS: 4 }) as AllGameTypes)
      .build();

    expect(game.name).toEqual('game 1');
    expect(game.id).toEqual('1');
    expect(game.description).toEqual('description of game 1');
    expect(game.imageURL).toEqual('http://imageOfGame1.com');
    expect(game.rules[0].title).toEqual('rule title');
    expect(game.rules[0].order).toEqual(1);
    expect(game.rules[0].value).toEqual('rule value');
    expect(game.instance()).toHaveProperty('MAX_PLAYERS', 4);
    expect(game.chain).toBeTruthy();
  });
});
