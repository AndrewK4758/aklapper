import axios from 'axios';
import type { LoaderFunction, LoaderFunctionArgs } from 'react-router';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const loadTracksCount: LoaderFunction = async ({ params }: LoaderFunctionArgs) => {
  try {
    const { albumID } = params;

    const resp = await axios.get(`${baseURL}/tracks?count=true&albumID=${albumID}`);

    const { count } = resp.data;
    return count;
  } catch (error) {
    console.error(error);
  }
};

export default loadTracksCount;
