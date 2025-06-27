import { track } from '@aklapper/chinook-client';
import Box from '@mui/material-pigment-css/Box';
import Container from '@mui/material-pigment-css/Container';
import { useState, type ReactElement } from 'react';
import { useParams } from 'react-router';
import Theme from '../../../styles/themes/theme';
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
        padding: 0,
      }}
    >
      <Box
        sx={{
          gap: Theme.spacing(4),
          borderRadius: Theme.shape.borderRadius,
          background: Theme.palette.background.paper,
          width: '100%',
        }}
      >
        <DataGridHeader title='Album Tracks' />
        <Container component={'div'} key={'add-track-box'} sx={{ paddingY: 1 }}>
          <AddTrack albumID={albumID} setRows={setRows} />
        </Container>
      </Box>
      <Box sx={{ width: '100%' }}>
        <Box>
          <TracksDataGrid rows={rows} setRows={setRows} />
        </Box>
      </Box>
    </CenteredFlexDiv>
  );
};

export default Tracks;
