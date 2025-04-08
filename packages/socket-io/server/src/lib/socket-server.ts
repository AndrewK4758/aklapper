import type { PlayerID, SocketCallback, SocketID, SocketMiddleware } from '@aklapper/types';
import type { Server as httpServer } from 'http';
import { Server, ServerOptions, type Socket } from 'socket.io';
import type ISocketServer from '../interfaces/socket-server.ts';

export class SocketServer implements ISocketServer {
  io: Server;
  connMap: Map<PlayerID, SocketID>;
  constructor(
    httpServer: httpServer,
    serverOptions: Partial<ServerOptions>,
    connMap: Map<PlayerID, SocketID> = new Map(),
  ) {
    this.io = new Server(httpServer, serverOptions);
    this.connMap = connMap;
  }

  addServerListener = (event: string, listener: SocketCallback) => {
    this.io.on('connection', socket => {
      const playerID = socket.handshake.headers['current-player-id'] as string;
      if (playerID) this.addSocketToConnMap(playerID, socket);
      listener(event, socket);
    });
  };

  addMiddleware = (middleware: SocketMiddleware) => {
    this.io.use(middleware);
  };

  addSocketToConnMap(id: string, socket: Socket) {
    this.connMap.set(id, socket.id);
  }
}
