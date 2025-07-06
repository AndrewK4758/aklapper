import type { artist } from '@aklapper/chinook-client';
import type { DataGridLoaderWithCount } from '@aklapper/types';
import axios from 'axios';
import type { LoaderFunction, LoaderFunctionArgs } from 'react-router';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const loadArtists = async (queryOptions: QueryOptions, signal: AbortSignal): Promise<artist[]> => {
  try {
    const { take, skip, cursor } = queryOptions;
    const resp = await axios.get(`${baseURL}/artists?take=${take}&skip=${skip}&cursor=${cursor}`, {
      headers: { 'Content-Type': 'text/plain' },
      signal,
    });

    const { data } = resp.data;
    return data as artist[];
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export default loadArtistsCount;
