import { CommandBuilder } from '@aklapper/chain';
import { deRefContextObject } from '@aklapper/utils';
import { Context } from '@aklapper/types-game';

export const logAction = CommandBuilder.build((context: Context) => {
  const { action } = deRefContextObject(context);
  if (action) {
    console.log(`Action: ${action}`);
    return true;
  } else return false;
});
export default logAction;
