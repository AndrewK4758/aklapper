import type { artist } from '@aklapper/chinook-client';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DetailsIcon from '@mui/icons-material/Details';
import UploadIcon from '@mui/icons-material/Upload';
import { Container, Paper } from '@mui/material';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import {
  DataGrid,
  GridActionsCellItem,
  type GridColDef,
  type GridPaginationModel,
  type GridRowParams,
  useGridApiRef,
} from '@mui/x-data-grid';
import type { GridApiCommunity } from '@mui/x-data-grid/internals';
import axios from 'axios';
import { type RefObject, useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useNavigate, useRouteLoaderData } from 'react-router';
import loadArtists from '../../services/loaders/load-artists';
import AddArtist from './add-artist';

const baseURL = import.meta.env.VITE_DATA_API_URL;

const paginationModelInit = {
  pageSize: 25,
  page: 0,
};

const Artist = () => {
  const COUNT = useRouteLoaderData('artist-count') as number;
  const [artists, setArtists] = useState<artist[]>();
  const [rowCountState, setRowCountState] = useState(COUNT);
  const [paginationModel, setPaginationModel] = useState(paginationModelInit);
  const nav = useNavigate();

  const apiRef = useGridApiRef();

  const queryOptions = useMemo(
    () => ({
      cursor: paginationModel.page === 0 ? 1 : paginationModel.pageSize * paginationModel.page,
      pageSize: paginationModel.pageSize,
      skip: paginationModel.page === 0 ? 0 : 1,
    }),
    [paginationModel],
  );

  const handlePaginationModelChange = (newPaginationModel: GridPaginationModel) => {
    setPaginationModel(newPaginationModel);
  };

  const fetchArtists = useCallback(
    (pageSize: number, skip: number, cursor: number) => loadArtists(pageSize, skip, cursor),
    [],
  );

  useEffect(() => {
    fetchArtists(queryOptions.pageSize, queryOptions.skip, queryOptions.cursor)
      .then(({ allArtists }) => setArtists(allArtists))
      .catch(err => console.error(err));
  }, [fetchArtists, queryOptions]);

  const columns: GridColDef[] = [
    {
      field: 'artist_id',
      headerName: 'Artist ID',
      type: 'number',
      flex: 1,
    },
    {
      field: 'name',
      headerName: 'Name',
      flex: 3,
      type: 'string',
      editable: true,
      filterable: true,
      headerClassName: 'artist-name',
    },
    {
      field: 'update-delete',
      type: 'actions',
      headerName: 'Update / Delete',
      flex: 2,
      getActions: (params: GridRowParams) => {
        return [
          <GridActionsCellItem
            label='Update'
            icon={<UploadIcon />}
            title='Update'
            onClick={() => handleUpdateArtistName(params.row, apiRef)}
          />,
          <GridActionsCellItem
            label='Delete'
            title='Delete'
            icon={<DeleteForeverIcon />}
            onClick={() => {
              handleDeleteArtist(params.row, apiRef);
            }}
          />,
        ];
      },
    },
    {
      field: 'details',
      type: 'actions',
      headerName: 'Show Albums',
      flex: 1,
      getActions: (params: GridRowParams) => {
        return [
          <GridActionsCellItem
            label='Details'
            title='Details'
            icon={<DetailsIcon />}
            onClick={() => nav(`${params.row.artist_id}/album`)}
          />,
        ];
      },
    },
  ];

  const getID = (row: artist) => row.artist_id;

  return (
    <Box
      component={'div'}
      key={'artist-album-wrapper'}
      id='artist-album-wrapper'
      sx={{ display: 'flex', flexWrap: 'wrap', width: '73vw' }}
    >
      <Box
        component={'div'}
        key='artists'
        id='artists'
        sx={{
          flex: '1 0 50%',
          borderTop: '3px solid purple',
          borderRight: '3px solid purple',
        }}
      >
        <Container component={'div'} id='artists-title-box' sx={{}}>
          <Paper elevation={6} key={'artist-list-box'} sx={{ height: '2rem' }}>
            <Typography
              aria-label='artists'
              component={'h2'}
              variant='h2'
              id='artists-label'
              data-testid='artists-label'
              sx={{
                textAlign: 'center',
                fontSize: '22px',
                fontWeight: 'bold',
              }}
            >
              {'Artist List'}
            </Typography>
          </Paper>
        </Container>
        <Box component={'div'} key={'artist-datagrid-box'} id='artist-datagrid-box'>
          <Box component={'div'} key={'add-artist-box'} sx={{ borderBottom: '2px solid purple', paddingTop: 1 }}>
            <AddArtist rowCountState={rowCountState} setRowCountState={setRowCountState} COUNT={COUNT} />
          </Box>

          <Box component={'div'} key={'artist-data-grid-wrapper'}>
            <DataGrid
              aria-label='artist-data-grid'
              apiRef={apiRef}
              columns={columns}
              rows={artists}
              getRowId={getID}
              rowCount={rowCountState}
              getRowHeight={() => 'auto'}
              pageSizeOptions={[10, 25, 50, 100]}
              paginationMode='server'
              onRowCountChange={newRowCount => setRowCountState(newRowCount)}
              onPaginationModelChange={handlePaginationModelChange}
              paginationModel={paginationModel}
            />
          </Box>
        </Box>
      </Box>
      <Box key={'albums-for-artist-box'} component={'div'} id='albums-for-artist-box' sx={{ flex: '0 1 100%' }}>
        <Outlet />
      </Box>
    </Box>
  );
};

export default Artist;
const handleUpdateArtistName = async (values: artist, apiRef: RefObject<GridApiCommunity | null>) => {
  try {
    const { artist_id, name } = values;
    const resp = await axios.patch(
      `${baseURL}/artists`,
      { artistID: artist_id, name: name },
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (resp.data && apiRef.current) {
      const { artist_id, name } = resp.data.updatedArtist;
      apiRef.current.updateRows([{ artist_id: artist_id, name: name }]);
    }
    console.log(resp.data);
  } catch (error) {
    console.error(error);
  }
};

const handleDeleteArtist = async (values: artist, apiRef: RefObject<GridApiCommunity | null>) => {
  try {
    const { artist_id } = values;
    const resp = await axios.delete(`${baseURL}/artists/${artist_id}`, {
      headers: { 'Content-Type': 'application/json' },
    });

    console.log(resp.data);
    if (resp.data.deletedArtist && apiRef.current) {
      const { artist_id } = resp.data.deletedArtist;
      apiRef.current.updateRows([{ artist_id: artist_id, _action: 'delete' }]);
    }
  } catch (err) {
    console.error(err);
  }
};
