import { CommandBuilder } from '@aklapper/chain';
import { type Context, type GameContextKeys } from '@aklapper/types';
import { deRefContextObject } from '@aklapper/utils';

export const logAction = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  const { action } = deRefContextObject(context);
  if (action) {
    console.log(`Action: ${action}`);
    return true;
  } else return false;
});
export default logAction;
