import type { track } from '@aklapper/chinook-client';
import axios from 'axios';
import type { LoaderFunction, LoaderFunctionArgs } from 'react-router';

const baseURL = import.meta.env.VITE_DATA_API_URL;

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
