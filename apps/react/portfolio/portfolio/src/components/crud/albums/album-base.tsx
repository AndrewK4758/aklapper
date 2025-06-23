import type { album } from '@aklapper/chinook-client';
import { Waiting } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { Suspense, useState, type ReactElement } from 'react';
import { Outlet } from 'react-router';
import { allDataGridsWrapperSxProps, artistOutletWrapperSxProps, artistsSxProps } from '../../../styles/crud/data_grid';
import CenteredFlexDiv from '../../styled/centered_flexbox';
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
  const [rows, setRows] = useState<album[] | null>(null);
  return (
    <CenteredFlexDiv id='albums' sx={allDataGridsWrapperSxProps}>
      <Box id='album-box' sx={artistsSxProps}>
        <DataGridHeader title='Album List' />
        <Container id={'add-album-box'} sx={{ paddingY: 1 }}>
          <AddAlbum setRows={setRows} />
        </Container>
        <AlbumBaseDataGrid rows={rows} setRows={setRows} />
      </Box>
      <Box id='tracks-on-album-box' sx={artistOutletWrapperSxProps}>
        <Suspense fallback={<Waiting src={'/client/images/swirly-dots-to-chrome.webp'} />}>
          <Outlet />
        </Suspense>
      </Box>
    </CenteredFlexDiv>
  );
};

export default Album;
