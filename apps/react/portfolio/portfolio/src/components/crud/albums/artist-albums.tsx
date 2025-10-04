import type { album } from '@aklapper/chinook-client';
import { CenteredFlexDiv } from '@aklapper/react-shared';
import type { DataGridClientPagination } from '@aklapper/types';
import Box from '@mui/material/Box';
import { type ReactElement } from 'react';
import { Outlet, useFetcher, useLoaderData } from 'react-router';
import Theme from '../../../styles/themes/theme';
import type { CRUD_LoaderPromise } from '../../../types/types';
import CrudElement from '../crud_entry';
import DataGridHeader from '../data_grid_header';
import AddAlbumOnArtist from './add-album-on-artist';
import AlbumDataGrid from './data_grid';

// export interface AlbumState {
//   albumTitle: string;
//   albumID: number;
// }

/**
 * This component renders a page displaying a list of albums for a specific artist.
 * It includes functionality for adding, updating, deleting, and viewing the tracks of each album.
 *
 * @returns {ReactElement} The rendered AlbumsOnArtist component.
 */

export const AlbumsOnArtist = (): ReactElement => {
  const { loader } = useLoaderData<CRUD_LoaderPromise<DataGridClientPagination<album[]>>>();
  const fetcher = useFetcher();

  return (
    <CenteredFlexDiv
      sx={{
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        padding: 0,
        gap: Theme.spacing(4),
        width: '100%',
      }}
    >
      <CrudElement<album, DataGridClientPagination<album[]>>
        crudElement='artist-albums'
        loader={loader}
        Header={<DataGridHeader title='Artist Albums' />}
        NewEntry={<AddAlbumOnArtist fetcher={fetcher} />}
        DataGrid={<AlbumDataGrid promise={loader} fetcher={fetcher} />}
      />
      <Box sx={{ width: '100%' }}>
        <Outlet />
      </Box>
    </CenteredFlexDiv>
  );
};
export default AlbumsOnArtist;
