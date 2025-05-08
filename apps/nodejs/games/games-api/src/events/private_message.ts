import type { PrivateMessageDetails, SocketCallback } from '@aklapper/types';
import type { Socket } from 'socket.io';
import { socketConnectionMap } from '../main.js';

const privateMessagePlayer: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, async (messageDetails: PrivateMessageDetails) => {
    const targetSocketId = socketConnectionMap.get(messageDetails.target.targetId);
    if (targetSocketId) {
      socket.to(targetSocketId).emit('private-message', messageDetails);
    } else {
      messageDetails.message = `Error sending message to ${messageDetails.target.targetName}`;
      socket.emit('privateMessage', messageDetails);
    }
  });
};

export default privateMessagePlayer;
