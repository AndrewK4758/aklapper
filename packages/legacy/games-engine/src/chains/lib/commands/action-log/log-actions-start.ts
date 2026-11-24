import { CommandBuilder } from '../../../../chain/index.ts';
import { type Context, type GameContextKeys } from '../../../../types/index.ts';
import { deRefContextObject } from '../../../../utils/index.ts';

export const logAction = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  const { action } = deRefContextObject(context);
  if (action) {
    console.log(`Action: ${action}`);
    return true;
  } else return false;
});
export default logAction;
