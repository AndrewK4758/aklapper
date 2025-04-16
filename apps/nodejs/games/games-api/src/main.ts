import { SocketServer } from '@aklapper/socket-io-server';
import type { PlayerID, SocketID } from '@aklapper/types';
import cors, { type CorsOptions } from 'cors';
import { configDotenv } from 'dotenv';
import express, { type Express } from 'express';
import { createServer } from 'node:http';
import { join } from 'path';
import { cwd } from 'process';
import type { ServerOptions } from 'socket.io';
import Websocket from 'ws';
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

configDotenv({ path: join(__dirname, 'env/.env') });

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

const socketServer = new SocketServer(httpServer, lobbyServerOptions, new Map<PlayerID, SocketID>());

export const lobbySocketServer = socketServer.createNamespace('lobby');
export const gameplaySocketServer = socketServer.createNamespace('gameplay');

export const socketConnectionMap = socketServer.connMap;
// export const gameSocketServer = new SocketServer(httpServer, gameServerOptions);
// export const lobbySocketServer = new SocketServer(httpServer, lobbyServerOptions, new Map<PlayerID, SocketID>());

socketServer.addMiddleware('gameplay', addGameToSocketInstance);
socketServer.addServerListener('gameplay', 'action', socketBoardAction);

socketServer.addServerListener('lobby', 'enter-lobby', enterLobby);
socketServer.addServerListener('lobby', 'private-message-player', privateMessagePlayer);
socketServer.addServerListener('lobby', 'remove-player', disconnectingEvent);
socketServer.addServerListener('lobby', 'create-new-game', createNewGame);
/**
 *  WHEN DECLARING GOLANG STRUCTS FOR LOBBY DATA !!! MAKE SURE YOU ADD THE 'json:"key"'
 *  FIELD WITH LOWER CASE KEY IN ORDER TO MATCH THE GOLANG KEY STRINGS TO TS/JS KEY STRINGS
 *  CREATED WITH camelCase !!!
 */
export type WsEvent = {
  event: string;
  data: string | object | Array<unknown>;
};

const socketClient = new Websocket('ws://localhost:6900/ws/lobby');

socketClient.on('error', console.error);

socketClient.on('open', () => {
  const connectionData: WsEvent = { event: 'custom-event', data: 'Hello from NodeJS' };
  socketClient.send(JSON.stringify(connectionData), err => {
    if (err) console.error(err);
  });
});

socketClient.onopen = () => {
  const connectionData2: WsEvent = { event: 'event2', data: 'event2 data' };
  socketClient.send(JSON.stringify(connectionData2), err => console.error(err));
};

socketClient.onmessage = event => {
  const messageStringData = event.data.toString();
  const parsedMessageData: WsEvent = JSON.parse(messageStringData);

  switch (parsedMessageData.event) {
    case 'custom-event':
      console.log(`Event Type: ${event.type}`);
      console.log(`Event Type: ${parsedMessageData.event}`);
      // console.log(`Event Target: ${(JSON.stringify(event.target), null, 2)}`);
      console.log(`Event Data: ${parsedMessageData.data}`);
      break;
    case 'server-custom-event':
      console.log(`Event Type: ${event.type}`);
      console.log(`Event Type: ${parsedMessageData.event}`);
      // console.log(`Event Target: ${JSON.stringify(event.target, null, 2)}`);
      console.log(`Event Data: ${parsedMessageData.data}`);
      break;
    default:
      console.log('default case');
      console.log(parsedMessageData.event);
  }
  // if (parsedMessageData.Event === 'custom-event') {
  //   console.log(`Event Type: ${event.type}`);
  //   console.log(`Event Type: ${parsedMessageData.Event}`);
  //   // console.log(`Event Target: ${(JSON.stringify(event.target), null, 2)}`);
  //   console.log(`Event Data: ${parsedMessageData.Data}`);
  // }

  // if (parsedMessageData.Event === 'server-custom-event') {
  //   console.log(`Event Type: ${event.type}`);
  //   console.log(`Event Type: ${parsedMessageData.Event}`);
  //   // console.log(`Event Target: ${JSON.stringify(event.target, null, 2)}`);
  //   console.log(`Event Data: ${parsedMessageData.Data}`);
  // }
};

// socketClient.on('message', message => console.log(`Message Event Data: ${message}`));

// socketClient.onAny(event => console.log('req', event));

// socketClient.on('connect', () => {
//   console.log(`Connected to Go Lobby service with socket id: ${socketClient.id}`);

//   socketClient.emit('message', 'Hello from NODEJS');
// });

// socketClient.on('connect_error', err => {
//   console.error(`Connection Error: ${err.message}`);
//   // console.error(err); // Log the full error object for more details if needed
// });

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
