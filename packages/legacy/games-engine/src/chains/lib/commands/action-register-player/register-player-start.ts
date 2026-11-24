import { CommandBuilder } from '../../../../chain/index.ts';
import { type Context, GameContextKeys } from '../../../../types/index.ts';

export const registerPlayerStart = CommandBuilder.build(
  (context: Context<GameContextKeys | string>) => {
    if (
      context.get(GameContextKeys.ACTION) &&
      context.getString(GameContextKeys.ACTION) === 'register'
    ) {
      context.put(GameContextKeys.NEXT, 'create-playerID');
      return true;
    } else return false;
  },
);

export default registerPlayerStart;
