import axios from 'axios';

const baseUrl = import.meta.env.VITE_REST_API_SERVER_URL_V2;

export default async function loadLobbyData() {
  try {
    const resp = await axios.get(`${baseUrl}/lobby`);

    return resp.data;
  } catch (error) {
    console.error(error);
  }
}
