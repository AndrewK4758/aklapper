import type { IPlayer } from '@aklapper/types';
import { createContext } from 'react';
import type { ManagerOptions, Socket } from 'socket.io-client';
import ClientSocket from '../utils/web-socket/socket-instance';

export interface WebsocketContextProps {
  socket: Socket;
}

const sessionStoredPlayer = sessionStorage.getItem('activePlayer');

let activePlayerDetails: Partial<IPlayer>;

if (sessionStoredPlayer) activePlayerDetails = JSON.parse(sessionStoredPlayer);
else activePlayerDetails = { Id: '', Name: '' };

const wsUrl = import.meta.env.VITE_WS_SERVER_URL;

const managerOptions: Partial<ManagerOptions> = {
  autoConnect: false,
  path: '/lobby',
  extraHeaders: {
    'current-player-id': activePlayerDetails.Id as string,
  },
};

export const clientSocket = new ClientSocket(wsUrl, managerOptions);

export const WebsocketContext = createContext<WebsocketContextProps>({
  socket: clientSocket.Socket,
});
