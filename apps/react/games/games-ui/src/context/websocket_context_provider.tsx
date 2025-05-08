import type { PlayerID } from '@aklapper/types';
import { useRef, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { WebsocketContext, clientSocket } from './websocket_context';

interface WebsocketContextProviderProps {
  children?: ReactNode;
}

export default function WebsocketContextProvider({ children }: WebsocketContextProviderProps) {
  const socketRef = useRef<Socket>(clientSocket.Socket);

  const socket = socketRef.current;

  const addExtraHeaders = (playerId: PlayerID) => {
    if (socket.io.opts.extraHeaders) socket.io.opts.extraHeaders['current-player-id'] = playerId;
  };

  return (
    <WebsocketContext.Provider value={{ socket: socket, addExtraHeaders: addExtraHeaders }}>
      {children}
    </WebsocketContext.Provider>
  );
}
