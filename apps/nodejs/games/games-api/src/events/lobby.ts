import type { SocketCallback } from '@aklapper/types';
import type { Socket } from 'socket.io';

const enterLobby: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, data => {
    console.log('NEW PLAYER EVENT', data, '\n');
    socket.broadcast.emit('new-player', data);
  });
};

export default enterLobby;
