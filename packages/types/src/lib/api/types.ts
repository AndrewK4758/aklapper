import type { FileData } from '@google-cloud/vertexai';
import type ShortUniqueId from 'short-unique-id';

export type DataGridLoader<T> = { data: T };

export type DataGridLoaderWithCount<T> = DataGridLoader<T> & { count: number };

export type CRUD_ApiResponse<T> = DataGridLoader<T> & {
  message: string;
};

export type ChatEntry = {
  id: ReturnType<ShortUniqueId['rnd']>;
  prompt: string;
  fileData: FileData | null | undefined;
  response: string;
};
