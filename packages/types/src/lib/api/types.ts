import type { FileData } from '@google-cloud/vertexai';
import type ShortUniqueId from 'short-unique-id';

export type DataGridLoader<T> = { data: T; count?: number };

// export type DataGridLoaderWithCount<T> = DataGridLoader<T> & { count: number };

export type CRUD_ApiResponse<T> = DataGridLoader<T> & {
  message: string;
};

export type CRUD_ValidationCategoryTypes = (typeof CRUD_ValidationCategory)[keyof typeof CRUD_ValidationCategory];

export const CRUD_ValidationCategory = Object.freeze({
  ARTISTS: 'artists',
  ALBUMS: 'albums',
  TRACKS: 'tracks',
});

export type ChatEntry = {
  id: ReturnType<ShortUniqueId['rnd']>;
  prompt: string;
  fileData: FileData | null | undefined;
  response: string;
};

export const BlurResponse = Object.freeze({
  ERROR: 'error',
  AVAILABLE: 'availavle',
});

export type BlurResponseStatus = (typeof BlurResponse)[keyof typeof BlurResponse];

export type CRUD_BlurResponse = {
  message: string;
  status: BlurResponseStatus;
};
