import type { IPlayer, SocketCallback } from '@aklapper/types';
import type { Socket } from 'socket.io';

const enterLobby: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, (data: Partial<IPlayer>) => {
    socket.broadcast.emit('new-player', data);
  });
};

export default enterLobby;
