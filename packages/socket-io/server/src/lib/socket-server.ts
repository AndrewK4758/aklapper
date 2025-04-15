import type { PlayerID, SocketCallback, SocketID, SocketMiddleware } from '@aklapper/types';
import type { Server as httpServer } from 'http';
import { Server, type Namespace, type ServerOptions, type Socket } from 'socket.io';
import type { ISocketServer } from '../interfaces/socket-server.ts';

export class SocketServer implements ISocketServer {
  io: Server;
  connMap: Map<PlayerID, SocketID>;
  constructor(httpServer: httpServer, serverOptions: Partial<ServerOptions>, connMap: Map<PlayerID, SocketID>) {
    this.io = new Server(httpServer, serverOptions);
    this.connMap = connMap;
  }

  createNamespace(namespace: string): Namespace {
    const namespaceServer: Namespace = this.io.of(`/${namespace}`);
    return namespaceServer;
  }

  addServerListener = (namespace: string, event: string, listener: SocketCallback): void => {
    this.io.of(`/${namespace}`).on('connection', socket => {
      const playerID = socket.handshake.headers['current-player-id'] as string;
      if (playerID) this.addSocketToConnMap(playerID, socket);
      listener(event, socket);
    });
  };

  addMiddleware = (namespace: string, middleware: SocketMiddleware): void => {
    this.io.of(`/${namespace}`).use(middleware);
  };

  addSocketToConnMap(id: string, socket: Socket): void {
    this.connMap.set(id, socket.id);
  }
}
