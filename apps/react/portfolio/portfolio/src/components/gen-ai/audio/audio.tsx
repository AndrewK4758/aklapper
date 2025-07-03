import type { MRC } from '@aklapper/media-recorder';
import { useScrollIntoView } from '@aklapper/react-shared';
import type { ChatEntry } from '@aklapper/types';
import Box from '@mui/material/Box';
import { useContext, useEffect, useRef, useState, type ReactElement } from 'react';
import { useOutletContext } from 'react-router';
import { io, type ManagerOptions, type Socket } from 'socket.io-client';
import { MediaRecorderClientContext, MediaRecorderClientContextProps } from '../../../contexts/audio_context_constants';
import Theme from '../../../styles/themes/theme';
import type { OutletContextProps } from '../../../types/types.js';
import AudioHeader from './header';
import Visualizer from './visualizer';

const options: MediaRecorderOptions = {
  mimeType: 'audio/webm',
};

/**
 * This component renders the audio section of the generative AI page.
 * It allows users to record audio, visualize it, and send it to the AI model for processing.
 *
 * @returns {ReactElement} The rendered GenAiAudio component.
 */

const vertexWsURL = import.meta.env.VITE_VERTEX_WS_URL;

const GenAiAudio = (): ReactElement => {
  const managerOptions: Partial<ManagerOptions> = {
    autoConnect: false,
    reconnectionAttempts: 10,
    reconnectionDelay: 2500,
    withCredentials: false,
    secure: true,
  };

  const clientSocket = io(vertexWsURL, managerOptions);
  const { MRC, createStream, stream, setStream } =
    useContext<MediaRecorderClientContextProps>(MediaRecorderClientContext);
  const { setChatHistory } = useOutletContext<OutletContextProps>();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [recording, setRecording] = useState<boolean>(false);
  const socketRef = useRef<Socket>(clientSocket);
  const audRef = useRef<HTMLAudioElement>(null);
  const mrcRef = useRef<MRC | null>(null);
  const divRef = useRef<HTMLDivElement>(null);

  const socket = socketRef.current;

  useScrollIntoView(divRef);

  useEffect(() => {
    if (!socket.connected) socket.connect();

    socket.on('chunk', (chatResponse: ChatEntry) => {
      setChatHistory(prev =>
        prev.map(chat =>
          chat.id === chatResponse.id ? { ...chat, response: (chat.response += chatResponse.response) } : chat,
        ),
      );
    });

    return () => {
      if (socket.connected) {
        socket.disconnect();
        socket.removeAllListeners();
      }
      if (mrcRef.current) {
        mrcRef.current?.mediaRecorder.stream.getAudioTracks().forEach(track => track.stop());
        mrcRef.current?.mediaRecorder.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (!stream) createStream(setStream, { audio: true, video: false });
    if (stream && !mrcRef.current) {
      mrcRef.current = new MRC(stream, options);
    }
  }, [stream]);

  useEffect(() => {
    if (audRef.current && blob) {
      const url = URL.createObjectURL(blob);
      audRef.current.src = url;
    }
  }, [blob]);

  return (
    <Box
      id='gen-audio-wrapper'
      ref={divRef}
      sx={{
        backgroundColor: Theme.palette.background.paper,
        borderRadius: Theme.shape.borderRadius,
        padding: Theme.spacing(4),
      }}
    >
      <AudioHeader
        audRef={audRef}
        blob={blob}
        mrcRef={mrcRef}
        socket={socket}
        setBlob={setBlob}
        setRecording={setRecording}
      />

      <Visualizer recording={recording} ref={audRef} stream={stream} />
    </Box>
  );
};

export default GenAiAudio;
