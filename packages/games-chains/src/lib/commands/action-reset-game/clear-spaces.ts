import { CommandBuilder } from '@aklapper/chain';
import { type Context, GameContextKeys, type ISpace } from '@aklapper/types';
import { deRefContextObject } from '@aklapper/utils';

export const clearAvatarsFromSpaces = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  if (context.get(GameContextKeys.NEXT) && context.getString(GameContextKeys.NEXT) === 'clear-spaces') {
    const { game } = deRefContextObject(context);

    let space: ISpace = game.instance.instance.startSpace;

    while (space) {
      if (space.occupied) space.leave();
      space = space.next;
    }

    context.put(GameContextKeys.NEXT, 'make-game-board');

    return true;
  } else return false;
});

export default clearAvatarsFromSpaces;
