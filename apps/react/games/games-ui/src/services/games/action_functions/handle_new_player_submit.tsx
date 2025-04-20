import type { IPlayerClientData } from '@aklapper/types';
import axios from 'axios';
import type { ActionFunctionArgs } from 'react-router';

const baseUrl = import.meta.env.VITE_REST_API_SERVER_URL_V2;

export default async function handleNewPlayerSubmit({
  request,
}: ActionFunctionArgs): Promise<Partial<IPlayerClientData> | void> {
  try {
    const { name } = await request.json();

    const resp = await axios.post(
      `${baseUrl}/register`,
      { name: name },
      { headers: { 'Content-Type': 'application/json' } },
    );

    const { id, inLobby, email, activeGameID, currentTimeEntered } = resp.data as Partial<IPlayerClientData>;

    const currentPlayer = {
      name: name,
      id: id,
      activeGameID: activeGameID,
      inLobby: inLobby,
      email: email,
      currentTimeEntered: currentTimeEntered,
    };

    localStorage.setItem('playerID', id as string);

    return currentPlayer;
  } catch (error) {
    console.error(error);
  }
}
