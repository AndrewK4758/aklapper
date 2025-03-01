import { CommandBuilder } from '@aklapper/chain';
import { deRefContextObject } from '@aklapper/utils';
import { Context, GameContextKeys, IPlayer, IRegisterFormValues } from '@aklapper/types';

export const boardStart = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  if (
    context.get(GameContextKeys.ACTION) &&
    context.getString(GameContextKeys.ACTION) === 'board' &&
    context.get(GameContextKeys.GAME)
  ) {
    const { game } = deRefContextObject(context);

    const activePlayersArray: IRegisterFormValues[] = game.instance.playersArray.map((p: IPlayer) => {
      return {
        playerName: p.name,
        avatarName: p.avatar.name,
        avatarColor: p.avatar.color
      };
    });
    context.put('active-players-in-game', activePlayersArray);
    context.put(GameContextKeys.NEXT, 'ready-to-play-check');
    return true;
  } else return false;
});

export default boardStart;
