import { SocketServer } from '@aklapper/socket-io-server';
import cors, { CorsOptions } from 'cors';
import express, { Express } from 'express';
import { createServer } from 'http';
import { join } from 'path';
import type { ServerOptions } from 'socket.io';
import handleTextDataChunks from './controllers/gen-ai-text-handler.ts';
import router, { Routes } from './routes/routes.ts';
import { cwd } from 'process';

const __dirname = join(cwd(), 'apis/vertex/vertex-api');

const app: Express = express();

export const corsOptions: CorsOptions = {
  origin: ['http://localhost:4700', 'https://andrew-k.us', 'https://www.andrew-k.us'],
  exposedHeaders: '*',
  credentials: false
};

export const httpServer = createServer(app);

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.enable('trust proxy');
app.use('/assets', express.static(join(__dirname, 'assets')));
app.use('/api/v1', router);

const serverOptions: Partial<ServerOptions> = {
  cleanupEmptyChildNamespaces: true,
  cors: corsOptions
};

export const socketServer = new SocketServer(httpServer, serverOptions, [handleTextDataChunks]);

new Routes();

const port = process.env.PORT || 5000;

const server = httpServer.listen(port, () => {
  console.log(`Listening on ${port}/api/v1`);
});

server.on('error', console.error);

export default app;
