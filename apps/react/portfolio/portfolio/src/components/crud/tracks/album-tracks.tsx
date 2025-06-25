import { track } from '@aklapper/chinook-client';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { useState, type ReactElement } from 'react';
import { useParams } from 'react-router';
import CRUD_THEME from '../../../styles/themes/crud_theme.js';
import CenteredFlexDiv from '../../styled/centered_flexbox.js';
import DataGridHeader from '../data_grid_header.js';
import AddTrack from './add-track.jsx';
import TracksDataGrid from './track_data_grid.js';

/**
 * This component renders a page displaying a list of tracks for a specific album.
 * It includes functionality for adding, updating, and deleting tracks.
 *
 * @returns {ReactElement} The rendered Tracks component.
 */

const Tracks = (): ReactElement => {
  const { albumID } = useParams() as { albumID: string };
  const [rows, setRows] = useState<track[] | null>(null);

  return (
    <CenteredFlexDiv
      id={'track-box'}
      sx={{
        width: '100%',
        height: '100%',
        p: 0,
        border: `3px solid ${"var(--main-secondary-CRUD_THEME-palette)"}`,
        borderRadius: 1,
      }}
      style={{
        "--main-secondary-CRUD_THEME-palette": CRUD_THEME.palette.secondary.main
      }}>
      <Box key={'artist-title'} sx={{ height: '100%', width: '100%' }}>
        <DataGridHeader title='Album Tracks' />

        <Container component={'div'} key={'add-track-box'} sx={{ paddingY: 1 }}>
          <AddTrack albumID={albumID} setRows={setRows} />
        </Container>
        <TracksDataGrid rows={rows} setRows={setRows} />
      </Box>
    </CenteredFlexDiv>
  );
};

export default Tracks;
