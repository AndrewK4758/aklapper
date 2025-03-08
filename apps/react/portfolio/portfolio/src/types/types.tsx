import type { Dispatch, SetStateAction } from 'react';

export type LoadingOutletContext = {
  loading: boolean;
  setLoading: Dispatch<SetStateAction<boolean>>;
};

export type HashFiles = { js: string; css: string; fonts: string[] };
