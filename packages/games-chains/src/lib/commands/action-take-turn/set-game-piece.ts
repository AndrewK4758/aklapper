import { CommandBuilder } from '@aklapper/chain';
import { Player } from '@aklapper/games-components';
import { type Context, GameContextKeys, TurnStatus } from '@aklapper/types';
import { deRefContextObject } from '@aklapper/utils';

export const setGamePiece = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  if (context.get(GameContextKeys.NEXT) && context.getString(GameContextKeys.NEXT) === 'set-game-piece') {
    const { req, game } = deRefContextObject(context);
    const { position } = req.body;

    if (position) {
      let space = game.instance.instance.startSpace;
      let distToTraverse = Number(position);

      while (distToTraverse > 1) {
        space = space.next;
        distToTraverse--;
      }

      const playerInTurn = context.get('player-taking-turn') as Player;

      space.land(playerInTurn.avatar);
      context.put(GameContextKeys.OUTPUT, { turnStatus: TurnStatus.VALID });
      context.put(GameContextKeys.NEXT, 'won-game');
      return true;
    } else {
      context.put(GameContextKeys.OUTPUT, {
        turnStatus: TurnStatus.NULL_SELECT,
      });
      return false;
    }
  } else return false;
});

export default setGamePiece;
