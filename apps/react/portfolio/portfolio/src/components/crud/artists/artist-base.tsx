import { Waiting } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import type { SxProps } from '@mui/material/styles';
import { type ReactElement, Suspense, useState } from 'react';
import { Outlet, useLoaderData } from 'react-router';
import waiting from '../../../assets/images/swirly-dots-to-chrome.webp';
import CRUD_THEME from '../../../styles/themes/crud_theme';
import CenteredFlexDiv from '../../styled/centered_flexbox';
import DataGridHeader from '../data_grid_header';
import AddArtist from './add-artist';
import ArtistDataGrid from './data_grid';

export const allDataGridsWrapperSxProps: SxProps = {
  flexDirection: 'row',
  alignItems: 'flex-start',
  justifyContent: 'stretch',
  [CRUD_THEME.breakpoints.down('lg')]: {
    flexDirection: 'column',
  },
  gap: 0.5,
};

export const artistsSxProps: SxProps = {
  flex: '0 1 100%',
  [CRUD_THEME.breakpoints.down('lg')]: {
    flex: '0 1 50%',
  },
  border: '3px solid purple',
  borderRadius: 1,
  maxWidth: '100%',
};

export const artistOutletWrapperSxProps: SxProps = {
  flex: '0 1 100%',
  [CRUD_THEME.breakpoints.down('lg')]: { flex: '0 1 50%' },
};

/**
 * This component renders a page displaying a list of artists.
 * It includes functionality for adding, updating, deleting, and viewing the albums of each artist.
 *
 * @returns {ReactElement} The rendered Artist component.
 */

const Artist = (): ReactElement => {
  const COUNT = useLoaderData() as number;
  const [rowCountState, setRowCountState] = useState(COUNT);

  console.log('rendered');

  return (
    <CenteredFlexDiv id='all-data-grids-wrapper' sx={allDataGridsWrapperSxProps}>
      <Box id='artists' sx={artistsSxProps}>
        <DataGridHeader title='Artist List' />
        <Container id={'add-artist-box'} sx={{ paddingY: 1 }}>
          <AddArtist rowCountState={rowCountState} setRowCountState={setRowCountState} COUNT={COUNT} />
        </Container>
        <ArtistDataGrid COUNT={COUNT} setRowCountState={setRowCountState} />
      </Box>
      <Suspense fallback={<Waiting src={waiting} />}>
        <Outlet />
      </Suspense>
    </CenteredFlexDiv>
  );
};

export default Artist;
