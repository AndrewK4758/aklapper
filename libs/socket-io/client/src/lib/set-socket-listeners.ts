import type { SocketListenerTuple } from '@aklapper/types-api';
import type { Socket } from 'socket.io-client';

export const setSocketListeners = (socket: Socket, listenersArr: SocketListenerTuple[]) => {
  listenersArr.forEach(tuple => {
    const [listener, callback] = tuple;
    socket.on(listener, callback);
  });
};

export default setSocketListeners;
