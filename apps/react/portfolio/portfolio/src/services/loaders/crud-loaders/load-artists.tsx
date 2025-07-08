import type { artist } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse, DataGridLoaderWithCount } from '@aklapper/types';
import axios from 'axios';
import type { LoaderFunction, LoaderFunctionArgs } from 'react-router';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const loadArtistsCount: LoaderFunction = async ({
  request,
}: LoaderFunctionArgs): Promise<DataGridLoaderWithCount<artist[]> | void> => {
  try {
    const { search } = new URL(request.url);

    const resp = await axios.get(`${baseURL}/artists${search}`);

    const { message, data } = resp.data as CRUD_ApiResponse<{ count: number; data: artist[] }>;

    console.info(message);

    return data;
  } catch (error) {
    console.error(error);
  }
};

export default loadArtistsCount;
