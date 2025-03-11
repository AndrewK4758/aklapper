import axios from 'axios';
import type { QueryOptions } from '../../../pages/crud/crud.jsx';
import type { album } from '@prisma/client';

export type AllAlbums = { albums: album[] };

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const loadAlbums = async (queryOptions: QueryOptions) => {
  try {
    const { pageSize, skip, cursor } = queryOptions;

    const resp = await axios.get(`${baseURL}/albums?take=${pageSize}&skip=${skip}&cursor=${cursor}`, {
      headers: { 'Content-Type': 'text/plain' }
    });

    console.log(resp.data);
    const { albums } = resp.data as AllAlbums;
    return albums;
  } catch (error) {
    console.error(error);
    return undefined;
  }
};
export default loadAlbums;
