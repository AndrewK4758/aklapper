import { ContextBuilder } from '@aklapper/chain';
import { activeGameDisplayChain } from '@aklapper/games-chains';
import { InstanceOfGame } from '@aklapper/models';
import { GameContextKeys } from '@aklapper/types';
import { Request, Response } from 'express';
import { gameSocketServer } from '../main.js';

const performAction = async (
  req: Request | null,
  resp: Response | null,
  gameWS: InstanceOfGame | null,
  actionWS: string | null
) => {
  console.log('Perform Action Called');
  //check for no rest-api objects
  if (!req && !resp) {
    if (actionWS && gameWS) {
      const ctx = ContextBuilder.build();
      ctx.put(GameContextKeys.ACTION, actionWS);
      ctx.put(GameContextKeys.IO, gameSocketServer.io);
      ctx.put(GameContextKeys.GAME, gameWS);

      activeGameDisplayChain.execute(ctx);
    }
  } else {
    // if rest-api objects
    const game = (req as Request).activeGameInstance;

    if (game && req && resp) {
      console.log(`Got Game: ${game.gameInstanceID} - ${game.instance.instance.constructor.name}`);

      const { action } = (req as Request).params;
      const ctx = ContextBuilder.build();
      ctx.put(GameContextKeys.ACTION, action);
      ctx.put(GameContextKeys.GAME, game);
      ctx.put(GameContextKeys.REQUEST, req);
      ctx.put(GameContextKeys.RESPONSE, resp);
      ctx.put(GameContextKeys.NEXT, '');

      if (req.gameSpecificChain) req.gameSpecificChain.execute(ctx);
      else resp.status(500).send('Game not built correctly. No action execution chain found');
    }
  }
};

export default performAction;
