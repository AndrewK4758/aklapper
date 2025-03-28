import type { IPlayer } from '@aklapper/types';
import { createContext, useRef, type ReactNode } from 'react';
import { ManagerOptions, Socket } from 'socket.io-client';
import ClientSocket from '../utils/web-socket/socket-instance';

export interface WebsocketContextProps {
  socket: Socket;
}

const activePlayerDetails = JSON.parse(sessionStorage.getItem('activePlayer') as string) as Partial<IPlayer>;

const wsUrl = import.meta.env.VITE_WS_SERVER_URL;

const managerOptions: Partial<ManagerOptions> = {
  path: '/lobby',
  autoConnect: false,
  extraHeaders: {
    currentPlayerID: activePlayerDetails.Id as string
  }
};

const clientSocket = new ClientSocket(wsUrl, managerOptions);

export const WebsocketContext = createContext<WebsocketContextProps>({
  socket: clientSocket.Socket
});

interface WebsocketContextProviderProps {
  children?: ReactNode;
}

export default function WebsocketContextProvider({ children }: WebsocketContextProviderProps) {
  const socketRef = useRef<Socket>(clientSocket.Socket);

  const socket = socketRef.current;

  return <WebsocketContext.Provider value={{ socket: socket }}>{children}</WebsocketContext.Provider>;
}
