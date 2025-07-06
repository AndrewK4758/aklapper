import type { album } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse } from '@aklapper/types';
import axios from 'axios';
import type { ActionFunction, ActionFunctionArgs } from 'react-router';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const handleArtistAlbumsActions: ActionFunction = async ({
  request,
  params,
}: ActionFunctionArgs): Promise<album | void> => {
  try {
    const data = await request.json();
    const { artistID } = params;

    switch (data.intent) {
      case 'create': {
        const { title } = data;

        const resp = await axios.post(
          `${baseURL}/albums`,
          { title, artistID },
          {
            headers: { 'Content-Type': 'application/json' },
          },
        );
        const { value } = resp.data as CRUD_ApiResponse<album>;

        return value;
      }

      case 'update': {
        const { album_id, title } = data;
        const resp = await axios.patch(
          `${baseURL}/albums`,
          { albumID: album_id, title: title },
          {
            headers: { 'Content-Type': 'application/json' },
          },
        );

        const { value, message } = resp.data as CRUD_ApiResponse<album>;

        console.log(message);

        return value;
      }

      case 'delete': {
        const { album_id } = data;

        const resp = await axios.delete(`${baseURL}/albums/${album_id}`, {
          headers: { 'Content-Type': 'text/plain' },
        });
        const { value } = resp.data as CRUD_ApiResponse<album>;

        return value;
      }
      default:
        break;
    }
  } catch (error) {
    console.error(error);
  }
};

export default handleArtistAlbumsActions;
