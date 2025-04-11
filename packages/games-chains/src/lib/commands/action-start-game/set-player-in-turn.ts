import { CommandBuilder } from '@aklapper/chain';
import { type Context, GameContextKeys } from '@aklapper/types';
import { deRefContextObject } from '@aklapper/utils';

export const setPlayerInTurn = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  if (context.get(GameContextKeys.NEXT) && context.getString(GameContextKeys.NEXT) === 'set-player-in-turn') {
    const { game } = deRefContextObject(context);

    game.instance.playerInTurn = game.instance.playersArray[0];
    context.put(GameContextKeys.NEXT, 'send-start-game-status');

    return true;
  } else return false;
});

export default setPlayerInTurn;
