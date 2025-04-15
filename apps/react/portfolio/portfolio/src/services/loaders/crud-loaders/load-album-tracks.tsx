import axios from 'axios';
import type { LoaderFunction, LoaderFunctionArgs } from 'react-router';
import type { track } from '../../../types/prisma_types';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

export type AlbumTracks = {
  tracks: track[];
};

const loadAlbumTracks: LoaderFunction = async ({ params }: LoaderFunctionArgs) => {
  // if (params.album_id) {
  try {
    const { albumID } = params;
    const resp = await axios.get(`${baseURL}/tracks?albumID=${albumID}`, {
      headers: { 'Content-Type': 'text/plain' },
    });

    const { tracks } = resp.data as AlbumTracks;

    return { tracks };
  } catch (error) {
    console.error(error);
    return null;
  }
  // } else return null;
};

export default loadAlbumTracks;
