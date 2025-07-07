import type { artist } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse } from '@aklapper/types';
import axios from 'axios';
import type { ActionFunction, ActionFunctionArgs } from 'react-router';
import type { ArtistSubmitAction } from '../../../types/types';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const handleArtistActions: ActionFunction = async ({ request }: ActionFunctionArgs): Promise<artist | void> => {
  try {
    const submit = (await request.json()) as ArtistSubmitAction;

    switch (submit.intent) {
      case 'create': {
        const {
          artist: { name },
        } = submit;

        const resp = await axios.post(
          `${baseURL}/artists`,
          { name: name },
          { headers: { 'Content-Type': 'application/json' } },
        );

        const { message, data } = resp.data as CRUD_ApiResponse<artist>;

        console.log(message);
        return data;
      }
      case 'update': {
        const {
          artist: { artist_id, name },
        } = submit;
        const resp = await axios.patch(
          `${baseURL}/artists`,
          { artist_id, name },
          { headers: { 'Content-Type': 'application/json' } },
        );

        const { message, data } = resp.data as CRUD_ApiResponse<artist>;

        console.info(message);

        return data;
      }

      case 'delete': {
        const {
          artist: { artist_id },
        } = submit;
        const resp = await axios.delete(`${baseURL}/artists/${artist_id}`, {
          headers: { 'Content-Type': 'application/json' },
        });

        const { message, data } = resp.data as CRUD_ApiResponse<artist>;

        console.info(message);

        return data;
      }
      default:
        break;
    }
  } catch (error) {
    console.error(error);
  }
};

export default handleArtistActions;
