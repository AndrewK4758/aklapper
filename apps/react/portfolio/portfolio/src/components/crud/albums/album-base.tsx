import { Waiting } from '@aklapper/react-shared';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DetailsIcon from '@mui/icons-material/Details';
import UploadIcon from '@mui/icons-material/Upload';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { DataGrid, GridActionsCellItem, useGridApiRef, type GridColDef, type GridRowParams } from '@mui/x-data-grid';
import { type GridApiCommunity } from '@mui/x-data-grid/internals';
import { Suspense, useState, type ReactElement } from 'react';
import { Outlet, useLoaderData, useNavigate } from 'react-router';
import waiting from '../../../assets/images/swirly-dots-to-chrome.webp';
import useFetchDataGridData from '../../../hooks/useFetchDataGridData';
import handleDeleteAlbum from '../../../services/events/crud-events/handle-delete-album';
import handleUpdateAlbumTitle from '../../../services/events/crud-events/handle-update-album-title';
import loadAlbums from '../../../services/loaders/crud-loaders/load-albums';
import type { album } from '../../../types/prisma_types';
import CenteredFlexDiv from '../../styled/centered_flexbox';
import { allDataGridsWrapperSxProps, artistOutletWrapperSxProps, artistsSxProps } from '../artists/artist-base';
import DataGridHeader from '../data_grid_header';
import AddAlbum from './add-album';

const paginationModelInit = {
  pageSize: 25,
  page: 0,
};

/**
 * This component renders a page displaying a list of albums.
 * It includes functionality for adding, updating, deleting, and viewing the tracks of each album.
 *
 * @returns {ReactElement} The rendered Album component.
 */

const Album = (): ReactElement => {
  const COUNT = useLoaderData() as number;
  const [rowCountState, setRowCountState] = useState(COUNT);
  const [paginationModel, setPaginationModel] = useState(paginationModelInit);
  const nav = useNavigate();

  const apiRef = useGridApiRef<GridApiCommunity>();

  const { state } = useFetchDataGridData<album[] | null>(paginationModel, loadAlbums);

  const columns: GridColDef[] = [
    {
      field: 'album_id',
      headerName: 'Album ID',
      type: 'number',
      flex: 1,
      cellClassName: 'album-id',
    },
    {
      field: 'title',
      headerName: 'Title',
      type: 'string',
      flex: 3,
      editable: true,
      cellClassName: 'album-title',
    },
    {
      field: 'artist_id',
      headerName: 'Artist ID',
      type: 'number',
      flex: 1,
      cellClassName: 'artist-id',
    },
    {
      field: 'update-delete',
      type: 'actions',
      headerName: 'Update / Delete',
      flex: 2,
      getActions: (params: GridRowParams<album>) => {
        return [
          <GridActionsCellItem
            label='Update'
            icon={<UploadIcon color='success' />}
            title='Update'
            onClick={() => {
              handleUpdateAlbumTitle(params.row, apiRef);
            }}
          />,

          <GridActionsCellItem
            label='Delete'
            title='Delete'
            icon={<DeleteForeverIcon color='error' />}
            onClick={() => {
              handleDeleteAlbum(params.row, apiRef);
            }}
          />,
        ];
      },
    },
    {
      field: 'details',
      type: 'actions',
      headerName: 'Show Tracks',
      flex: 1,
      getActions: (params: GridRowParams) => {
        return [
          <GridActionsCellItem
            label='Tracks'
            title='Tracks'
            icon={<DetailsIcon color='info' />}
            onClick={() => nav(`${params.row.album_id}/tracks`, { replace: true })}
          />,
        ];
      },
    },
  ];

  const getID = (row: album) => row.album_id;

  return (
    <CenteredFlexDiv id='albums' sx={allDataGridsWrapperSxProps}>
      <Box id='album-box' sx={artistsSxProps}>
        <DataGridHeader title='Album List' />
        <Container id={'add-album-box'} sx={{ paddingY: 1 }}>
          <AddAlbum />
        </Container>
        <DataGrid
          logLevel='info'
          aria-label='album-data-grid'
          apiRef={apiRef}
          columns={columns}
          rows={state ?? []}
          getRowId={getID}
          rowCount={COUNT}
          getRowHeight={() => 'auto'}
          pageSizeOptions={[10, 25, 50, 100]}
          paginationMode='server'
          onRowCountChange={newRowCount => setRowCountState(newRowCount)}
          onPaginationModelChange={setPaginationModel}
          paginationModel={paginationModel}
        />
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
