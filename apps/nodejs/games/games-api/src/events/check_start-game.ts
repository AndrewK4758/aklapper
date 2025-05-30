import type { SocketCallback } from '@aklapper/types';
import type { Socket } from 'socket.io';
import gamesInLobby from 'src/data/games_in_lobby/games_in_lobby.js';
// import Go_WsEventManager from 'src/models/go_websocket_manager.js';

const checkStartGame: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, async (gameId: string) => {
    try {
      const gameToCheckReadyState = gamesInLobby.getGameActiveGame(gameId);

      console.log(gameToCheckReadyState.instance.playersArray);
      const readyToPlay = gameToCheckReadyState.instance.verifyReadyToPlay(
        gameToCheckReadyState.instance.instance.MIN_PLAYERS,
        gameToCheckReadyState.instance.instance.MAX_PLAYERS,
      );
      console.log(readyToPlay);
    } catch (error) {
      console.error(error);
      socket.emit('no-game');
    }
  });
};

export default checkStartGame;
