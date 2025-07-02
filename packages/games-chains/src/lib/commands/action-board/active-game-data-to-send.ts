import { CommandBuilder } from '@aklapper/chain';
import {
  type Context,
  GameContextKeys,
  type GameInstanceID,
  type ILiteSpace,
  type IPlayersAndBoard,
  type IRegisterFormValues,
} from '@aklapper/types';
import { deRefContextObject } from '@aklapper/utils';

export const activeDataToSend = CommandBuilder.build((context: Context<GameContextKeys | string>) => {
  if (context.get(GameContextKeys.NEXT) && context.getString(GameContextKeys.NEXT) === 'active-data-to-send') {
    const { req, resp, game, io } = deRefContextObject(context);

    const activeDataToSend: IPlayersAndBoard = {
      avatarInTurn: context.get('player-in-turn') as string,
      gameBoard: game.instance.instance.displayGameBoard() as ILiteSpace[],
      activePlayersInGame: context.get('active-players-in-game') as IRegisterFormValues[],
      winner: context.get('winner-message') as string,
    };

    if (!req && !resp) {
      io.to(game.gameInstanceID).emit('game-data', activeDataToSend);
      return false;
    } else {
      resp.setHeader('current-game', req.header('current-game') as GameInstanceID);
      context.put(GameContextKeys.OUTPUT, activeDataToSend);
      return true;
    }
  } else return false;
});

export default activeDataToSend;
