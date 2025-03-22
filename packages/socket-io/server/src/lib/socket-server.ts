import type { SocketCallback, SocketMiddleware } from '@aklapper/types';
import type { Server as httpServer } from 'http';
import { Server, ServerOptions } from 'socket.io';
import type ISocketServer from '../interfaces/socket-server.ts';

export class SocketServer implements ISocketServer {
  io: Server;
  constructor(httpServer: httpServer, serverOptions: Partial<ServerOptions>) {
    this.io = new Server(httpServer, serverOptions);
  }

  addServerListener = (event: string, listener: SocketCallback) => {
    this.io.on('connection', socket => {
      listener(event, socket);
    });
  };

  addMiddleware = (middleware: SocketMiddleware) => {
    this.io.use(middleware);
  };
}
