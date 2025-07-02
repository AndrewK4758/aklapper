import axios from 'axios';

import type { album } from '@aklapper/chinook-client';
import type { QueryOptions } from '../../../types/types.js';

export type AllAlbums = { albums: album[] };

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const loadAlbums = async (queryOptions: QueryOptions): Promise<album[] | null> => {
  try {
    const { pageSize, skip, cursor } = queryOptions;

    const resp = await axios.get(`${baseURL}/albums?take=${pageSize}&skip=${skip}&cursor=${cursor}`, {
      headers: { 'Content-Type': 'text/plain' },
    });

    const { albums } = resp.data as AllAlbums;
    return albums;
  } catch (error) {
    console.error(error);
    return null;
  }
};
export default loadAlbums;
