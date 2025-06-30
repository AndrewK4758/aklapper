import type { MRC } from '@aklapper/media-recorder';
import { Text } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import type { RefObject } from 'react';
import type { Socket } from 'socket.io-client';
import Theme from '../../../styles/themes/theme';
import { AUDIO_TEXT } from '../static/audio-text';
import AudioButtons from './buttons';

interface AudioHeaderProps {
  audRef: RefObject<HTMLAudioElement | null>;
  blob: Blob | null;
  mrcRef: RefObject<MRC | null>;
  socket: Socket;
  setBlob: (blob: Blob | null) => void;
  setRecording: (recording: boolean) => void;
}

export default function AudioHeader({ audRef, blob, mrcRef, socket, setBlob, setRecording }: AudioHeaderProps) {
  return (
    <Box component={'section'} id={'gen-audio-header-wrapper'} sx={{ display: 'flex', gap: Theme.spacing(6) }}>
      <Box>
        <Text variant='h3' children={'Audio'} />
        <AudioButtons
          audRef={audRef}
          blob={blob}
          mrcRef={mrcRef}
          socket={socket}
          setBlob={setBlob}
          setRecording={setRecording}
        />
      </Box>
      <Divider flexItem orientation='vertical' />

      <Text variant='body1' children={AUDIO_TEXT} sx={{ textAlign: 'start' }} />
    </Box>
  );
}
