import type { artist } from '@aklapper/chinook-client';
import { Waiting } from '@aklapper/react-shared';
import Box from '@mui/material-pigment-css/Box';
import Container from '@mui/material-pigment-css/Container';
import { type ReactElement, Suspense } from 'react';
import { Outlet, useFetcher, useLoaderData } from 'react-router';
import waiting from '../../../assets/images/swirly-dots-to-chrome.webp';
import { artistsSxProps } from '../../../styles/crud/data_grid';
import Theme from '../../../styles/themes/theme';
import { ArtistLoader } from '../../../types/types';
import CenteredFlexDiv from '../../styled/centered_flexbox';
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
  const COUNT = useLoaderData() as number;
  const [rows, setRows] = useState<artist[] | null>(null);
  const [rowCountState, setRowCountState] = useState(COUNT);

  return (
    <CenteredFlexDiv
      className={css({
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        padding: 0,
        gap: Theme.spacing(4),
        border: 2,
        width: '100%',
      })}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: Theme.spacing(4), flex: '0 1 100%' }}>
        <Box id='artists' sx={artistsSxProps}>
          <DataGridHeader title='Artist List' />
          <Container id={'add-artist-box'}>
            <AddArtist COUNT={count} fetcher={fetcher} />
          </Container>
        </Box>
        <Box>
          <ArtistDataGrid rows={data} COUNT={count} fetcher={fetcher} />
        </Box>
      </Box>
      <Suspense fallback={<Waiting src={waiting} />}>
        <Box sx={{ flex: '0 1 50%' }}>
          <Outlet />
        </Suspense>
      </Box>
    </CenteredFlexDiv>
  );
};
export default Artist;
