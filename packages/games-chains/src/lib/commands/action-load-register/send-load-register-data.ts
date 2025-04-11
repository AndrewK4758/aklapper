import { CommandBuilder } from '@aklapper/chain';
import { type Context, GameContextKeys, type GameInstanceID } from '@aklapper/types';
import { deRefContextObject } from '@aklapper/utils';

export const sendLoadRegister = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  if (context.get(GameContextKeys.NEXT) && context.getString(GameContextKeys.NEXT) === 'send-load-register-data') {
    const { req, resp } = deRefContextObject(context);
    resp.setHeader('current-game', req.header('current-game') as GameInstanceID);
    return true;
  } else return false;
});
export default sendLoadRegister;
