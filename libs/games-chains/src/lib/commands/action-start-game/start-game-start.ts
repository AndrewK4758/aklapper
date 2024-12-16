import { CommandBuilder } from '@aklapper/chain';
import { Context, GameContextKeys } from '@aklapper/types-game';

export const startGame = CommandBuilder.build((context: Context) => {
  if (context.get(GameContextKeys.ACTION) && context.getString(GameContextKeys.ACTION) === 'start') {
    context.put(GameContextKeys.NEXT, 'verify-ready-to-play');
    return true;
  } else return false;
});

export default startGame;
