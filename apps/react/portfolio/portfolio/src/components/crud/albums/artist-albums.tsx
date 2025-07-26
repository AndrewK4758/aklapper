import type { album } from '@aklapper/chinook-client';
import { CenteredFlexDiv, Waiting } from '@aklapper/react-shared';
import type { DataGridClientPagination } from '@aklapper/types';
import Box from '@mui/material-pigment-css/Box';
import Container from '@mui/material-pigment-css/Container';
import { css } from '@pigment-css/react';
import { Suspense, type ReactElement } from 'react';
import { Await, Outlet, useFetcher, useLoaderData } from 'react-router';
import waiting from '../../../assets/images/swirly-dots-to-chrome.webp';
import Theme from '../../../styles/themes/theme';
import type { CRUD_LoaderPromise } from '../../../types/types';
import DataGridHeader from '../data_grid_header';
import AddAlbumOnArtist from './add-album-on-artist';
import AlbumDataGrid from './data_grid';

export interface AlbumState {
  albumTitle: string;
  albumID: number;
}

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
    <CenteredFlexDiv id='albums-on-artist' className={css({ padding: 0, width: '100%' })}>
      <Box
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: Theme.spacing(4),
          backgroundColor: 'transparent',
          width: '100%',
        })}
      >
        <Box
          id={'albums'}
          className={css({
            flex: 1,
            gap: Theme.spacing(4),
            borderRadius: Theme.shape.borderRadius,
            maxWidth: '100%',
            backgroundColor: Theme.palette.background.paper,
          })}
        >
          <DataGridHeader title='Artist Albums' />
          <Container id={'add-album-box'}>
            <AddAlbumOnArtist fetcher={fetcher} />
          </Container>
        </Box>
        <Suspense fallback={<Waiting src={waiting} />}>
          <Await resolve={loader} errorElement={<>ERROR LOADING</>}>
            <Box className={css({ width: '100%', height: '100%' })}>
              <AlbumDataGrid promise={loader} fetcher={fetcher} />
            </Box>
          </Await>
        </Suspense>
      </Box>
      <Box className={css({ width: '100%' })}>
        <Outlet />
      </Box>
    </CenteredFlexDiv>
  );
};
export default AlbumsOnArtist;
