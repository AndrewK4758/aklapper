import type { PlayerID, SocketID } from '@aklapper/types';
import { Server } from 'socket.io';

export interface ISocketServer {
  io: Server;
  connMap: Map<PlayerID, SocketID>;
}

export default ISocketServer;
