import { CommandBuilder } from '@aklapper/chain';
import { deRefContextObject } from '@aklapper/utils';
import { Context, GameContextKeys } from '@aklapper/types-game';

export const rotatePlayer = CommandBuilder.build((context: Context) => {
  if (context.get(GameContextKeys.NEXT) && context.getString(GameContextKeys.NEXT) === 'rotate-player') {
    const { game } = deRefContextObject(context);
    game.instance.rotatePlayers();
    return true;
  } else return false;
});

export default rotatePlayer;