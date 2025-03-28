import type { IBuiltGame } from '@aklapper/types';
import axios from 'axios';

const baseURL = import.meta.env.VITE_REST_API_SERVER_URL;
export default async function loaderFunction(): Promise<IBuiltGame[] | void> {
  try {
    const resp = await axios.get(`${baseURL}/games`);

    return resp.data;
  } catch (error) {
    console.error(error);
  }
}
