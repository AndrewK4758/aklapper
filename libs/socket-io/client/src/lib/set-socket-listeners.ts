import type { SocketListenerTuple } from '@aklapper/types-api';
import type { Socket } from 'node_modules/.pnpm/socket.io-client@4.8.1/node_modules/socket.io-client/build/esm/socket.d.ts';

export const setSocketListeners = (socket: Socket, listenersArr: SocketListenerTuple[]) => {
  listenersArr.forEach(tuple => {
    const [listener, callback] = tuple;
    socket.on(listener, callback);
  });
};

export default setSocketListeners;
