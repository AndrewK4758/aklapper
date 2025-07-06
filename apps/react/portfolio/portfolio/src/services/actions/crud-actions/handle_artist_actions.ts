import type { artist } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse } from '@aklapper/types';
import axios from 'axios';
import type { ActionFunction, ActionFunctionArgs } from 'react-router';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const handleArtistActions: ActionFunction = async ({ request }: ActionFunctionArgs): Promise<artist | void> => {
  try {
    const data = await request.json();

    switch (data.intent) {
      case 'create': {
        const name = data.name;

        const resp = await axios.post(
          `${baseURL}/artists`,
          { name: name },
          { headers: { 'Content-Type': 'application/json' } },
        );

        const { value } = resp.data as CRUD_ApiResponse<artist>;

        console.log(value);
        return value;
      }
      case 'update': {
        const { artist_id, name } = data;
        const resp = await axios.patch(
          `${baseURL}/artists`,
          { artist_id, name },
          { headers: { 'Content-Type': 'application/json' } },
        );

        console.log(resp.data);

        return resp.data;
      }

      case 'delete': {
        const { artist_id } = data;
        const resp = await axios.delete(`${baseURL}/artists/${artist_id}`, {
          headers: { 'Content-Type': 'application/json' },
        });

        console.log(resp.data);
        return resp.data;
      }
      default:
        break;
    }
  } catch (error) {
    console.error(error);
  }
};

export default handleArtistActions;
