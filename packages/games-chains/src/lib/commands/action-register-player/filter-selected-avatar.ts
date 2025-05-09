import { CommandBuilder } from '@aklapper/chain';
import { type AvatarTotem, type Context, GameContextKeys } from '@aklapper/types';
import { deRefContextObject } from '@aklapper/utils';

export const filterSelectedAvatar = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
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
