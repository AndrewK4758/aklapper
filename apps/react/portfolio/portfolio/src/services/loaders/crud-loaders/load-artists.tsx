import type { artist } from '@aklapper/chinook-client';
import axios from 'axios';
import type { QueryOptions } from '../../../types/types.js';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const loadArtists = async (queryOptions: QueryOptions, signal: AbortSignal): Promise<artist[] | null> => {
  try {
    const { pageSize, skip, cursor } = queryOptions;
    const resp = await axios.get(`${baseURL}/artists?take=${pageSize}&skip=${skip}&cursor=${cursor}`, {
      headers: { 'Content-Type': 'text/plain' },
      signal,
    });

    const { allArtists } = resp.data;
    return allArtists as artist[];
  } catch (error) {
    console.error(error);
    return null;
  }
};

export default loadArtists;
