import { CommandBuilder } from '@aklapper/chain';
import { type Context, GameContextKeys, TurnStatus } from '@aklapper/types';
import { deRefContextObject } from '@aklapper/utils';
import { gameCommandMap, type NextCommandMap } from '../../utils/context-next-map.js';

export const verifyReadyToPlay = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  if (context.get(GameContextKeys.NEXT) && context.getString(GameContextKeys.NEXT) === 'verify-ready-to-play') {
    const { game, req } = deRefContextObject(context);

    const readyToPlay = game.instance.verifyReadyToPlay(
      game.instance.instance.MIN_PLAYERS,
      game.instance.instance.MAX_PLAYERS,
    );

    if (readyToPlay) {
      context.put('ready-to-play', readyToPlay);

      const gameName = (context.get('req-params-id') as string) ?? (req.params['id'] as string) ?? 'Chutes-&-Ladders';

      const nextGameCommandMap = gameCommandMap.get(gameName) as NextCommandMap;

      const nextCommand = nextGameCommandMap.get(context.getString(GameContextKeys.NEXT)) as string;

      context.put(GameContextKeys.NEXT, nextCommand);

      return true;
    } else {
      context.put(GameContextKeys.OUTPUT, {
        gameStatus: TurnStatus.NOT_READY,
      });

      return false;
    }
  } else {
    return false;
  }
});

export default verifyReadyToPlay;
