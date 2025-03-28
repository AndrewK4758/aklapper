import type { IPlayer, SocketCallback } from '@aklapper/types';
import type { Socket } from 'socket.io';
import socketIdPlayerIdMap from '../data/websocket_player_id_map.js';

const enterLobby: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, (data: Partial<IPlayer>) => {
    console.log('NEW PLAYER IN LOBBY', data, '\n');
    socketIdPlayerIdMap.set(data.Id as string, socket.id);
    socket.broadcast.emit('new-player', data);
  });
};

export default enterLobby;
