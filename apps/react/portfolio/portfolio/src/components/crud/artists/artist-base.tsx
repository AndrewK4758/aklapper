import type { artist } from '@aklapper/chinook-client';
// import { CenteredFlexDiv } from '@aklapper/react-shared';
import type { DataGridServerPagination } from '@aklapper/types';
import { css } from '@mui/material-pigment-css';
import Box from '@mui/material-pigment-css/Box';
import { type ReactElement } from 'react';
import { Outlet, useFetcher, useLoaderData } from 'react-router';
import Theme from '../../../styles/themes/theme';
import type { CRUD_LoaderPromise } from '../../../types/types';
import CrudElement from '../crud_entry';
import DataGridHeader from '../data_grid_header';
import AddArtist from './add-artist';
import ArtistDataGrid from './data_grid';

/**
 * This component renders a page displaying a list of artists.
 * It includes functionality for adding, updating, deleting, and viewing the albums of each artist.
 *
 * @returns {ReactElement} The rendered Artist component.
 */

const Artist = (): ReactElement => {
  const { loader } = useLoaderData<CRUD_LoaderPromise<DataGridServerPagination<artist[]>>>();
  const fetcher = useFetcher();

  return (
    <Box
      className={css({
        display: 'flex',
        gap: Theme.spacing(4),
      })}
    >
      <Box className={css({ flex: '1 0 50%' })}>
        <CrudElement<artist, DataGridServerPagination<artist[]>>
          crudElement='artists'
          loader={loader}
          Header={<DataGridHeader title='Artist List' />}
          NewEntry={<AddArtist promise={loader} fetcher={fetcher} />}
          DataGrid={<ArtistDataGrid promise={loader} fetcher={fetcher} />}
        />
      </Box>
      <Box className={css({ flex: '1 0 50%', display: 'flex' })}>
        <Outlet />
      </Box>
    </Box>
  );
};
export default Artist;
