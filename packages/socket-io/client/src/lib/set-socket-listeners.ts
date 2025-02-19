import type { SocketListenerTuple } from '@aklapper/types';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { Socket } from '../../../../../node_modules/.pnpm/socket.io-client@4.8.1/node_modules/socket.io-client/build/esm/socket.js';

export const setSocketListeners = (
  socket: Socket,
  listenersArr: SocketListenerTuple[],
) => {
  listenersArr.forEach((tuple) => {
    const [listener, callback] = tuple;
    socket.on(listener, callback);
  });
};

export default setSocketListeners;
