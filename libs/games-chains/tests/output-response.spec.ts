import { ContextBuilder } from '@aklapper/chain';
import { Context, GameContextKeys, ITestCtxOutput } from '@aklapper/types';
import { mockReqObj, mockRespObj } from '@aklapper/mocks';
import { Response, type Request } from 'express';
import { outputContextResponse } from '../src/lib/commands/action-output/output-context-response.js';

let ctx: Context<GameContextKeys>,
  output: ITestCtxOutput,
  req: Partial<Request>,
  resp: Partial<Response>;

describe('test output response chain', () => {
  beforeEach(() => {
    ctx = ContextBuilder.build();
    output = { message: 'output to client as json' } as ITestCtxOutput;
    req = mockReqObj();
    resp = mockRespObj();

    ctx.put(GameContextKeys.REQUEST, req as Request);
    ctx.put(GameContextKeys.RESPONSE, resp as Response);
  });

  it('should put the value of the out property on the context object onto the response object to send to client', () => {
    ctx.put(GameContextKeys.OUTPUT, output);
    const commandResult = outputContextResponse.execute(ctx);

    expect(commandResult).toBeTruthy();
    expect(resp.status).toEqual(201);
    expect(resp.json).toEqual(output);
    expect(ctx.get(GameContextKeys.OUTPUT)).toEqual(output);
  });

  it('should send status of 200 without data being sent from context object', () => {
    const commandResult = outputContextResponse.execute(ctx);

    expect(commandResult).toBeTruthy();
    expect(resp.status).toEqual(200);
    expect(ctx.get(GameContextKeys.OUTPUT)).toBeFalsy();
  });
});
