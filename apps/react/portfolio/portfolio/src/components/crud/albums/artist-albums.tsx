import { Waiting } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { Suspense, type ReactElement } from 'react';
import { Outlet } from 'react-router';
import waiting from '../../../assets/images/swirly-dots-to-chrome.webp';
import CenteredFlexDiv from '../../styled/centered_flexbox.js';
import { artistsSxProps } from '../artists/artist-base.js';
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
  return (
    <CenteredFlexDiv id='albums-on-artist' sx={{ ...artistsSxProps, p: 0 }}>
      <Box id={'albums'} sx={{ height: '100%', width: '100%' }}>
        <DataGridHeader title='Artist Albums' />
        <Container id={'add-album-box'} sx={{ paddingY: 1 }}>
          <AddAlbumOnArtist />
        </Container>
        <AlbumDataGrid />
      </Box>

      <Suspense fallback={<Waiting src={waiting} />}>
        <Outlet />
      </Suspense>
    </CenteredFlexDiv>
  );
};

export default AlbumsOnArtist;
