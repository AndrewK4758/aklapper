import { CommandBuilder } from '@aklapper/chain';
import { type Context, GameContextKeys } from '@aklapper/types';
import { deRefContextObject } from '@aklapper/utils';

export const outputContextResponse = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  const { req, resp } = deRefContextObject(context);

  if (resp) {
    const origin = req.headers.origin as string;
    resp.setHeader('Access-Control-Allow-Origin', origin ?? 'http://localhost');
    if (context.get(GameContextKeys.OUTPUT)) {
      resp.status(201).json(context.get(GameContextKeys.OUTPUT));
      return true;
    } else {
      resp.sendStatus(200);
      return true;
    }
  }
  return false;
});

export default outputContextResponse;
