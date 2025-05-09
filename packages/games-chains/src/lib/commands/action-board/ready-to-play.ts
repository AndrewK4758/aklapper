import { CommandBuilder } from '@aklapper/chain';
import { type Context, GameContextKeys } from '@aklapper/types';
import { deRefContextObject } from '@aklapper/utils';

export const readyToPlayCheck = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  if (context.get(GameContextKeys.NEXT) && context.getString(GameContextKeys.NEXT) === 'ready-to-play-check') {
    const { game } = deRefContextObject(context);
    const playerInTurn =
      game.instance.readyToPlay === true ? game.instance.playerInTurn.avatar.name : 'Waiting for game to start';
    context.put('player-in-turn', playerInTurn);
    context.put(GameContextKeys.NEXT, 'check-if-winner');
    return true;
  } else return false;
});
export default readyToPlayCheck;
