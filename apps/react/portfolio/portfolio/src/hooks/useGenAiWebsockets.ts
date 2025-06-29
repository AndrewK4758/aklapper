import type { ChatEntry } from '@aklapper/types';
import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { Socket } from 'socket.io-client';

const useGenAiWebsockets = (socket: Socket, setChatHistory: Dispatch<SetStateAction<ChatEntry[]>>) => {
  useEffect(() => {
    if (!socket.connected) socket.connect();

    socket.on('connect', () => {
      console.log(`Connected as ${socket.id}`);
      socket.on('chunk', (chunk: ChatEntry) => {
        const chatResponse = chunk;

        setChatHistory(prev =>
          prev.map(chat =>
            chat.id === chatResponse.id ? { ...chat, response: (chat.response += chatResponse.response) } : chat,
          ),
        );
      });
    });

    return () => {
      if (socket.connected) {
        socket.disconnect();
        socket.removeAllListeners();
      }
    };
  }, []);
};

export default useGenAiWebsockets;
