import { ContextBuilder } from '@aklapper/chain';
import { Context, GameContextKeys } from '@aklapper/types';
import { logAction } from '../src/lib/commands/action-log/log-actions-start.js';

let ctx: Context<GameContextKeys | string>;
describe('it should log the action property to the console', () => {
  beforeAll(() => {
    ctx = ContextBuilder.build();
    ctx.put(GameContextKeys.ACTION, 'ACTION');
  });

  it('logs action off context to console', () => {
    const commandResult = logAction.execute(ctx);

    expect(commandResult).toBeTruthy();
    expect(ctx.getString(GameContextKeys.ACTION)).toEqual('ACTION');
  });
});
