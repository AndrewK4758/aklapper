import type { album } from '@aklapper/chinook-client';
import { Waiting } from '@aklapper/react-shared';
import Box from '@mui/material-pigment-css/Box';
import Container from '@mui/material-pigment-css/Container';
import { Suspense, useState, type ReactElement } from 'react';
import { Outlet } from 'react-router';
import waiting from '../../../assets/images/swirly-dots-to-chrome.webp';
import { artistsSxProps } from '../../../styles/crud/data_grid';
import Theme from '../../../styles/themes/theme';
import CenteredFlexDiv from '../../styled/centered_flexbox';
import DataGridHeader from '../data_grid_header.js';
import AddAlbumOnArtist from './add-album-on-artist.jsx';
import AlbumDataGrid from './album_data_grid';

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
  const [rows, setRows] = useState<album[] | null>(null);

  console.log(rows);

  return (
    <CenteredFlexDiv id='albums-on-artist' sx={{ padding: 0, width: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: Theme.spacing(4),
          backgroundColor: 'transparent',
          width: '100%',
        }}
      >
        <Box id={'albums'} sx={artistsSxProps}>
          <DataGridHeader title='Artist Albums' />
          <Container id={'add-album-box'}>
            <AddAlbumOnArtist setRows={setRows} />
          </Container>
        </Box>
        <Box sx={{ width: '100%' }}>
          <AlbumDataGrid rows={rows} setRows={setRows} />
        </Box>
      </Box>
      <Box sx={{ width: '100%' }}>
        <Suspense fallback={<Waiting src={waiting} />}>
          <Outlet />
        </Suspense>
      </Box>
    </CenteredFlexDiv>
  );
};
export default AlbumsOnArtist;
