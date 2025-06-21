import type { album, artist, track } from '@aklapper/chinook-client';
import type { PromptRequest } from '@aklapper/vertex-ai';

export type HashFiles = { js: string | undefined; css: string | undefined };

export type ManifestType = {
  [key: string]: string[];
};

export type OutletContextProps = {
  prompt: PromptRequest;
  promptResponse: string[];
  setPromptResponse: () => void;
  loading: boolean;
  setLoading: (loadding: boolean) => void;
};

export type CompletedState = {
  [k: number]: boolean;
};

export type NewEntry = {
  artist: Partial<artist>;
  album: Partial<album>;
  track: Partial<track>;
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
