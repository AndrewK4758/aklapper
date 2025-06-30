import type { MRC } from '@aklapper/media-recorder';
import type { ChatEntry } from '@aklapper/types';
import type { FileData } from '@google-cloud/vertexai';
import HearingIcon from '@mui/icons-material/Hearing';
import MicNoneIcon from '@mui/icons-material/MicNone';
import MicOffIcon from '@mui/icons-material/MicOff';
import Box from '@mui/material-pigment-css/Box';
import Button from '@mui/material/Button';
import axios from 'axios';
import { useContext, type RefObject } from 'react';
import { useOutletContext } from 'react-router';
import ShortUniqueId from 'short-unique-id';
import type { Socket } from 'socket.io-client';
import { MediaRecorderClientContext, type MediaRecorderClientContextProps } from '../../../contexts/audio-context';
import { OutletContextProps } from '../../../types/types';

interface AudioButtonsProps {
  audRef: RefObject<HTMLAudioElement | null>;
  blob: Blob | null;
  mrcRef: RefObject<MRC | null>;
  socket: Socket;
  setBlob: (blob: Blob | null) => void;
  setRecording: (recording: boolean) => void;
}

export default function AudioButtons({ audRef, blob, mrcRef, socket, setBlob, setRecording }: AudioButtonsProps) {
  const { setChatHistory } = useOutletContext<OutletContextProps>();
  const { setStream } = useContext<MediaRecorderClientContextProps>(MediaRecorderClientContext);

  const uploadFile = async () => {
    if (blob) {
      const path = await handleFileUpload(audRef, blob);
      if (path) {
        const id = new ShortUniqueId().rnd(6);
        const fileData: FileData = {
          fileUri: path,
          mimeType: blob.type,
        };

        const chatEntry: ChatEntry = {
          id: id,
          fileData: fileData,
          prompt: 'Perform the query described in the audio file',
          response: '',
        };

        setChatHistory(prev => [...prev, chatEntry]);

        socket.emit('prompt', chatEntry, (resp: Response) => {
          const { status } = resp;

          if (status === 200) {
            console.log('SUBMISSION SUCCESS');
          }
        });
      }
    }
  };

  return (
    <Box
      as={'section'}
      id='gen-audio-recorder-buttons-wrapper'
      sx={{
        display: 'flex',
        justifyContent: 'space-evenly',
      }}
    >
      {blob && <Button onClick={() => uploadFile()}>Query Gemini</Button>}

      <Button
        endIcon={<MicNoneIcon />}
        onClick={() => {
          mrcRef.current?.startRecording(setBlob);
          setRecording(true);
        }}
      >
        Start
      </Button>

      <Button
        endIcon={<MicOffIcon />}
        onClick={() => {
          mrcRef.current?.stopRecording();
          mrcRef.current?.mediaRecorder.stream.getAudioTracks().forEach(track => track.stop());
          setRecording(false);
          setStream(null);
        }}
      >
        Stop
      </Button>

      <Button endIcon={<HearingIcon />} onClick={() => audRef.current?.play()}>
        Listen
      </Button>
    </Box>
  );
}

const baseUrl = import.meta.env.VITE_VERTEX_API_URL;

/**
 * This function handles uploading the recorded audio to the server.
 *
 * @param {RefObject<HTMLAudioElement | null>} fileInputRef - A ref to the audio element.
 * @param {Blob} blob - The recorded audio blob.
 * @returns {Promise<string | undefined>} A promise that resolves with the path to the uploaded audio file.
 */

const handleFileUpload = async (
  fileInputRef: RefObject<HTMLAudioElement | null>,
  blob: Blob,
): Promise<string | void> => {
  try {
    if (fileInputRef.current) {
      const file = new File([blob], fileInputRef.current.title);
      const contextPath = sessionStorage.getItem('context-path');
      const resp = await axios.post(
        `${baseUrl}/upload`,
        { file: file, contextPath: contextPath },
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );

      const { path } = resp.data as { path: string };

      return path;
    }
  } catch (error) {
    console.error(error);
  }
};
