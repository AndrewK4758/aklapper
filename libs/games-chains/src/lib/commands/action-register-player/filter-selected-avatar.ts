import { CommandBuilder } from '@aklapper/chain';
import { deRefContextObject } from '@aklapper/utils';
import { Context, AvatarTotem, GameContextKeys } from '@aklapper/types-game';

export const filterSelectedAvatar = CommandBuilder.build((context: Context) => {
  if (context.get(GameContextKeys.NEXT) && context.getString(GameContextKeys.NEXT) === 'filter-avatar') {
    const { game } = deRefContextObject(context);

    const avatarName = context.get('avatarName');
    game.instance.instance.avatarList = game.instance.instance.avatarList.filter(
      (a: AvatarTotem) => a.name !== avatarName,
    );

    context.put(GameContextKeys.NEXT, 'player-created');
    return true;
  } else return false;
});

export default filterSelectedAvatar;