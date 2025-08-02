import type { track } from '@aklapper/chinook-client';
import type { DataGridClientPagination } from '@aklapper/types';
import { type ReactElement } from 'react';
import { useFetcher, useLoaderData, useParams } from 'react-router';
import type { CRUD_LoaderPromise } from '../../../types/types';
import CrudElement from '../crud_entry';
import DataGridHeader from '../data_grid_header';
import AddTrack from './add-track';
import TracksDataGrid from './data_grid';

/**
 * This component renders a page displaying a list of tracks for a specific album.
 * It includes functionality for adding, updating, and deleting tracks.
 *
 * @returns {ReactElement} The rendered Tracks component.
 */

const Tracks = (): ReactElement => {
  const { loader } = useLoaderData<CRUD_LoaderPromise<DataGridClientPagination<track[]>>>();
  const { albumID } = useParams() as { albumID: string };
  const fetcher = useFetcher<track>();

  return (
    <CrudElement<track, DataGridClientPagination<track[]>>
      crudElement='tracks'
      loader={loader}
      Header={<DataGridHeader title='Album Tracks' />}
      NewEntry={<AddTrack albumID={albumID} fetcher={fetcher} />}
      DataGrid={<TracksDataGrid loader={loader} fetcher={fetcher} />}
    />
  );
};

export default Tracks;
