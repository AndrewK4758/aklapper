import { SocketCallback } from '@aklapper/types';
import type { Socket } from 'socket.io';
import socketPlayerMap from '../data/websocket_player_id_map.js';

const disconnectingEvent: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, playerID => {
    console.log(socketPlayerMap);
    socketPlayerMap.delete(playerID);
    console.log(socketPlayerMap);
  });
};

export default disconnectingEvent;
