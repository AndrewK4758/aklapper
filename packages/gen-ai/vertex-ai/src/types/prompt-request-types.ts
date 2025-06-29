import type { FileData } from '@google-cloud/vertexai';

export type GcsBucketPath = `gs://${string}`;

export type PromptRequest = {
  text: string | null;
  fileData: FileData | null | undefined;
};
