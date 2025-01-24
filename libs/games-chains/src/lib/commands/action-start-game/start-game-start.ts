import { CommandBuilder } from '@aklapper/chain';
import { Context, GameContextKeys } from '@aklapper/types';

export const startGame = CommandBuilder.build(
  (context: Context<GameContextKeys | string>) => {
    if (
      context.get(GameContextKeys.ACTION) &&
      context.getString(GameContextKeys.ACTION) === 'start'
    ) {
      context.put(GameContextKeys.NEXT, 'verify-ready-to-play');

      return true;
    } else return false;
  },
);

export default startGame;
