import type { SocketMiddleware, SocketMiddlewareNext } from '@aklapper/types';
import { GameInstanceID, GamePlayerValidation } from '@aklapper/types';
import { Socket } from 'socket.io';
import { allGamesMap } from './all-games-map.js';

const addGameToSocketInstance: SocketMiddleware = (
  socket: Socket,
  next: SocketMiddlewareNext,
) => {
  if (socket.handshake.headers['current-game']) {
    const gameID = (
      JSON.parse(
        socket.handshake.headers['current-game'] as string,
      ) as GamePlayerValidation
    ).gameInstanceID as GameInstanceID;

    const game = allGamesMap.AllGames.get(gameID);

    socket.data = game;
    socket.join(gameID);
    next();
  } else
    socket.emit('no-game-error', {
      errorMessage: 'No Game Found. Please Register a New Game To Play',
    });
};

export default addGameToSocketInstance;
