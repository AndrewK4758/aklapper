import Box from '@mui/material-pigment-css/Box';
import type { RefObject } from 'react';
import AudioVisualizer from './audio-visualizer';

interface VisualizerProps {
  ref: RefObject<HTMLAudioElement | null>;
  recording: boolean;
  stream: MediaStream | null;
}

export default function Visualizer({ recording, ref, stream }: VisualizerProps) {
  return (
    <Box as={'section'} id='gen-audio-recorder-wrapper'>
      {recording && <AudioVisualizer stream={stream as MediaStream} />}
      <audio title='audio-track.webm' ref={ref} />
    </Box>
  );
}
