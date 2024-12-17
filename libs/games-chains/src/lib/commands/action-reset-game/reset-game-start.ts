import { CommandBuilder } from '@aklapper/chain';
import { deRefContextObject, getCurrentMinute } from '@aklapper/utils';
import { Context, GameContextKeys } from '@aklapper/types-game';

export const resetGame = CommandBuilder.build((context: Context) => {
  if (context.get(GameContextKeys.ACTION) && context.getString(GameContextKeys.ACTION) === 'reset') {
    const { game, req } = deRefContextObject(context);
    context.put('req-params-id', req.params['id'] as string);
    game.updateLastActive(getCurrentMinute());
    context.put(GameContextKeys.NEXT, 'flip-winner-flag');
    return true;
  } else return false;
});

export default resetGame;
