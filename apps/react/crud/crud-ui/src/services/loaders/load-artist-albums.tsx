import type { album } from '@aklapper/chinook-client';
import axios from 'axios';
import type { LoaderFunction, LoaderFunctionArgs } from 'react-router';

const baseURL = import.meta.env.VITE_DATA_API_URL;

export type ArtistAlbums = {
  albums: album[];
};

const loadArtistAlbums: LoaderFunction = async ({ params }: LoaderFunctionArgs) => {
  try {
    const { artistID } = params;

    const resp = await axios.get(`${baseURL}/albums?artistID=${artistID}`, {
      headers: { 'Content-Type': 'text/plain' },
    });

    const { albums } = resp.data as ArtistAlbums;
    return { albums };
  } catch (error) {
    console.error(error);
    return null;
  }
};
export default loadArtistAlbums;
