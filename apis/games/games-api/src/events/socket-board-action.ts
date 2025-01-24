import type { SocketCallback } from '@aklapper/types';
import type { InstanceOfGame } from '@aklapper/models';
import { Socket } from 'socket.io';
import performAction from '../controllers/perform_action_context_object.js';

interface SocketAction {
  action: string;
}

const socketBoardAction: SocketCallback = (socket: Socket) => {
  socket.on('action', ({ action }: SocketAction) => {
    const game: InstanceOfGame = socket.data;
    performAction(null, null, game, action);
  });
};

export default socketBoardAction;
