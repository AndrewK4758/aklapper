import { CommandBuilder } from '@aklapper/chain';
import { type Context, GameContextKeys } from '@aklapper/types';

export const registerAction = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  if (context.get(GameContextKeys.ACTION) && context.getString(GameContextKeys.ACTION) === 'register') {
    context.put(GameContextKeys.NEXT, 'create-playerID');
    return true;
  } else return false;
});

export default registerAction;
