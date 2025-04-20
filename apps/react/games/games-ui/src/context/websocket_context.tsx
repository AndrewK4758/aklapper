import type { IPlayer } from '@aklapper/types';
import { createContext } from 'react';
import type { ManagerOptions, Socket } from 'socket.io-client';
import ClientSocket from '../utils/web-socket/socket-instance';

export interface WebsocketContextProps {
  socket: Socket;
}

const activePlayer = localStorage.getItem('activePlayer');

let activePlayerDetails: Partial<IPlayer>;

if (activePlayer) activePlayerDetails = JSON.parse(activePlayer);
else
  activePlayerDetails = {
    id: '',
    name: '',
    email: '',
    currentTimeEntered: undefined,
    inLobby: false,
    socketIoId: undefined,
  };

const wsUrl = import.meta.env.VITE_WS_SERVER_URL;

const managerOptions: Partial<ManagerOptions> = {
  autoConnect: false,
  path: '/lobby',
  extraHeaders: {
    'current-player-id': activePlayerDetails.id as string,
  },
};

export const clientSocket = new ClientSocket(wsUrl, managerOptions);

export const WebsocketContext = createContext<WebsocketContextProps>({
  socket: clientSocket.Socket,
});
