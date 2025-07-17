import type { GameInstanceID, SocketCallback } from '@aklapper/types';
import { Socket } from 'socket.io';
import performAction from '../controllers/perform_action_context_object.js';
import { allGamesMap } from '../middleware/all-games-map.js';

interface SocketAction {
  action: string;
  gameID: GameInstanceID;
}

const socketBoardAction: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, ({ action, gameID }: SocketAction) => {
    const game = allGamesMap.getGame(gameID);
    if (game) performAction(null, null, game, action);
    else socket.emit('No game found. Please register new game to continue');
  });
};

export default socketBoardAction;
