import { CommandBuilder } from '@aklapper/chain';
import { type Context, GameContextKeys } from '@aklapper/types';
import { deRefContextObject } from '@aklapper/utils';

export const rotatePlayer = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  if (context.get(GameContextKeys.NEXT) && context.getString(GameContextKeys.NEXT) === 'rotate-player') {
    const { game } = deRefContextObject(context);
    game.instance.rotatePlayers();
    return true;
  } else return false;
});

export default rotatePlayer;
