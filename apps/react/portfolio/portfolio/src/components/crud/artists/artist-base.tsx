import type { artist } from '@aklapper/chinook-client';
import { CenteredFlexDiv, Waiting } from '@aklapper/react-shared';
import type { DataGridLoader } from '@aklapper/types';
import { css } from '@mui/material-pigment-css';
import Box from '@mui/material-pigment-css/Box';
import Container from '@mui/material-pigment-css/Container';
import { type ReactElement, Suspense } from 'react';
import { Outlet, useFetcher, useLoaderData } from 'react-router';
import waiting from '../../../assets/images/swirly-dots-to-chrome.webp';
import Theme from '../../../styles/themes/theme';
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
  const { count, data } = useLoaderData<DataGridLoader<artist[]>>();
  const fetcher = useFetcher();

  return (
    <CenteredFlexDiv
      className={css({
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        padding: 0,
        gap: Theme.spacing(4),
        width: '100%',
      })}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: Theme.spacing(4), flex: '0 1 100%' }}>
        <Box
          id='artists'
          className={css({
            flex: 1,
            gap: Theme.spacing(4),
            borderRadius: Theme.shape.borderRadius,
            maxWidth: '100%',
            backgroundColor: Theme.palette.background.paper,
          })}
        >
          <DataGridHeader title='Artist List' />
          <Container id={'add-artist-box'}>
            <AddArtist COUNT={count as number} fetcher={fetcher} />
          </Container>
        </Box>
        <Box>
          <Suspense fallback={<Waiting src={waiting} />}>
            <Box>
              <ArtistDataGrid rows={data} COUNT={count as number} fetcher={fetcher} />
            </Box>
          </Suspense>
        </Box>
      </Box>
      <Box className={css({ flex: '0 1 100%' })}>
        <Outlet />
      </Box>
    </CenteredFlexDiv>
  );
};
export default Artist;
