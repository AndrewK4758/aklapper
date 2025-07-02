import type { MRC } from '@aklapper/media-recorder';
import type { Dispatch, SetStateAction } from 'react';
import { createContext } from 'react';

export interface MediaRecorderClientContextProps {
  MRC: typeof MRC;
  stream: MediaStream | null;
  setStream: Dispatch<SetStateAction<MediaStream | null>>;
  createStream: (
    setStream: Dispatch<SetStateAction<MediaStream | null>>,
    constraints: MediaStreamConstraints,
  ) => Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const MediaRecorderClientContext = createContext<MediaRecorderClientContextProps>(null!);
