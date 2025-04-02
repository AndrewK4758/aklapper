import { useRef, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { WebsocketContext, clientSocket } from './websocket_context';

interface WebsocketContextProviderProps {
  children?: ReactNode;
}

export default function WebsocketContextProvider({ children }: WebsocketContextProviderProps) {
  const socketRef = useRef<Socket>(clientSocket.Socket);

  const socket = socketRef.current;

  return <WebsocketContext.Provider value={{ socket: socket }}>{children}</WebsocketContext.Provider>;
}
