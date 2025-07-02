import type { album } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse } from '@aklapper/types';
import axios from 'axios';
import type { QueryOptions } from '../../../types/types.js';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

export default async function loadArtistAlbums(
  queryOptions: QueryOptions,
  signal: AbortSignal,
  artistID: string,
): Promise<album[] | null> {
  try {
    const { pageSize, cursor, skip } = queryOptions;
    const resp = await axios.get(
      `${baseURL}/albums?artistID=${artistID}&take=${pageSize}&skip=${skip}&cursor=${cursor}`,
      {
        headers: { 'Content-Type': 'text/plain' },
        signal: signal,
      },
    );

    const { value } = resp.data as CRUD_ApiResponse<album[]>;

    return value;
  } catch (error) {
    console.error(error);
    return null;
  }
}
