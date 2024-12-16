import { CommandBuilder } from '@aklapper/chain';
import { Player } from '@aklapper/games-components';
import { Context, GameContextKeys, TurnStatus } from '@aklapper/types-game';

export const moveAvatar = CommandBuilder.build((context: Context) => {
  if (context.get(GameContextKeys.NEXT) && context.getString(GameContextKeys.NEXT) === 'move-avatar') {
    const playerTakingTurn = context.get('player-taking-turn') as Player;

    const moveDist = context.get('move-dist') as number;
    playerTakingTurn.avatar.move(moveDist);

    context.put('player-taking-turn', playerTakingTurn);
    context.put(GameContextKeys.NEXT, 'won-game');
    context.put(GameContextKeys.OUTPUT, { turnStatus: TurnStatus.VALID });
    return true;
  } else return false;
});

export default moveAvatar;
