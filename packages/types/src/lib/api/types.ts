import type { FileData } from '@google-cloud/vertexai';
import type ShortUniqueId from 'short-unique-id';
export type CRUD_ApiResponse<T> = {
  message: string;
  value: T;
};

// type PromptRequest = {
//   text: string | null;
//   fileData: FileData | null | undefined;
// };

export type ChatEntry = {
  id: ReturnType<ShortUniqueId['rnd']>;
  prompt: string;
  fileData: FileData | null | undefined;
  response: string;
};
