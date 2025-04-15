import { ClientSocket } from '@aklapper/socket-io-client';
import { createContext, type ReactElement, useRef } from 'react';
import type { Socket } from 'socket.io-client';

export type WebSocket = {
  socket: Socket;
};

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const WebSocketContext = createContext<WebSocket>(null!);

interface WebsocketContextProviderProps {
  children: ReactElement | ReactElement[];
}

const baseUrl = import.meta.env.VITE_WS_SERVER_URL_VERTEX;

const WebsocketContextProvider = ({ children }: WebsocketContextProviderProps) => {
  const { clientIo } = new ClientSocket(baseUrl, { autoConnect: false });
  const socketRef = useRef(clientIo);
  const socket = socketRef.current;

  return <WebSocketContext.Provider value={{ socket: socket }}>{children}</WebSocketContext.Provider>;
};

export default WebsocketContextProvider;
