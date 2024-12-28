import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { Socket } from 'socket.io-client';

const useGenAiWebsockets = (
  socket: Socket,
  setLoading: Dispatch<SetStateAction<boolean>>,
  setPromptResponse: Dispatch<SetStateAction<string[]>>
) => {
  useEffect(() => {
    if (!socket.connected) socket.connect();

    socket.on('connect', () => {
      console.log(`Connected as ${socket.id}`);
    });

    socket.on('chunk', ({ response }) => {
      setPromptResponse(prev => [...prev, response]);
      setLoading(false);
    });

    return () => {
      if (socket.connected) {
        socket.disconnect();
        socket.removeAllListeners();
      }
    };
  }, [setLoading, setPromptResponse, socket]);
};

export default useGenAiWebsockets;
