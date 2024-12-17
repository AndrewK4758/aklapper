import { CommandBuilder } from '@aklapper/chain';
import { deRefContextObject } from '@aklapper/utils';
import { Player } from '@aklapper/games-components';
import { Context, GameContextKeys } from '@aklapper/types-game';

export const wonGameCheckChutesAndLadders = CommandBuilder.build((context: Context) => {
  if (context.get(GameContextKeys.NEXT) && context.getString(GameContextKeys.NEXT) === 'won-game') {
    const { game } = deRefContextObject(context);

    const playerTakingTurn = context.get('player-taking-turn') as Player;
    if (game.instance.wonGame(playerTakingTurn.avatar.location.type)) {
      game.instance.haveWinner = true;
      return false;
    } else context.put(GameContextKeys.NEXT, 'rotate-player');
    return true;
  } else return false;
});

export default wonGameCheckChutesAndLadders;
