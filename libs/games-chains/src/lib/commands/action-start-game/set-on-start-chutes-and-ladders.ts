import { CommandBuilder } from '@aklapper/chain';
import { deRefContextObject } from '@aklapper/utils';
import { Context, GameContextKeys, IPlayer } from '@aklapper/types-game';

export const setAvatarOnStartChutesAndLadders = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  if (context.get(GameContextKeys.NEXT) && context.getString(GameContextKeys.NEXT) === 'set-avatars-on-start') {
    if (context.get('ready-to-play')) {
      const { game } = deRefContextObject(context);

      game.instance.playersArray.forEach((p: IPlayer, i: number) => {
        p.order = i + 1;
        game.instance.instance.startSpace.land(p.avatar);
      });

      context.put(GameContextKeys.NEXT, 'set-player-in-turn');
      return true;
    } else return false;
  }
  return true;
});

export default setAvatarOnStartChutesAndLadders;
