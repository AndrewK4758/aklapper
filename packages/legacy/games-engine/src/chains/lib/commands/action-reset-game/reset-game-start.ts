import { CommandBuilder } from '../../../../chain/index.ts';
import { type Context, GameContextKeys } from '../../../../types/index.ts';
import { deRefContextObject, getCurrentMinute } from '../../../../utils/index.ts';

export const resetGame = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  if (
    context.get(GameContextKeys.ACTION) &&
    context.getString(GameContextKeys.ACTION) === 'reset'
  ) {
    const { game, req } = deRefContextObject(context);
    context.put('req-params-id', req.params['id'] as string);
    game.updateLastActive(getCurrentMinute());
    context.put(GameContextKeys.NEXT, 'flip-winner-flag');
    return true;
  } else return false;
});

export default resetGame;
