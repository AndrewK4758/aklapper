import type { album } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse, DataGridLoader } from '@aklapper/types';
import axios from 'axios';
import type { LoaderFunction, LoaderFunctionArgs } from 'react-router';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const loadAlbumsForArtist: LoaderFunction = async ({
  params,
}: LoaderFunctionArgs): Promise<DataGridLoader<album[]> | void> => {
  try {
    const { artistID } = params;

    const resp = await axios.get(`${baseURL}/artist/${artistID}`);

    const { message, data } = resp.data as CRUD_ApiResponse<album[]>;
    console.log(message);

    return { data };
  } catch (error) {
    console.error(error);
  }
};

export default loadAlbumsForArtist;
