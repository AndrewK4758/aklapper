import type { InstanceOfGame } from '@aklapper/models';
import type { SocketCallback } from '@aklapper/types';
import { Socket } from 'socket.io';
import performAction from '../controllers/perform_action_context_object.js';

interface SocketAction {
  action: string;
}

const socketBoardAction: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, ({ action }: SocketAction) => {
    const game: InstanceOfGame = socket.data;
    performAction(null, null, game, action);
  });
};

export default socketBoardAction;
