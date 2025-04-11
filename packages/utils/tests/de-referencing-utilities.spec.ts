import { ContextBuilder } from '@aklapper/chain';
import { Game } from '@aklapper/game';
import { mockReqObj, mockRespObj } from '@aklapper/mocks';
import { InstanceOfGame } from '@aklapper/models';
import { GameContextKeys, type AllGameTypes, type Context } from '@aklapper/types';
import type { Request, Response } from 'express';
import { Server } from 'socket.io';
import { deRefContextObject } from '../src/lib/de-ref-context-object.js';

let context: Context<GameContextKeys | string>, req: Partial<Request>, resp: Partial<Response>;
describe('Test de referencing context object', () => {
  beforeAll(async () => {
    req = mockReqObj();
    resp = mockRespObj();

    context = ContextBuilder.build();
    context.put(GameContextKeys.ACTION, 'action');
    context.put(GameContextKeys.GAME, new InstanceOfGame(1, 'gameid', new Game({} as AllGameTypes)));
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
