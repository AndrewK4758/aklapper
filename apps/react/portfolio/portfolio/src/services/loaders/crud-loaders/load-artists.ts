import type { artist } from '@aklapper/chinook-client';
import type { DataGridLoaderWithCount } from '@aklapper/types';
import axios from 'axios';
import type { LoaderFunction, LoaderFunctionArgs } from 'react-router';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const loadArtists = async (queryOptions: QueryOptions, signal: AbortSignal): Promise<artist[]> => {
  try {
    const { search } = new URL(request.url);

    const resp = await axios.get(`${baseURL}/artists${search}`);

    const { message, data } = resp.data as CRUD_ApiResponse<{ count: number; data: artist[] }>;

    console.info(message);

    return data;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export default loadArtistsCount;
