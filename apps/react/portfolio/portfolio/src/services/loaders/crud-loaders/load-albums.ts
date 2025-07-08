import axios from 'axios';

import type { album } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse } from '@aklapper/types';
import type { LoaderFunction, LoaderFunctionArgs } from 'react-router';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const loadAlbums: LoaderFunction = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { search } = new URL(request.url);

    const resp = await axios.get(`${baseURL}/albums${search}`);

    const { message, data } = resp.data as CRUD_ApiResponse<{ count: number; data: album[] }>;

    console.info(message);

    return data;
  } catch (error) {
    console.error(error);
    return null;
  }
};
export default loadAlbums;
