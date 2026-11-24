import { CommandBuilder } from '../../../../chain/index.ts';
import { type Context, GameContextKeys } from '../../../../types/index.ts';
import { deRefContextObject } from '../../../../utils/index.ts';

export const rotatePlayer = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  if (
    context.get(GameContextKeys.NEXT) &&
    context.getString(GameContextKeys.NEXT) === 'rotate-player'
  ) {
    const { game } = deRefContextObject(context);
    game.instance.rotatePlayers();
    return true;
  } else return false;
});

export default rotatePlayer;
