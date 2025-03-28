// import type { IPlayer } from '@aklapper/types';
import type { IPlayer } from '@aklapper/types';
import axios from 'axios';

const baseUrl = import.meta.env.VITE_REST_API_SERVER_URL_V2;

export default async function loadLobbyData(): Promise<IPlayer[] | void> {
  try {
    const resp = await axios.get(`${baseUrl}/lobby`);

    const lobbyData = resp.data as IPlayer[];
    return lobbyData ?? [];
  } catch (error) {
    console.error(error);
  }
}
