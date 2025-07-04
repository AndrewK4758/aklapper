import { SocketServer } from '@aklapper/socket-io-server';
import cors, { type CorsOptions } from 'cors';
import { configDotenv } from 'dotenv';
import express, { type Express } from 'express';
import { createServer } from 'http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { join } from 'path';
import type { ServerOptions } from 'socket.io';
import handleTextDataChunks from './controllers/gen-ai-text-handler.js';
import router, { Routes } from './routes/routes.js';

const __filename = fileURLToPath(import.meta.url);

const __dirname = dirname(__filename);

configDotenv({ path: resolve(__dirname, '/env/.env') });

const app: Express = express();

export const corsOptions: CorsOptions = {
  origin: [
    'http://localhost:4700',
    'http://localhost:4800',
    'https://andrew-k.us',
    'https://www.andrew-k.us',
    'http://localhost',
    'https://games-424800.uc.r.appspot.com',
  ],
  exposedHeaders: '*',
  credentials: false,
};

export const httpServer = createServer(app);

app.options(/.*/, cors(corsOptions));
app.use(cors(corsOptions));
app.enable('trust proxy');
app.use('/assets', express.static(join(__dirname, 'assets')));
app.use('/api/v1', router);

const serverOptions: Partial<ServerOptions> = {
  cleanupEmptyChildNamespaces: true,
  cors: corsOptions,
};

export const socketServer = new SocketServer(httpServer, serverOptions, new Map());
socketServer.addServerListener('', 'prompt', handleTextDataChunks);

new Routes();

const port = process.env.PORT || 5000;

const server = httpServer.listen(port, () => {
  console.log(`Listening on ${port}/api/v1`);
});

server.on('error', console.error);

export default app;
