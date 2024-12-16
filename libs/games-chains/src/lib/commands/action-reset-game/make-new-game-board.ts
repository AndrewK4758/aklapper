import { CommandBuilder } from '@aklapper/chain';
import { deRefContextObject } from '@aklapper/utils';
import { Context, GameContextKeys, ISpace } from '@aklapper/types-game';

export const makeNewGameBoard = CommandBuilder.build((context: Context) => {
  if (context.get(GameContextKeys.NEXT) && context.getString(GameContextKeys.NEXT) === 'make-game-board') {
    const { game } = deRefContextObject(context);

    let space: ISpace = game.instance.instance.startSpace;

    while (space) {
      if (space.occupied) space.leave();
      space = space.next;
    }

    game.instance.instance.makeGameBoard();
    context.put(GameContextKeys.ACTION, 'start');

    return true;
  } else return false;
});

export default makeNewGameBoard;
