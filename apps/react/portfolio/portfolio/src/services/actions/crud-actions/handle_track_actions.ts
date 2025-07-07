import type { track } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse } from '@aklapper/types';
import axios from 'axios';
import type { ActionFunction, ActionFunctionArgs } from 'react-router';
import type { TrackSubmitAction } from '../../../types/types';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const handleTrackActions: ActionFunction = async function ({ params, request }: ActionFunctionArgs) {
  const submit = (await request.json()) as TrackSubmitAction;

  const { albumID } = params as { albumID: string };

  switch (submit.intent) {
    case 'update': {
      const { track } = submit;

      const resp = await axios.patch(
        `${baseURL}/tracks`,
        { trackData: track },
        { headers: { 'Content-Type': 'application/json' } },
      );

      const { message, data } = resp.data as CRUD_ApiResponse<track>;

      console.log(message);

      return data;
    }

    case 'create': {
      const {
        track: { name },
      } = submit;

      const resp = await axios.post(
        `${baseURL}/tracks`,
        { name: name, albumID: albumID },
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );

      const { message, data } = resp.data as CRUD_ApiResponse<track>;

      console.log(message);

      return data;
    }

    case 'delete': {
      const {
        track: { track_id },
      } = submit;

      const resp = await axios.delete(`${baseURL}/tracks/${track_id}`, {
        headers: { 'Content-Type': 'text/plain' },
      });

      const { message, data } = resp.data as CRUD_ApiResponse<track>;
      console.log(message);

      return data;
    }

    default: {
      return;
    }
  }
};

export default handleTrackActions;
