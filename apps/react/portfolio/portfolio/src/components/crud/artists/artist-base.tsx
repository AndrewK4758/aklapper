import type { artist } from '@aklapper/chinook-client';
import { Waiting } from '@aklapper/react-shared';

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { type ReactElement, Suspense, useState } from 'react';
import { Outlet, useLoaderData } from 'react-router';
import waiting from '../../../assets/images/swirly-dots-to-chrome.webp';
import { allDataGridsWrapperSxProps, artistsSxProps } from '../../../styles/crud/data_grid';
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
    <CenteredFlexDiv sx={allDataGridsWrapperSxProps}>
      <Box id='artists' sx={artistsSxProps}>
        <DataGridHeader title='Artist List' />
        <Container id={'add-artist-box'} sx={{ paddingY: 1 }}>
          <AddArtist
            rowCountState={rowCountState}
            setRowCountState={setRowCountState}
            COUNT={COUNT}
            setRows={setRows}
          />
        </Container>
        <ArtistDataGrid rows={rows} setRows={setRows} COUNT={rowCountState} setRowCountState={setRowCountState} />
      </Box>
      <Box flex={'0 1 50%'}>
        <Suspense fallback={<Waiting src={waiting} />}>
          <Outlet />
        </Suspense>
      </Box>
    </CenteredFlexDiv>
  );
};
export default Artist;
