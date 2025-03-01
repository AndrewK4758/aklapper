import type { artist } from '@prisma/client';
import axios from 'axios';
import type { QueryOptions } from '../../../pages/crud/crud.jsx';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const loadArtists = async (queryOptions: QueryOptions) => {
  try {
    const { pageSize, skip, cursor } = queryOptions;
    const resp = await axios.get(`${baseURL}/artists?take=${pageSize}&skip=${skip}&cursor=${cursor}`, {
      headers: { 'Content-Type': 'text/plain' }
    });

    const { allArtists } = resp.data;
    return allArtists as artist[];
  } catch (error) {
    console.error(error);
    return undefined;
  }
};

export default loadArtists;
