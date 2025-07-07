import type { track } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse } from '@aklapper/types';
import axios from 'axios';
import type { LoaderFunction, LoaderFunctionArgs } from 'react-router';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const loadAlbumTracks: LoaderFunction = async function ({ params }: LoaderFunctionArgs) {
  try {
    const { albumID } = params;

    const resp = await axios.get(`${baseURL}/tracks?albumID=${albumID}`, {
      headers: { 'Content-Type': 'text/plain' },
    });
    const { message, data } = resp.data as CRUD_ApiResponse<track[]>;

    console.info(message);

    return { data };
  } catch (error) {
    console.error(error);
    return null;
  }
};

export default loadAlbumTracks;
