import { CommandBuilder } from '@aklapper/chain';
import { deRefContextObject } from '@aklapper/utils';
import { Context, GameContextKeys } from '@aklapper/types-game';

export const checkIfWinner = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  if (context.get(GameContextKeys.NEXT) && context.getString(GameContextKeys.NEXT) === 'check-if-winner') {
    const { game } = deRefContextObject(context);

    const winner = game.instance.haveWinner;

    if (winner) {
      const winnerMessage = `CONGRATULATIONS ${game.instance.playerInTurn.name}... YOU WON!!!!`;
      context.put('winner-message', winnerMessage);
    } else {
      context.put('winner-message', '');
    }
    context.put(GameContextKeys.NEXT, 'active-data-to-send');
    return true;
  } else return false;
});
export default checkIfWinner;
