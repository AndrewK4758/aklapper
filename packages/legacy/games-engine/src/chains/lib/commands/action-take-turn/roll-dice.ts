import { CommandBuilder } from '../../../../chain/index.ts';
import { GameContextKeys, type Context } from '../../../../types/index.ts';
import { deRefContextObject } from '../../../../utils/index.ts';

export const rollDice = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  if (
    context.get(GameContextKeys.NEXT) &&
    context.getString(GameContextKeys.NEXT) === 'roll-dice'
  ) {
    const { game } = deRefContextObject(context);

    const moveDist = game.instance.instance.DIE.roll();
    context.put('move-dist', moveDist);
    context.put(GameContextKeys.NEXT, 'move-avatar');
    return true;
  } else return false;
});

export default rollDice;
