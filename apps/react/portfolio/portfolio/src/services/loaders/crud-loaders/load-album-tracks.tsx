import type { track } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse } from '@aklapper/types';
import axios from 'axios';
import type { QueryOptions } from '../../../types/types';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

export default async function loadAlbumTracks(queryOptions: QueryOptions, signal: AbortSignal, albumID: string) {
  try {
    const { cursor, skip, pageSize } = queryOptions;
    const resp = await axios.get(
      `${baseURL}/tracks?albumID=${albumID}&cursor=${cursor}&skip=${skip}&take=${pageSize}`,
      {
        headers: { 'Content-Type': 'text/plain' },
        signal: signal,
      },
    );
    const { value } = resp.data as CRUD_ApiResponse<track[]>;

    return value;
  } catch (error) {
    console.error(error);
    return null;
  }
}
