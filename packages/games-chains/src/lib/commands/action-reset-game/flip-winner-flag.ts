import { CommandBuilder } from '@aklapper/chain';
import { type Context, GameContextKeys } from '@aklapper/types';
import { deRefContextObject } from '@aklapper/utils';

export const flipHaveWinnerFlag = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  if (context.get(GameContextKeys.NEXT) && context.getString(GameContextKeys.NEXT) === 'flip-winner-flag') {
    const { game } = deRefContextObject(context);

    game.instance.haveWinner = false;

    context.put(GameContextKeys.NEXT, 'clear-spaces');
    return true;
  } else return false;
});

export default flipHaveWinnerFlag;
