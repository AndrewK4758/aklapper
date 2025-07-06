import axios from 'axios';
import type { LoaderFunction, LoaderFunctionArgs } from 'react-router';
import type { ArtistLoader } from '../../../types/types';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const loadArtistsCount: LoaderFunction = async ({ request }: LoaderFunctionArgs): Promise<ArtistLoader | void> => {
  try {
    const { search } = new URL(request.url);

    const resp = await axios.get(`${baseURL}/artists${search}`);
    const { count, data } = resp.data;

    return { count, data };
  } catch (error) {
    console.error(error);
  }
};

export default loadArtistsCount;
