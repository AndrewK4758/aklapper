import type { track } from '@aklapper/chinook-client';
import { CenteredFlexDiv, Waiting } from '@aklapper/react-shared';
import type { DataGridLoader } from '@aklapper/types';
import Box from '@mui/material-pigment-css/Box';
import Container from '@mui/material-pigment-css/Container';
import { css } from '@pigment-css/react';
import { Suspense, type ReactElement } from 'react';
import { useFetcher, useLoaderData, useParams } from 'react-router';
import waiting from '../../../assets/images/swirly-dots-to-chrome.webp';
import Theme from '../../../styles/themes/theme';
import DataGridHeader from '../data_grid_header';
import AddTrack from './add-track';
import TracksDataGrid from './data_grid';

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
      className={css({
        padding: 0,
      })}
    >
      <Box
        className={css({
          gap: Theme.spacing(4),
          borderRadius: Theme.shape.borderRadius,
          background: Theme.palette.background.paper,
          width: '100%',
        })}
      >
        <DataGridHeader title='Album Tracks' />
        <Container component={'div'} className={css({ padding: '1 0' })}>
          <AddTrack albumID={albumID} fetcher={fetcher} />
        </Container>
      </Box>
      <Box className={css({ width: '100%' })}>
        <Box>
          <Suspense fallback={<Waiting src={waiting} />}>
            <TracksDataGrid rows={data} fetcher={fetcher} />
          </Suspense>
        </Box>
      </Box>
    </CenteredFlexDiv>
  );
};

export default Tracks;
