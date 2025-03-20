import axios from 'axios';
import { LoaderFunction } from 'react-router';

const baseURL = import.meta.env.VITE_REST_API_SERVER_URL;
const loadGameList: LoaderFunction = async () => {
  const resp = await axios.get(`${baseURL}/games`);

  return resp.data;
};

export default loadGameList;
