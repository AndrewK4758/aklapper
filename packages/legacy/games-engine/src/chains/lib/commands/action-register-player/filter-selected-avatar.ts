import { CommandBuilder } from '../../../../chain/index.ts';
import { type AvatarTotem, type Context, GameContextKeys } from '../../../../types/index.ts';
import { deRefContextObject } from '../../../../utils/index.ts';

export const filterSelectedAvatar = CommandBuilder.build(
  (context: Context<GameContextKeys | string>) => {
    if (
      context.get(GameContextKeys.NEXT) &&
      context.getString(GameContextKeys.NEXT) === 'filter-avatar'
    ) {
      const { game } = deRefContextObject(context);

      const avatarName = context.get('avatarName');
      game.instance.instance.avatarList = game.instance.instance.avatarList.filter(
        (a: AvatarTotem) => a.name !== avatarName,
      );
      console.log(game.instance.instance.avatarList);
      context.put(GameContextKeys.NEXT, 'player-created');
      return true;
    } else return false;
  },
);

export default filterSelectedAvatar;
