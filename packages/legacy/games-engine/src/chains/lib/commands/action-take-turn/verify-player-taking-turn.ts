import { CommandBuilder } from '../../../../chain/index.ts';
import { type Context, GameContextKeys, TurnStatus } from '../../../../types/index.ts';
import { deRefContextObject, getPlayerID } from '../../../../utils/index.ts';
import { gameCommandMap, type NextCommandMap } from '../../utils/context-next-map.js';

export const verifyPlayerTakingTurn = CommandBuilder.build(
  (context: Context<GameContextKeys | string>) => {
    if (
      context.get(GameContextKeys.NEXT) &&
      context.getString(GameContextKeys.NEXT) === 'verify-player'
    ) {
      const { req, game } = deRefContextObject(context);

      const playerTakingTurn = getPlayerID(req);

      if (playerTakingTurn === game.instance.playerInTurn.id) {
        context.put('player-taking-turn', game.instance.playerInTurn);

        const nextCommand = (gameCommandMap.get(req.params['id'] as string) as NextCommandMap).get(
          context.getString(GameContextKeys.NEXT),
        ) as string;

        context.put(GameContextKeys.NEXT, nextCommand);
        return true;
      } else {
        context.put(GameContextKeys.OUTPUT, { turnStatus: TurnStatus.INVALID });
        return false;
      }
    } else return false;
  },
);

export default verifyPlayerTakingTurn;
