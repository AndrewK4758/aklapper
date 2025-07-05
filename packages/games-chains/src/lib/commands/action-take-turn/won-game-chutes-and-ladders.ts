import { CommandBuilder } from '@aklapper/chain';
import { type Context, GameContextKeys, IPlayer, type ISpace } from '@aklapper/types';
import { deRefContextObject } from '@aklapper/utils';

export const wonGameCheckChutesAndLadders = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  if (context.get(GameContextKeys.NEXT) && context.getString(GameContextKeys.NEXT) === 'won-game') {
    const { game } = deRefContextObject(context);

    const playerTakingTurn = context.get('player-taking-turn') as IPlayer;
    if (game.instance.wonGame((playerTakingTurn.avatar.location as ISpace).type)) {
      game.instance.haveWinner = true;
      return false;
    } else context.put(GameContextKeys.NEXT, 'rotate-player');
    return true;
  } else return false;
});

export default wonGameCheckChutesAndLadders;
