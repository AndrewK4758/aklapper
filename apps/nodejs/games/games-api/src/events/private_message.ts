import type { SocketCallback } from '@aklapper/types';
import type { Socket } from 'socket.io';
import socketPlayerMap from '../data/websocket_player_id_map.js';

type PrivateMessageDetails = {
  target: {
    targetId: string;
    targetName: string;
  };
  message: string;
  sender: {
    senderName: string;
    senderId: string;
  };
};

const privateMessagePlayer: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, async (messageDetails: PrivateMessageDetails) => {
    console.log(
      `Received private message from player ${messageDetails.sender.senderName} : ${messageDetails.sender.senderId}`
    );
    const x = socketPlayerMap.get(messageDetails.target.targetId) as string;

    console.log(x);
    socket
      .to(x)
      .emit(
        'privateMessage',
        `Sent private message to ${messageDetails.target.targetName} from ${messageDetails.sender.senderName}`
      );
  });
};

export default privateMessagePlayer;
