import type { IBuiltGame, NewGameDetails, SocketCallback } from '@aklapper/types';
import type { Socket } from 'socket.io';
import games from '../data/games-list.js';
import { lobbySocketServer } from '../main.js';
import generateNewGame from '../services/game/handle_generate_game.js';

const createNewGame: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, async ({ gameName, playerId }: { gameName: string; playerId: string }) => {
    const selectedGame = games.find(({ name }) => name === gameName) as IBuiltGame;

    const newGameWithPendingLobby: NewGameDetails = await generateNewGame(selectedGame, playerId);

    lobbySocketServer.emit('new-game', newGameWithPendingLobby);
  });
};

export default createNewGame;
