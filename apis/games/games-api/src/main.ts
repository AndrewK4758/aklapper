import { SocketServer } from '@aklapper/socket-io-server';
import cors, { CorsOptions } from 'cors';
import express, { Express } from 'express';
import { createServer } from 'http';
import { join } from 'path';
import { ServerOptions } from 'socket.io';
import socketBoardAction from './events/socket-board-action';
import addGameToSocketInstance from './middleware/socket-add-game-middleware';
import router, { GameRoutes } from './routes/routes';

/**
 * Add cleanup service to take games in users active_game col and compare last active to current minute and if
 * greater than some timeframe, remove the game from active_game array
 */

const app: Express = express();

export const corsOptions: CorsOptions = {
  origin: [
    'https://andrew-k.us',
    'https://www.andrew-k.us',
    'http://localhost:4700',
    'ws://localhost:4700',
    'http://localhost:3200',
    'ws://localhost:3200'
  ],
  methods: '*',
  exposedHeaders: '*',
  optionsSuccessStatus: 204,
  allowedHeaders: '*',
  credentials: false
};

const serverOptions: Partial<ServerOptions> = {
  cleanupEmptyChildNamespaces: true,
  cors: corsOptions
};

const httpServer = createServer(app);

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.enable('trust proxy');
app.use('/assets', express.static(join(__dirname, 'assets')));
app.use('/api/v1', router);

export const socketServer = new SocketServer(httpServer, serverOptions, [socketBoardAction], [addGameToSocketInstance]);

new GameRoutes();

const port = parseInt(process.env.PORT as string) || 3000;
const host = process.env.HOST || 'localhost';

const server = httpServer.listen(port, () => {
  console.log(`Listening on http://${host}:${port}/api/v1`);
});

server.on('error', console.error);

export default app;
