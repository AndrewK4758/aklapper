import type { MRC } from '@aklapper/media-recorder';
import { Text, useScrollIntoView } from '@aklapper/react-shared';
import type { PromptRequest } from '@aklapper/vertex-ai';
import HearingIcon from '@mui/icons-material/Hearing';
import MicNoneIcon from '@mui/icons-material/MicNone';
import MicOffIcon from '@mui/icons-material/MicOff';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import axios from 'axios';
import { useContext, useEffect, useRef, useState, type JSX, type RefObject } from 'react';
import { useOutletContext } from 'react-router';
import { io, type ManagerOptions, type Socket } from 'socket.io-client';
import { MediaRecorderClientContext } from '../../../contexts/audio-context.jsx';
import { crudHeaderTextSxProps } from '../../../styles/crud-styles.jsx';
import { genAiAudioIconButtonSxProps, topLevelModeStyle } from '../../../styles/gen-ai-styles.jsx';
import { buttonSXProps } from '../../../styles/pages-styles.js';
import { pagesTitleSx } from '../../../styles/pages-styles.jsx';
import type { OutletContextProps } from '../../../types/types.tsx';
import { audioText } from '../static/audio-text.jsx';
import AudioVisualizer from './audio-visualizer.jsx';

const options: MediaRecorderOptions = {
  mimeType: 'audio/webm',
};

/**
 * This component renders the audio section of the generative AI page.
 * It allows users to record audio, visualize it, and send it to the AI model for processing.
 *
 * @returns {JSX.Element} The rendered GenAiAudio component.
 */

const vertexWsURL = import.meta.env.VITE_VERTEX_WS_URL;

const GenAiAudio = (): JSX.Element => {
  const managerOptions: Partial<ManagerOptions> = {
    autoConnect: false,
    reconnectionAttempts: 10,
    reconnectionDelay: 2500,
    withCredentials: false,
    secure: true,
  };

  const clientSocket = io(vertexWsURL, managerOptions);
  const { MRC, createStream, stream, setStream } = useContext(MediaRecorderClientContext);
  const { setPromptResponse } = useOutletContext<OutletContextProps>();
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

    socket.on('chunk', ({ response }) => {
      setPromptResponse(prev => [...prev, response]);
    });

    return () => {
      if (socket.connected) {
        socket.disconnect();
        socket.removeAllListeners();
      }
    };
  });

  useEffect(() => {
    if (!stream) createStream(setStream, { audio: true, video: false });
    if (stream) {
      mrcRef.current = new MRC(stream, options);
    }
  }, [MRC, createStream, setStream, stream]);

  useEffect(() => {
    if (audRef.current && blob) {
      const url = URL.createObjectURL(blob as Blob);
      audRef.current.src = url;
    }
  }, [blob]);

  const uploadFile = async () => {
    if (blob) {
      const path = await handleFileUpload(audRef, blob);

      const promptData: PromptRequest = {
        fileData: {
          fileUri: path,
          mimeType: blob.type,
        },

        text: null,
      };

      socket.emit('prompt', promptData);
    }
  };

  return (
    <Box component={'div'} key={'gen-audio-wrapper'} id='gen-audio-wrapper' ref={divRef} sx={topLevelModeStyle}>
      <Paper component={'div'} key={'gen-audio-paper'} id='gen-audio-paper'>
        <Container component={'section'} key={'gen-audio-container'} id='gen-audio-container'>
          <Box component={'section'} key={'gen-audio-header-wrapper'} id={'gen-audio-header-wrapper'}>
            <Text component={'h3'} titleVariant='h3' titleText={'Audio'} sx={pagesTitleSx} />

            <Text component={'p'} titleVariant='body1' titleText={audioText} sx={crudHeaderTextSxProps} />
          </Box>
          <Box component={'section'} key={'gen-audio-recorder-wrapper'} id='gen-audio-recorder-wrapper'>
            {recording && <AudioVisualizer stream={stream as MediaStream} />}
            <audio title='audio-track.webm' ref={audRef} />
          </Box>

          <Box
            component={'section'}
            key={'gen-audio-recorder-buttons-wrapper'}
            id='gen-audio-recorder-buttons-wrapper'
            display={'flex'}
            justifyContent={'space-evenly'}
          >
            {blob && (
              <Button onClick={() => uploadFile()} sx={buttonSXProps}>
                Query Gemini
              </Button>
            )}

            <Button
              endIcon={<MicNoneIcon sx={genAiAudioIconButtonSxProps} />}
              onClick={() => {
                mrcRef.current?.startRecording(setBlob);
                setRecording(true);
              }}
              sx={buttonSXProps}
            >
              Start
            </Button>

            <Button
              endIcon={<MicOffIcon sx={genAiAudioIconButtonSxProps} />}
              onClick={() => {
                mrcRef.current?.stopRecording();
                setRecording(false);
              }}
              sx={buttonSXProps}
            >
              Stop
            </Button>

            <Button
              endIcon={<HearingIcon sx={genAiAudioIconButtonSxProps} />}
              onClick={() => audRef.current?.play()}
              sx={buttonSXProps}
            >
              Listen
            </Button>
          </Box>
        </Container>
      </Paper>
    </Box>
  );
};

export default GenAiAudio;

const baseUrl = import.meta.env.VITE_SERVER_URL_VERTEX;

/**
 * This function handles uploading the recorded audio to the server.
 *
 * @param {RefObject<HTMLAudioElement | null>} fileInputRef - A ref to the audio element.
 * @param {Blob} blob - The recorded audio blob.
 * @returns {Promise<string | undefined>} A promise that resolves with the path to the uploaded audio file.
 */

const handleFileUpload = async (fileInputRef: RefObject<HTMLAudioElement | null>, blob: Blob) => {
  try {
    if (fileInputRef.current) {
      const file = new File([blob], fileInputRef.current.title);
      const contextPath = sessionStorage.getItem('context-path');
      const resp = await axios.post(
        `${baseUrl}/upload`,
        { file: file, contextPath: contextPath },
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );

      const { path } = resp.data;

      return path;
    }
  } catch (error) {
    console.error(error);
    return null;
  }
};
