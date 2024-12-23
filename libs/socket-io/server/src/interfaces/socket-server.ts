import { Server } from 'socket.io';

export interface ISocketServer {
  io: Server;
}

export default ISocketServer;
