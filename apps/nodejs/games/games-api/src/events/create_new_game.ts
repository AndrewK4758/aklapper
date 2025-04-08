import { SocketCallback, type IBuiltGame, type NewGameDetails } from '@aklapper/types';
import type { Socket } from 'socket.io';
import games from '../data/games-list.js';
import { lobbySocketServer } from '../main.js';
import handleNewGameCall from '../services/game/handle_generate_game.js';

const createNewGame: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, (gameName: string) => {
    const selectedGame = games.find(({ name }) => name === gameName) as IBuiltGame;

    const newGameAndLobby = handleNewGameCall(selectedGame);

    const dataToSend: NewGameDetails = {
      gameName: selectedGame.name,
      gamesInLobby: newGameAndLobby.gamesInLobby,
      gameId: newGameAndLobby.gameInstanceId,
    };

    lobbySocketServer.io.emit('new-game', dataToSend);
  });
};

export default createNewGame;
