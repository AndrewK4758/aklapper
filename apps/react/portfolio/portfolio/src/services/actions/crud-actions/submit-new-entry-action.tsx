import axios from 'axios';
import type { NavigateFunction } from 'react-router';
import type { track } from '../../../types/prisma_types.js';
import type { NewEntry } from '../../../types/types.js';

export type NewEntryReturn = {
  artist_id: number;
  name: string;
  album: { album_id: number; artist_id: number; title: string; track: track[] }[];
};

interface INewEntryReturn {
  newEntry: NewEntryReturn;
}

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const handleSubmitNewEntry = async (
  values: NewEntry,
  setSubmitting: (isSubmitting: boolean) => void,
  nav: NavigateFunction,
) => {
  console.log('here');
  try {
    setSubmitting(true);

    const { artist, album, track } = values;
    const resp = await axios.post(
      `${baseURL}/new-entry`,
      { artist: artist, album: album, track: track },
      { headers: { 'Content-Type': 'application/json' } },
    );

    const { newEntry } = resp.data as INewEntryReturn;

    return newEntry;
  } catch (error) {
    console.error(error);
    return null;
  } finally {
    setSubmitting(false);
    nav('/portfolio/crud', { replace: true });
  }
};

export default handleSubmitNewEntry;
