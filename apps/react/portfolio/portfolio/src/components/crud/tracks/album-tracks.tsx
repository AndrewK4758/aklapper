import { track } from '@aklapper/chinook-client';
import type { DataGridLoader } from '@aklapper/types';
import Box from '@mui/material-pigment-css/Box';
import Container from '@mui/material-pigment-css/Container';
import { type ReactElement } from 'react';
import { useFetcher, useLoaderData, useParams } from 'react-router';
import Theme from '../../../styles/themes/theme';
import CenteredFlexDiv from '../../styled/centered_flexbox.js';
import DataGridHeader from '../data_grid_header.js';
import AddTrack from './add-track.jsx';
import TracksDataGrid from './data_grid.js';

/**
 * This component renders a page displaying a list of tracks for a specific album.
 * It includes functionality for adding, updating, and deleting tracks.
 *
 * @returns {ReactElement} The rendered Tracks component.
 */

const Tracks = (): ReactElement => {
  const { data } = useLoaderData<DataGridLoader<track[]>>();
  const { albumID } = useParams() as { albumID: string };
  const fetcher = useFetcher<track>();

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
          <AddTrack albumID={albumID} fetcher={fetcher} />
        </Container>
      </Box>
      <Box sx={{ width: '100%' }}>
        <Box>
          <TracksDataGrid rows={data} fetcher={fetcher} />
        </Box>
      </Box>
    </CenteredFlexDiv>
  );
};

export default Tracks;
