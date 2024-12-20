import { ContextBuilder } from '@aklapper/chain';
import { Context, GameContextKeys, ITestCtxOutput } from '@aklapper/types-game';
import { mockRespObj } from '@aklapper/mocks';
import { Response } from 'express';
import { outputContextResponse } from '../src/lib/commands/action-output/output-context-response';

let ctx: Context, output: ITestCtxOutput, resp: Partial<Response>;

describe('test output response chain', () => {
  beforeAll(() => {
    ctx = ContextBuilder.build();
    output = { message: 'output to client as json' } as ITestCtxOutput;
    resp = mockRespObj();
    ctx.put(GameContextKeys.RESPONSE, resp);
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
    ctx.state.clear();
    ctx.put(GameContextKeys.RESPONSE, resp);
    const commandResult = outputContextResponse.execute(ctx);

    expect(commandResult).toBeTruthy();
    expect(resp.status).toEqual(200);
    expect(ctx.get(GameContextKeys.OUTPUT)).toBeFalsy();
  });
});
