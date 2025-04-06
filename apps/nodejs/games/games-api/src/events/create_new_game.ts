import { SocketCallback, type IBuiltGame, type NewGameDetails } from '@aklapper/types';
import type { Socket } from 'socket.io';
import games from '../data/games-list.js';
import { lobbySocketServer } from '../main.js';
import handleNewGameCall from '../services/game/handle_generate_game.js';

const createNewGame: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, ({ gameName, playerId }: { gameName: string; playerId: string }) => {
    const selectedGame = games.find(({ name }) => name === gameName) as IBuiltGame;

    const newGameDetails = handleNewGameCall(selectedGame, playerId);

    const dataToSend: NewGameDetails = {
      gameName: selectedGame.name,
      gameInstanceId: newGameDetails.gameInstanceID as string,
    };

    lobbySocketServer.io.emit('new-game', dataToSend);
  });
};

export default createNewGame;
