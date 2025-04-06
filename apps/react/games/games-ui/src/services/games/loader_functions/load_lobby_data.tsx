import type { ClientLobbyData } from '@aklapper/types';
import axios from 'axios';

const baseUrl = import.meta.env.VITE_REST_API_SERVER_URL_V2;

export default async function loadLobbyData(): Promise<ClientLobbyData | void> {
  try {
    const resp = await axios.get(`${baseUrl}/lobby`);

    const lobbyData = resp.data as ClientLobbyData;

    console.log(lobbyData);
    return lobbyData;
  } catch (error) {
    console.error(error);
  }
}
