import type { Server as httpServer } from 'http';
import { Server, ServerOptions } from 'socket.io';
import type ISocketServer from '../interfaces/socket-server';
import { type SocketMiddleware, type SocketCallback } from '@aklapper/types-api';
export declare class SocketServer implements ISocketServer {
    io: Server;
    constructor(httpServer: httpServer, serverOptions: Partial<ServerOptions>, listeners: SocketCallback[], middleware?: SocketMiddleware[]);
    addServerListener: (event: string, listener: SocketCallback) => void;
    addMiddleware: (middleware: SocketMiddleware) => void;
}
//# sourceMappingURL=socket-server.d.ts.map