import { CommandBuilder } from '@aklapper/chain';
import { type Context, GameContextKeys, type ILoadRegisterData } from '@aklapper/types';
import { deRefContextObject } from '@aklapper/utils';

export const loadRegister = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  if (context.get(GameContextKeys.ACTION) && context.getString(GameContextKeys.ACTION) === 'load-register') {
    const { game } = deRefContextObject(context);

    const avatarNameAndColorLoaderData: ILoadRegisterData = {
      avatarList: game.instance.instance.avatarList,
      avatarColorList: game.instance.instance.colorList,
    };
    context.put(GameContextKeys.OUTPUT, avatarNameAndColorLoaderData);
    context.put(GameContextKeys.NEXT, 'send-load-register-data');

    return true;
  } else return false;
});
export default loadRegister;
