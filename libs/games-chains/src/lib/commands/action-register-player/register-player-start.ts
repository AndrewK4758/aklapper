import { CommandBuilder } from '@aklapper/chain';
import { Context, GameContextKeys } from '@aklapper/types-game';

export const registerAction = CommandBuilder.build((context: Context) => {
  if (context.get(GameContextKeys.ACTION) && context.getString(GameContextKeys.ACTION) === 'register') {
    context.put(GameContextKeys.NEXT, 'create-playerID');
    return true;
  } else return false;
});

export default registerAction;
