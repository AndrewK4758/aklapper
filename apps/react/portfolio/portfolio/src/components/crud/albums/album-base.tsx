import { Text, useScrollIntoView } from '@aklapper/react-shared';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DetailsIcon from '@mui/icons-material/Details';
import UploadIcon from '@mui/icons-material/Upload';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  DataGrid,
  GridActionsCellItem,
  GridToolbar,
  useGridApiRef,
  type GridColDef,
  type GridRowParams,
} from '@mui/x-data-grid';
import type { GridApiCommunity } from '@mui/x-data-grid/internals';
import { useEffect, useRef, useState, type JSX } from 'react';
import { Outlet, useLoaderData, useNavigate, useOutletContext } from 'react-router';
import useFetchDataGridData from '../../../hooks/useFetchDataGridData.jsx';
import handleDeleteAlbum from '../../../services/events/crud-events/handle-delete-album.jsx';
import handleUpdateAlbumTitle from '../../../services/events/crud-events/handle-update-album-title.jsx';
import loadAlbums from '../../../services/loaders/crud-loaders/load-albums.jsx';
import { dataGridStyleUpdate } from '../../../styles/crud-styles.jsx';
import type { album } from '../../../types/prisma_types.js';
import type { OutletContextProps } from '../../../types/types.jsx';
import AddAlbum from './add-album.jsx';

const paginationModelInit = {
  pageSize: 25,
  page: 0,
};

/**
 * This component renders a page displaying a list of albums.
 * It includes functionality for adding, updating, deleting, and viewing the tracks of each album.
 *
 * @returns {JSX.Element} The rendered Album component.
 */

const Album = (): JSX.Element => {
  const COUNT = useLoaderData() as number;
  const [albums, setAlbums] = useState<album[]>();
  const [rowCountState, setRowCountState] = useState(COUNT);
  const { setLoading } = useOutletContext<OutletContextProps>();
  const [paginationModel, setPaginationModel] = useState(paginationModelInit);
  const matchesSize = useMediaQuery('(max-width:1200px)');
  const divRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  const apiRef = useGridApiRef<GridApiCommunity>();

  useFetchDataGridData<album[] | undefined>(paginationModel, setAlbums, loadAlbums);

  useScrollIntoView(divRef);

  useEffect(() => {
    if (apiRef.current) setLoading(false);
  }, [apiRef.current]);

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
    <Box
      component={'div'}
      ref={divRef}
      key={'all-albums-box'}
      id='all-albums-box'
      display={'flex'}
      flexDirection={matchesSize ? 'column' : 'row'}
      gap={0.5}
    >
      <Box
        component={'div'}
        key={'album-box'}
        id='album-box'
        sx={{
          flexWrap: 'wrap',
          flex: matchesSize ? '1 0 100%' : '1 0 50%',
          border: '3px solid purple',
          borderRadius: 1,
        }}
      >
        <Container key={'albums-title-wrapper'} component={'section'} id='album-title-wrapper' sx={{ paddingY: 2 }}>
          <Paper key={'album-title-bar'} id='album-title-bar' component={'div'} sx={{ height: 'fit-content' }}>
            <Text
              component={'h3'}
              titleText={'Album List'}
              titleVariant={'h3'}
              id='albums-title'
              sx={{
                textAlign: 'center',
              }}
            />
          </Paper>
        </Container>
        <Container component={'div'} key={'add-album-box'} id={'add-album-box'} sx={{ paddingY: 1 }}>
          <AddAlbum apiRef={apiRef} />
        </Container>
        <Paper component={'div'} key={'all-albums-datagrid'} id='all-albums-datagrid' sx={{ borderRadius: 1 }}>
          <DataGrid
            logLevel='info'
            key={'album-data-grid'}
            aria-label='album-data-grid'
            autosizeOnMount={true}
            apiRef={apiRef}
            columns={columns}
            rows={albums}
            getRowId={getID}
            rowCount={rowCountState}
            getRowHeight={() => 'auto'}
            pageSizeOptions={[10, 25, 50, 100]}
            paginationMode='server'
            onRowCountChange={newRowCount => setRowCountState(newRowCount)}
            onPaginationModelChange={setPaginationModel}
            paginationModel={paginationModel}
            sx={dataGridStyleUpdate}
            slots={{ toolbar: GridToolbar }}
            slotProps={{
              pagination: {
                slotProps: {
                  select: {
                    slotProps: {
                      input: { id: 'album-pagination-page-numbers' },
                    },
                  },
                },
              },
            }}
          />
        </Paper>
      </Box>
      <Box
        key={'tracks-on-album-box'}
        component={'div'}
        id='tracks-on-album-box'
        flex={matchesSize ? '0 1 100%' : '0 1 50%'}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default Album;
