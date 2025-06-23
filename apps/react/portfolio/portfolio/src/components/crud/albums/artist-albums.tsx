import type { album } from '@aklapper/chinook-client';
import { Waiting } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { Suspense, useState, type ReactElement } from 'react';
import { Outlet } from 'react-router';
import { artistOutletWrapperSxProps, artistsSxProps } from '../../../styles/crud/data_grid';
import CRUD_THEME from '../../../styles/themes/crud_theme';
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

  return (
    <CenteredFlexDiv id='albums-on-artist' sx={{ ...artistsSxProps, p: 0, border: 0, gap: 0.5 }}>
      <Box
        id={'albums'}
        sx={{
          height: '100%',
          width: '100%',
          border: `3px solid ${CRUD_THEME.palette.secondary.main}`,
          borderRadius: Theme.shape.borderRadius,
        }}
      >
        <DataGridHeader title='Artist Albums' />
        <Container id={'add-album-box'} sx={{ paddingY: 1 }}>
          <AddAlbumOnArtist setRows={setRows} />
        </Container>
        <AlbumDataGrid rows={rows} setRows={setRows} />
      </Box>

      <Box sx={artistOutletWrapperSxProps}>
        <Suspense fallback={<Waiting src={'/client/images/swirly-dots-to-chrome.webp'} />}>
          <Outlet />
        </Suspense>
      </Box>
    </CenteredFlexDiv>
  );
};

export default AlbumsOnArtist;
