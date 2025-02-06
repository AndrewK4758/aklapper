// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  Socket,
  ManagerOptions,
} from '../../../../../node_modules/.pnpm/socket.io-client@4.8.1/node_modules/socket.io-client/build/esm/index.js';
import { io } from 'socket.io-client';
import type IClientSocket from '../interfaces/client-socket.ts';

export class ClientSocket implements IClientSocket {
  clientIo: Socket;
  constructor(url: string, managerOptions: Partial<ManagerOptions>) {
    this.clientIo = io(url, managerOptions);
  }
}
