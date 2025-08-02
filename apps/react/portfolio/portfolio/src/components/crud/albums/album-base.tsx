import type { album } from '@aklapper/chinook-client';
import type { DataGridServerPagination } from '@aklapper/types';
import Box from '@mui/material/Box';
import { css } from '@pigment-css/react';
import { type ReactElement } from 'react';
import { Outlet, useFetcher, useLoaderData } from 'react-router';
import Theme from '../../../styles/themes/theme';
import type { CRUD_LoaderPromise } from '../../../types/types';
import CrudElement from '../crud_entry';
import DataGridHeader from '../data_grid_header';
import AddAlbum from './add-album';
import AlbumBaseDataGrid from './album_base_data_grid';

/**
 * This component renders a page displaying a list of albums.
 * It includes functionality for adding, updating, deleting, and viewing the tracks of each album.
 *
 * @returns {ReactElement} The rendered Album component.
 */

const Album = (): ReactElement => {
  const { loader } = useLoaderData<CRUD_LoaderPromise<DataGridServerPagination<album[]>>>();
  const fetcher = useFetcher();

  return (
    <Box
      className={css({
        display: 'flex',
        gap: Theme.spacing(4),
      })}
    >
      <Box className={css({ flex: '1 0 50%' })}>
        <CrudElement<album, DataGridServerPagination<album[]>>
          crudElement='albums'
          loader={loader}
          Header={<DataGridHeader title='Album List' />}
          NewEntry={<AddAlbum fetcher={fetcher} />}
          DataGrid={<AlbumBaseDataGrid loader={loader} fetcher={fetcher} />}
        />
      </Box>
      <Box className={css({ flex: '1 0 50%', display: 'flex' })}>
        <Outlet />
      </Box>
    </Box>
  );
};
export default Album;
