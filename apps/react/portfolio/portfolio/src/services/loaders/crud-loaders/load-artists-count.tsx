import axios from 'axios';
import type { LoaderFunction } from 'react-router';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const loadArtistsCount: LoaderFunction = async () => {
  try {
    const resp = await axios.get(`${baseURL}/artists?count=true`);
    const { count } = resp.data;

    return count;
  } catch (error) {
    console.error(error);
  }
};

export default loadArtistsCount;
