import { SocketCallback } from '@aklapper/types';
import type { Socket } from 'socket.io';
import { lobbySocketServer } from '../main.js';
import { activePubClient } from '../services/redis/redis-client.js';

const disconnectingEvent: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, async playerID => {
    activePubClient.publish('lobby:delete-player', playerID);

    lobbySocketServer.connMap.delete(playerID);
  });
};

export default disconnectingEvent;
