import { ContextBuilder } from '@aklapper/chain';
import { ChutesAndLadders } from '@aklapper/chutes-and-ladders';
import { Game } from '@aklapper/game';
import { InstanceOfGame } from '@aklapper/game-instance';
import { getCurrentMinute } from '@aklapper/utils';
import { Context, Color, GameContextKeys } from '@aklapper/types-game';
import { mockReqObj, mockRespObj } from '@aklapper/mocks';
import { Request, Response } from 'express';
import { createPlayerID } from '../src/lib/commands/action-register-player/create-player-id';
import { filterSelectedAvatar } from '../src/lib/commands/action-register-player/filter-selected-avatar';
import { playerCreated } from '../src/lib/commands/action-register-player/player-created';
import { registerOnGameInstance } from '../src/lib/commands/action-register-player/register-on-game-instance';
import { registerAction } from '../src/lib/commands/action-register-player/register-player-start';

let ctx: Context<GameContextKeys | string>, game: InstanceOfGame, req: Partial<Request>, resp: Partial<Response>;

describe('test register chain', () => {
  beforeEach(() => {
    game = new InstanceOfGame(getCurrentMinute(), 'game-ID', new Game(new ChutesAndLadders(5, 5)));

    ctx = ContextBuilder.build();

    req = mockReqObj();
    resp = mockRespObj();

    ctx.put(GameContextKeys.REQUEST, req as Request);
    ctx.put(GameContextKeys.RESPONSE, resp as Response);
    ctx.put(GameContextKeys.ACTION, 'register');
    ctx.put(GameContextKeys.NEXT, '');
    ctx.put(GameContextKeys.GAME, game);
  });

  it('should return true for register action', () => {
    expect(registerAction.execute(ctx)).toBeTruthy();
    expect(ctx.get(GameContextKeys.NEXT)).toEqual('create-playerID');
  });

  it('should create a unique player ID', () => {
    ctx.put(GameContextKeys.NEXT, 'create-playerID');
    const commandResult = createPlayerID.execute(ctx);
    const playerID = ctx.get('playerID') as string;

    expect(commandResult).toBeTruthy();
    expect(playerID.length).toEqual(6);
    expect(ctx.get(GameContextKeys.NEXT)).toEqual('register-on-game');
  });

  it('should register player in game instance', () => {
    ctx.put(GameContextKeys.NEXT, 'register-on-game');
    const commandResult = registerOnGameInstance.execute(ctx);

    expect(commandResult).toBeTruthy();
    expect(game.instance.playersArray.length).toEqual(1);
    expect(ctx.get(GameContextKeys.NEXT)).toEqual('filter-avatar');
  });

  it('should filter avatar selected from player selection', () => {
    game.instance.register('player1', 'p-1-id', 'XENOMORPH', Color.RED);
    ctx.put(GameContextKeys.NEXT, 'filter-avatar');

    const commandResult = filterSelectedAvatar.execute(ctx);
    expect(commandResult).toBeTruthy();
    expect(game.instance.instance.avatarList.find(a => a.name === game.instance.playersArray[0].name)).toBeFalsy();
    expect(ctx.get(GameContextKeys.NEXT)).toEqual('player-created');
  });

  it('should add add playerID to response header and add a message object to the out property of context object', () => {
    ctx.put(GameContextKeys.NEXT, 'player-created');
    const commandResult = playerCreated.execute(ctx);

    expect(commandResult).toBeTruthy();
  });
});
