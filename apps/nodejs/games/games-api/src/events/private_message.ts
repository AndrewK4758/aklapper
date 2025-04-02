import type { PrivateMessageDetails, SocketCallback } from '@aklapper/types';
import type { Socket } from 'socket.io';
import { lobbySocketServer } from '../main.js';

const privateMessagePlayer: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, async (messageDetails: PrivateMessageDetails) => {
    console.log(`Message from ${messageDetails.sender.senderName} to ${messageDetails.target.targetName}`);
    const targetSocketId = lobbySocketServer.connMap.get(messageDetails.target.targetId);
    if (targetSocketId) {
      socket.to(targetSocketId).emit('privateMessage', messageDetails);
    } else {
      messageDetails.message = `Error sending message to ${messageDetails.target.targetName}`;
      socket.emit('privateMessage', messageDetails);
    }
  });
};

export default privateMessagePlayer;
