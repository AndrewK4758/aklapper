import type { GameInstanceLobbyData, SocketCallback } from '@aklapper/types';
import type { Socket } from 'socket.io';
import games from '../data/games-list.js';
import { lobbySocketServer } from '../main.js';
import generateNewGame from '../services/game/handle_generate_game.js';

const createNewGame: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, async ({ gameName, playerId }: { gameName: string; playerId: string }) => {
    try {
      const selectedGame = games.find(({ name }) => name === gameName);

      if (selectedGame) {
        const newGameData: GameInstanceLobbyData | boolean = await generateNewGame(selectedGame, playerId);

        if (newGameData) {
          lobbySocketServer.emit('new-game', newGameData);
        } else throw new Error('Error adding new game to lobby');
      }
    } catch (err) {
      console.error(err);
      socket.emit((err as Error).message);
    }
  });
};

export default createNewGame;
