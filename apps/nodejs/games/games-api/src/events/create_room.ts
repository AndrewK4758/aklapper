import type { GameInstanceID, SocketCallback } from '@aklapper/types';
import type { Socket } from 'socket.io';

const createRoom: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, (gameInstanceID: GameInstanceID) => {
    socket.join(gameInstanceID);
  });
};

export default createRoom;
