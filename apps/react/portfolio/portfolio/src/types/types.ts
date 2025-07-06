import type { album, artist, Prisma, track } from '@aklapper/chinook-client';
import type { ChatEntry, GameBoards, IActivePlayersInGame } from '@aklapper/types';

export type HashFiles = { js: string | undefined; css: string | undefined };

export type ManifestType = {
  [key: string]: string[];
};

export interface IActiveGameInfo extends IActivePlayersInGame {
  gameBoard: GameBoards;
  space: string | undefined;
}

export type OutletContextProps = {
  chatHistory: ChatEntry[];
  setChatHistory: (response: ChatEntry[] | ((prevResp: ChatEntry[]) => ChatEntry[])) => void;
  loading: boolean;
  setLoading: (loadding: boolean) => void;
};

export type CompletedState = {
  [k: number]: boolean;
};

export type NewEntryArtist = Pick<artist, 'name'>;
export type NewEntryAlbum = Pick<album, 'title'>;
export type NewEntryTrack = Pick<
  track,
  'name' | 'composer' | 'bytes' | 'milliseconds' | 'media_type_id' | 'genre_id' | 'unit_price'
>;

export type NewEntry = {
  artist: NewEntryArtist;
  album: NewEntryAlbum;
  track: NewEntryTrack;
};

export type NewEntryIDs = {
  artistID: number;
  albumID: number;
};

export type QueryOptions = {
  cursor: string;
  take: string;
  skip: string;
};

export type CRUD_ApiResponse<T> = {
  message: string;
  value: T;
};

export interface MediaRecorderOptions {
  mimeType?: string;
  audioBitsPerSecond?: number;
  videoBitsPerSecond?: number;
  bitsPerSecond?: number;
}

export interface BlobEvent extends Event {
  readonly data: Blob;
  readonly timecode?: number;
}

export interface MediaRecorderErrorEvent extends Event {
  readonly error: DOMException;
}

export declare class MediaRecorderClient extends EventTarget {
  constructor(stream: MediaStream, options?: MediaRecorderOptions);
  readonly mimeType: string;
  readonly state: 'inactive' | 'recording' | 'paused';
  readonly stream: MediaStream;
  readonly videoBitsPerSecond: number;
  readonly audioBitsPerSecond: number;
  start(timeslice?: number): void;
  stop(): void;
  pause(): void;
  resume(): void;
  requestData(): void;
  ondataavailable: (event: BlobEvent) => void;
  onerror: (event: MediaRecorderErrorEvent) => void;
  onstart: (event: Event) => void;
  onstop: (event: Event) => void;
  onpause: (event: Event) => void;
  onresume: (event: Event) => void;
}

/***********************************************************************************/

export type ArtistLoader = { count: number; data: artist[] };
