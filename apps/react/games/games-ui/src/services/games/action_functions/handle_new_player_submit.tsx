import type { IPlayer } from '@aklapper/types';
import axios from 'axios';
import { ActionFunctionArgs } from 'react-router';

const baseUrl = import.meta.env.VITE_REST_API_SERVER_URL_V2;

export default async function handleNewPlayerSubmit({ request }: ActionFunctionArgs): Promise<Partial<IPlayer> | void> {
  try {
    const { name } = await request.json();

    const resp = await axios.post(
      `${baseUrl}/register`,
      { name: name },
      { headers: { 'Content-Type': 'application/json' } }
    );

    console.log('RESP DATA ', resp.data);

    const { Name, Id, ActiveGameID, InLobby } = resp.data as Partial<IPlayer>;

    const currentPlayer = { Name: Name, Id: Id, ActiveGameID: ActiveGameID, InLobby: InLobby };

    sessionStorage.setItem('activePlayer', JSON.stringify(currentPlayer));

    return currentPlayer;
  } catch (error) {
    console.error(error);
  }
}
