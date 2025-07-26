import type { artist } from '@aklapper/chinook-client';
import type { DataGridServerPagination } from '@aklapper/types';
import axios from 'axios';
import type { LoaderFunction, LoaderFunctionArgs } from 'react-router';
import type { CRUD_LoaderPromise } from '../../../types/types';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const loadArtistsCount: LoaderFunction = ({
  request,
}: LoaderFunctionArgs): CRUD_LoaderPromise<DataGridServerPagination<artist[]>> | void => {
  try {
    const { search } = new URL(request.url);

    const resp = axios.get<DataGridServerPagination<artist[]>>(`${baseURL}/artists${search}`).then(resp => resp.data);

    return { loader: resp };
  } catch (error) {
    console.error(error);
  }
};

export default loadArtistsCount;
