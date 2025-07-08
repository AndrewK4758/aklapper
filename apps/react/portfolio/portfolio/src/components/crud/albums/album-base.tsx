import type { album } from '@aklapper/chinook-client';
import { Waiting } from '@aklapper/react-shared';
import type { DataGridLoader } from '@aklapper/types';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { css } from '@pigment-css/react';
import { Suspense, type ReactElement } from 'react';
import { Outlet, useFetcher, useLoaderData } from 'react-router';
import waiting from '../../../assets/images/swirly-dots-to-chrome.webp';
import { artistsSxProps } from '../../../styles/crud/data_grid';
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
  const { count, data } = useLoaderData<DataGridLoader<album[]>>();
  const fetcher = useFetcher();

  return (
    <CenteredFlexDiv
      id='albums'
      className={css({
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        padding: 0,
        gap: Theme.spacing(4),
        width: '100%',
      })}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: Theme.spacing(4),
          flex: '0 1 50%',
          backgroundColor: 'transparent',
        }}
      >
        <Box id='album-box' sx={artistsSxProps}>
          <DataGridHeader title='Album List' />
          <Container id={'add-album-box'}>
            <AddAlbum fetcher={fetcher} />
          </Container>
        </Box>
        <Box>
          <AlbumBaseDataGrid rows={data} count={count as number} submit={fetcher.submit} />
        </Box>
      </Box>
      <Box id='tracks-on-album-box' sx={{ flex: '0 1 50%' }}>
        <Suspense fallback={<Waiting src={waiting} />}>
          <Outlet />
        </Suspense>
      </Box>
    </CenteredFlexDiv>
  );
};
export default Album;
