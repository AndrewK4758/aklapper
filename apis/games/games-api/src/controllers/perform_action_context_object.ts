import { ContextBuilder } from '@aklapper/chain';
import { activeGameDisplayChain } from '@aklapper/games-chains';
import { InstanceOfGame } from '@aklapper/game-instance';
import { Chain, GameContextKeys } from '@aklapper/types-game';
import { Request, Response } from 'express';
import { socketServer } from '../main';

const performAction = async (
  req: Request | null,
  resp: Response | null,
  gameWS: InstanceOfGame | null,
  actionWS: string | null
) => {
  console.log('Perform Action Called');
  //check for no rest-api objects
  if (!req && !resp) {
    const ctx = ContextBuilder.build();
    ctx.put(GameContextKeys.ACTION, actionWS);
    ctx.put(GameContextKeys.IO, socketServer.io);
    ctx.put(GameContextKeys.GAME, gameWS);

    activeGameDisplayChain.execute(ctx);
  } else {
    // if rest-api objects
    const game = (req as Request).activeGameInstance;

    if (game) console.log(`Got Game: ${game.gameInstanceID} - ${game.instance.instance.constructor.name}`);

    const { action } = (req as Request).params;
    const ctx = ContextBuilder.build();
    ctx.put(GameContextKeys.ACTION, action);
    ctx.put(GameContextKeys.GAME, game);
    ctx.put(GameContextKeys.REQUEST, req);
    ctx.put(GameContextKeys.RESPONSE, resp);
    ctx.put(GameContextKeys.NEXT, '');

    ((req as Request).gameSpecificChain as Chain).execute(ctx);
  }
};

export default performAction;
