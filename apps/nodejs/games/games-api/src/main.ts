import { SocketServer } from '@aklapper/socket-io-server';
import type { PlayerID, SocketID } from '@aklapper/types';
import cors, { type CorsOptions } from 'cors';
import { configDotenv } from 'dotenv';
import express, { type Express } from 'express';
import { createServer } from 'http';
import { join } from 'path';
import { cwd } from 'process';
import type { ServerOptions } from 'socket.io';
import createNewGame from './events/create_new_game.js';
import disconnectingEvent from './events/disconnect_event.js';
import enterLobby from './events/enter-lobby.js';
import privateMessagePlayer from './events/private_message.js';
import socketBoardAction from './events/socket-board-action.js';
import addGameToSocketInstance from './middleware/socket-add-game-middleware.js';
import routerV1 from './routes/v1/routes.js';
import routerV2 from './routes/v2/routes.js';
import './services/redis/redis-client.js';

const __dirname = join(cwd(), 'apps/nodejs/games/games-api');

configDotenv({ path: join(__dirname, '.env') });

const app: Express = express();

export const corsOptions: CorsOptions = {
  origin: [
    'https://andrew-k.us',
    'https://www.andrew-k.us',
    'http://localhost:4700',
    'http://localhost:3200',
    'ws://localhost:3200',
    'http://localhost',
    'https://games-424800.uc.r.appspot.com',
    'http://localhost:6900',
  ],
  methods: '*',
  exposedHeaders: '*',
  optionsSuccessStatus: 204,
  allowedHeaders: '*',
  credentials: false,
};

const gameServerOptions: Partial<ServerOptions> = {
  cleanupEmptyChildNamespaces: true,
  cors: corsOptions,
};

const lobbyServerOptions: Partial<ServerOptions> = {
  ...gameServerOptions,
  path: '/lobby',
};

const httpServer = createServer(app);

export const gameSocketServer = new SocketServer(httpServer, gameServerOptions);

gameSocketServer.addMiddleware(addGameToSocketInstance);
gameSocketServer.addServerListener('action', socketBoardAction);

export const lobbySocketServer = new SocketServer(httpServer, lobbyServerOptions, new Map<PlayerID, SocketID>());

lobbySocketServer.addServerListener('enter-lobby', enterLobby);
lobbySocketServer.addServerListener('private-message-player', privateMessagePlayer);
lobbySocketServer.addServerListener('remove-player', disconnectingEvent);
lobbySocketServer.addServerListener('create-new-game', createNewGame);

app.options(/.*/, cors(corsOptions));
app.use(cors(corsOptions));
app.enable('trust proxy');

app.use('/assets', express.static(join(__dirname, 'assets')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1', routerV1);
app.use('/api/v2', routerV2);

const port = parseInt(process.env.PORT as string) || 3000;
const host = process.env.HOST || 'localhost';

const server = httpServer.listen(port, () => {
  console.log(`Listening on http://${host}:${port}/api/{version}`);
});

server.on('error', console.error);

export default app;
