import { CommandBuilder } from '@aklapper/chain';
import { deRefContextObject } from '@aklapper/utils';
import { Context, GameContextKeys, ILoadRegisterData } from '@aklapper/types';

export const loadRegister = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  if (context.get(GameContextKeys.ACTION) && context.getString(GameContextKeys.ACTION) === 'load-register') {
    const { game } = deRefContextObject(context);

    const avatarNameAndColorLoaderData: ILoadRegisterData = {
      avatarList: game.instance.instance.avatarList,
      avatarColorList: game.instance.instance.colorList
    };
    context.put(GameContextKeys.OUTPUT, avatarNameAndColorLoaderData);
    context.put(GameContextKeys.NEXT, 'send-load-register-data');

    return true;
  } else return false;
});
export default loadRegister;
