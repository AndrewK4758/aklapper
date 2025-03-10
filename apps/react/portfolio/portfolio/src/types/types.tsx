import type { PromptRequest } from '@aklapper/vertex-ai';
import type { Dispatch, SetStateAction } from 'react';

export type HashFiles = { js: string; css: string; fonts: string[] };

export type OutletContextProps = {
  prompt: PromptRequest;
  promptResponse: string[];
  setPromptResponse: Dispatch<SetStateAction<string[]>>;
  loading: boolean;
  setLoading: Dispatch<SetStateAction<boolean>>;
};
