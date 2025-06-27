import type { album } from '@aklapper/chinook-client';
import { Waiting } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { Suspense, useState, type ReactElement } from 'react';
import { Outlet } from 'react-router';
import waiting from '../../../assets/images/swirly-dots-to-chrome.webp';
import { allDataGridsWrapperSxProps, artistOutletWrapperSxProps, artistsSxProps } from '../../../styles/crud/data_grid';
import Theme from '../../../styles/themes/theme';
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
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: Theme.spacing(4), flex: '0 1 50%' }}>
        <Box id='album-box' sx={artistsSxProps}>
          <DataGridHeader title='Album List' />
          <Container id={'add-album-box'} sx={{ paddingY: 0 }}>
            <AddAlbum setRows={setRows} />
          </Container>
          <AlbumBaseDataGrid rows={rows} setRows={setRows} />
        </Box>
      </Box>
      <Box id='tracks-on-album-box' sx={artistOutletWrapperSxProps}>
        <Suspense fallback={<Waiting src={waiting} />}>
          <Outlet />
        </Suspense>
      </Box>
    </CenteredFlexDiv>
  );
};
export default Album;
