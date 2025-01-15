import { io, ManagerOptions, Socket } from 'socket.io-client';
import type IClientSocket from '../interfaces/client-socket.ts';

export class ClientSocket implements IClientSocket {
  clientIo: Socket;
  constructor(url: string, managerOptions: Partial<ManagerOptions>) {
    this.clientIo = io(url, managerOptions);
  }
}
