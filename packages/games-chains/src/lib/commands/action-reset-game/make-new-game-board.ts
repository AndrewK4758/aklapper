import { CommandBuilder } from '@aklapper/chain';
import { type Context, GameContextKeys, type ISpace } from '@aklapper/types';
import { deRefContextObject } from '@aklapper/utils';

export const makeNewGameBoard = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
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
