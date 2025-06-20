import { SocketServer } from '@aklapper/socket-io-server';
import type { PlayerID, SocketID } from '@aklapper/types';
import cors, { type CorsOptions } from 'cors';
import { configDotenv } from 'dotenv';
import express, { type Express } from 'express';
import { createServer } from 'node:http';
import { join } from 'path';
import { cwd } from 'process';
import type { ServerOptions } from 'socket.io';
import createNewGame from './events/create_new_game.js';
import enterLobby from './events/enter-lobby.js';
import handleLeaveLobby from './events/leave_lobby.js';
import privateMessagePlayer from './events/private_message.js';
import socketBoardAction from './events/socket-board-action.js';
import addGameToSocketInstance from './middleware/socket-add-game-middleware.js';

// import go_websocketEvent from './models/go_websocket_event.js';
import gamesInLobby from './data/games_in_lobby/games_in_lobby.js';
import checkStartGame from './events/check_start-game.js';
import joinGame from './events/join-game.js';
import useAllGamesMap from './middleware/all-games-map.js';
import useActivePlayersMap from './middleware/use_active_players_map.js';
import routerV1 from './routes/v1/routes.js';
import routerV2 from './routes/v2/routes.js';
import syncWithGoLobby from './services/game/sync_lobby_data.js';

const __dirname = join(cwd(), 'apps/nodejs/games/games-api');

configDotenv({ path: join(__dirname, 'env/.env') });

const WS_URL = process.env.GO_WS_URL;

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

const baseWsServerOptions: Partial<ServerOptions> = {
  cleanupEmptyChildNamespaces: true,
  cors: corsOptions,
  path: '/games-api',
};

const httpServer = createServer(app);

const socketServer = new SocketServer(httpServer, baseWsServerOptions, new Map<PlayerID, SocketID>());

export const lobbySocketServer = socketServer.createNamespace('lobby');
export const gameplaySocketServer = socketServer.createNamespace('gameplay');

export const socketConnectionMap = socketServer.connMap;

socketServer.addMiddleware('gameplay', addGameToSocketInstance);
socketServer.addServerListener('gameplay', 'action', socketBoardAction);

socketServer.addServerListener('lobby', 'enter-lobby', enterLobby);
socketServer.addServerListener('lobby', 'send-private-message', privateMessagePlayer);
socketServer.addServerListener('lobby', 'remove-player', handleLeaveLobby);
socketServer.addServerListener('lobby', 'create-new-game', createNewGame);
socketServer.addServerListener('lobby', 'join-game', joinGame);
socketServer.addServerListener('lobby', 'check-start-game', checkStartGame);

let reconnecting: null | NodeJS.Timeout = null;
let socketClient: WebSocket | null = null;

const connectWebsocket = function () {
  socketClient = new WebSocket(WS_URL as string);

  socketClient.onclose = () => {
    console.log('close');
    console.log('Clearing active players and games');
    const activePlayers = useActivePlayersMap();
    const gamesMap = useAllGamesMap();

    activePlayers.map.clear();
    gamesInLobby.map.clear();
    gamesMap.AllGames.clear();

    console.log(activePlayers, gamesInLobby);

    reconnecting = setTimeout(() => {
      connectWebsocket();
    }, 2500);
  };

  socketClient.onerror = err => {
    console.error('ERROR:\n\t', err);
    reconnecting = setTimeout(() => {
      connectWebsocket();
    }, 2500);
  };

  socketClient.onopen = async () => {
    console.log('CONNECTED TO GO LOBBY');
    reconnecting = null;
    if (reconnecting) clearTimeout(reconnecting);
    await syncWithGoLobby();
  };
};

connectWebsocket();

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
export { socketClient };
