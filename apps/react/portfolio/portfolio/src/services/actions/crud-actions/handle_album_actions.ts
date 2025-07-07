import type { album } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse } from '@aklapper/types';
import axios from 'axios';
import type { ActionFunction, ActionFunctionArgs } from 'react-router';
import type { AlbumSubmitAction } from '../../../types/types.js';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const handleArtistAlbumsActions: ActionFunction = async ({
  request,
  params,
}: ActionFunctionArgs): Promise<album | void> => {
  try {
    const submit = (await request.json()) as AlbumSubmitAction;
    const { artistID } = params;

    switch (submit.intent) {
      case 'create': {
        const {
          album: { title },
        } = submit;

        const resp = await axios.post(
          `${baseURL}/albums`,
          { title, artistID },
          {
            headers: { 'Content-Type': 'application/json' },
          },
        );
        const { data, message } = resp.data as CRUD_ApiResponse<album>;

        console.info(message);

        return data;
      }

      case 'update': {
        const {
          album: { album_id, title },
        } = submit;
        const resp = await axios.patch(
          `${baseURL}/albums`,
          { albumID: album_id, title: title },
          {
            headers: { 'Content-Type': 'application/json' },
          },
        );

        const { data, message } = resp.data as CRUD_ApiResponse<album>;

        console.log(message);

        return data;
      }

      case 'delete': {
        const {
          album: { album_id },
        } = submit;

        const resp = await axios.delete(`${baseURL}/albums/${album_id}`, {
          headers: { 'Content-Type': 'text/plain' },
        });
        const { data, message } = resp.data as CRUD_ApiResponse<album>;

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

export default handleArtistAlbumsActions;
