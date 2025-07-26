import type { album } from '@aklapper/chinook-client';
import type { DataGridClientPagination } from '@aklapper/types';
import axios from 'axios';
import type { LoaderFunction, LoaderFunctionArgs } from 'react-router';
import type { CRUD_LoaderPromise } from '../../../types/types';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const loadAlbumsForArtist: LoaderFunction = ({
  params,
}: LoaderFunctionArgs): CRUD_LoaderPromise<DataGridClientPagination<album[]>> | void => {
  try {
    const { artistID } = params;

    const resp = axios.get<DataGridClientPagination<album[]>>(`${baseURL}/artist/${artistID}`).then(resp => resp.data);

    return { loader: resp };
  } catch (error) {
    console.error(error);
  }
};

export default loadAlbumsForArtist;
