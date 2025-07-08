import type { album } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse, DataGridLoader } from '@aklapper/types';
import axios from 'axios';
import type { LoaderFunction, LoaderFunctionArgs } from 'react-router';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const loadAlbumsForArtistAndCount: LoaderFunction = async ({
  params,
  request,
}: LoaderFunctionArgs): Promise<DataGridLoader<album[]> | void> => {
  try {
    const url = new URL(request.url);

    const { search } = url;

    const { artistID } = params;

    const resp = await axios.get(`${baseURL}/artist/${artistID}${search}`);

    const { message, data, count } = resp.data as CRUD_ApiResponse<album[]>;

    console.log(message);

    return { data, count };
  } catch (error) {
    console.error(error);
  }
};

export default loadAlbumsForArtistAndCount;
