import { CommandBuilder } from '@aklapper/chain';
import { type Context, GameContextKeys } from '@aklapper/types';
import { deRefContextObject } from '@aklapper/utils';
import ShortUniqueId from 'short-unique-id';

export const createPlayerID = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  if (context.get(GameContextKeys.NEXT) && context.getString(GameContextKeys.NEXT) === 'create-playerID') {
    const { req } = deRefContextObject(context);
    if (req.playerID) {
      context.put(GameContextKeys.NEXT, 'register-on-game');
      return true;
    } else {
      const playerID = new ShortUniqueId().rnd();
      context.put('playerID', playerID as string);
      context.put(GameContextKeys.NEXT, 'register-on-game');
      return true;
    }
  } else return false;
});

export default createPlayerID;
