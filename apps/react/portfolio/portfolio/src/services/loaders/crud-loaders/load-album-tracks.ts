import type { track } from '@aklapper/chinook-client';
import type { DataGridClientPagination } from '@aklapper/types';
import axios from 'axios';
import type { LoaderFunction, LoaderFunctionArgs } from 'react-router';
import type { CRUD_LoaderPromise } from '../../../types/types';

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const loadAlbumTracks: LoaderFunction = function ({
  params,
}: LoaderFunctionArgs): CRUD_LoaderPromise<DataGridClientPagination<track[]>> | void {
  try {
    const { albumID } = params;

    const resp = axios
      .get<DataGridClientPagination<track[]>>(`${baseURL}/tracks?albumID=${albumID}`, {
        headers: { 'Content-Type': 'text/plain' },
      })
      .then(resp => resp.data);

    return { loader: resp };
  } catch (error) {
    console.error(error);
  }
};

export default loadAlbumTracks;
