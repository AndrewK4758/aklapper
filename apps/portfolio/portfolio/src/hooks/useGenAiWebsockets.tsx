import { setSocketListeners } from '@aklapper/socket-io-client';
import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { Socket } from 'socket.io-client';

type PromptResponse = {
  response: string;
};

const useGenAiWebsockets = (
  socket: Socket,
  setLoading: Dispatch<SetStateAction<boolean>>,
  setPromptResponse: Dispatch<SetStateAction<string[]>>
) => {
  useEffect(() => {
    if (!socket.connected) socket.connect();

    setSocketListeners(socket, [
      [
        'connect',
        () => {
          console.log(`Connected as ${socket.id}`);
        }
      ],
      [
        'chunk',
        chunk => {
          const { response } = chunk as PromptResponse;
          setPromptResponse(prev => [...prev, response]);
          setLoading(false);
        }
      ]
    ]);
    // socket.on('connect', () => {
    //   console.log(`Connected as ${socket.id}`);
    // });

    // socket.on('chunk', ({ response }) => {
    //   setPromptResponse(prev => [...prev, response]);
    //   setLoading(false);
    // });

    return () => {
      if (socket.connected) {
        socket.disconnect();
        socket.removeAllListeners();
      }
    };
  }, [setLoading, setPromptResponse, socket]);
};

export default useGenAiWebsockets;
