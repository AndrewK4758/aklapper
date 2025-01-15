import { ContextBuilder } from '@aklapper/chain';
import { InstanceOfGame } from '@aklapper/game-instance';
import { Context, GameContextKeys } from '@aklapper/types-game';
import { mockReqObj, mockRespObj } from '@aklapper/mocks';
import { Game } from '@aklapper/game';
import { ChutesAndLadders } from '@aklapper/chutes-and-ladders';
import type { Request, Response } from 'express';
import { Server } from 'socket.io';
import { deRefContextObject } from '../src/lib/de-ref-context-object.ts';

let context: Context<GameContextKeys | string>, req: Partial<Request>, resp: Partial<Response>;
describe('Test de referencing context object', () => {
  beforeAll(() => {
    req = mockReqObj();
    resp = mockRespObj();

    context = ContextBuilder.build();
    context.put(GameContextKeys.ACTION, 'action');
    context.put(GameContextKeys.GAME, new InstanceOfGame(1, 'gameid', new Game(new ChutesAndLadders(5, 5))));
    context.put(GameContextKeys.REQUEST, req as Request);
    context.put(GameContextKeys.RESPONSE, resp as Response);
    context.put(GameContextKeys.NEXT, 'next-handler');
    context.put(GameContextKeys.OUTPUT, { message: 'output' });
    context.put(GameContextKeys.IO, new Server());
  });

  it('Should pass and de-reference all properties of context object', () => {
    const { action, game, req, resp, next, output, io } = deRefContextObject(context);

    expect(action).toEqual('action');
    expect(game).toBeInstanceOf(InstanceOfGame);
    expect(req).toEqual(req);
    expect(resp).toEqual(resp);
    expect(next).toEqual('next-handler');
    expect(output).toEqual({ message: 'output' });
    expect(io).toBeInstanceOf(Server);
  });
});
