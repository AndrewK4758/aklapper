import type { album, artist, track } from '@aklapper/chinook-client';
import type { ChatEntry } from '@aklapper/types';
// import type { PromptRequest } from '@aklapper/vertex-ai';

export type HashFiles = { js: string | undefined; css: string | undefined };

export type ManifestType = {
  [key: string]: string[];
};

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
  cursor: number;
  pageSize: number;
  skip: number;
};

export type CRUD_ApiResponse<T> = {
  message: string;
  value: T;
};
