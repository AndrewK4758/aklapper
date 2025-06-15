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
  setLoading: () => void;
};
