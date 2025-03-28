import { ContextBuilder } from '@aklapper/chain';
import { Game } from '@aklapper/game';
import { ChutesAndLadders } from '@aklapper/games';
import { mockReqObj, mockRespObj } from '@aklapper/mocks';
import { InstanceOfGame } from '@aklapper/models';
import { Color, Context, GameContextKeys, ILoadRegisterData } from '@aklapper/types';
import { getCurrentMinute } from '@aklapper/utils';
import { Request, Response } from 'express';
import { loadRegister } from '../src/lib/commands/action-load-register/load-register-start.js';
import { sendLoadRegister } from '../src/lib/commands/action-load-register/send-load-register-data.js';

let ctx: Context<GameContextKeys | string>, game: InstanceOfGame, req: Partial<Request>, resp: Partial<Response>;
describe('test load register chain', () => {
  beforeEach(() => {
    game = new InstanceOfGame(getCurrentMinute(), 'game-ID', new Game(new ChutesAndLadders(5, 5)));

    ctx = ContextBuilder.build();

    req = mockReqObj();
    resp = mockRespObj();

    ctx.put(GameContextKeys.ACTION, 'load-register');
    ctx.put(GameContextKeys.REQUEST, req as Request);
    ctx.put(GameContextKeys.RESPONSE, resp as Response);
    ctx.put(GameContextKeys.NEXT, '');
    ctx.put(GameContextKeys.OUTPUT, {});
    ctx.put(GameContextKeys.GAME, game);
  });

  it('should add avatar list and color list to context object', () => {
    const commandResult = loadRegister.execute(ctx);

    const avatarListAndColors = ctx.get(GameContextKeys.OUTPUT) as ILoadRegisterData;

    expect(commandResult).toBeTruthy();
    expect(ctx.get(GameContextKeys.NEXT)).toEqual('send-load-register-data');
    expect(avatarListAndColors.avatarList).toEqual(game.instance.instance.avatarList);
    expect(avatarListAndColors.avatarColorList).toEqual(Color);
    expect(ctx.get(GameContextKeys.OUTPUT)).toEqual(avatarListAndColors);
  });

  it('should add load register data to out property of context object', () => {
    ctx.put(GameContextKeys.NEXT, 'send-load-register-data');
    const commandResult = sendLoadRegister.execute(ctx);

    expect(commandResult).toBeTruthy();
  });
});
