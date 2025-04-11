import { CommandBuilder } from '@aklapper/chain';
import { Player } from '@aklapper/games-components';
import { type Context, GameContextKeys, TurnStatus } from '@aklapper/types';
import { deRefContextObject, getPlayerID } from '@aklapper/utils';
import { gameCommandMap, type NextCommandMap } from '../../utils/context-next-map.js';

export const verifyPlayerTakingTurn = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  if (context.get(GameContextKeys.NEXT) && context.getString(GameContextKeys.NEXT) === 'verify-player') {
    const { req, game } = deRefContextObject(context);

    const playerTakingTurn = getPlayerID(req);

    if (playerTakingTurn === game.instance.playerInTurn.id) {
      context.put('player-taking-turn', game.instance.playerInTurn as Player);

      const nextCommand = (gameCommandMap.get(req.params['id']) as NextCommandMap).get(
        context.getString(GameContextKeys.NEXT),
      ) as string;

      context.put(GameContextKeys.NEXT, nextCommand);
      return true;
    } else {
      context.put(GameContextKeys.OUTPUT, { turnStatus: TurnStatus.INVALID });
      return false;
    }
  } else return false;
});

export default verifyPlayerTakingTurn;
