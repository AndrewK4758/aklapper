import { CommandBuilder } from '@aklapper/chain';
import { deRefContextObject, getCurrentMinute } from '@aklapper/utils';
import { Context, GameContextKeys, TurnStatus } from '@aklapper/types';

export const takeTurnStart = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  if (context.get(GameContextKeys.ACTION) && context.getString(GameContextKeys.ACTION) === 'take-turn') {
    const { game, req, resp } = deRefContextObject(context);

    if (!game.instance.readyToPlay) {
      context.put(GameContextKeys.OUTPUT, {
        turnStatus: TurnStatus.NOT_READY
      });
      resp.setHeader('current-game', req.header('current-game') as string);
      return false;
    }
    if (game.instance.readyToPlay && game.instance.haveWinner) {
      context.put(GameContextKeys.OUTPUT, {
        turnStatus: TurnStatus.GAME_WON
      });
      resp.setHeader('current-game', req.header('current-game') as string);
      return false;
    }
    game.updateLastActive(getCurrentMinute());
    context.put(GameContextKeys.NEXT, 'verify-player');
    return true;
  } else return false;
});

export default takeTurnStart;
