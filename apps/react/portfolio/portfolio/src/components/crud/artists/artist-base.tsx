import { Text, useScrollIntoView, Waiting } from '@aklapper/react-shared';
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
  type GridColDef,
  type GridRowParams,
  GridToolbar,
  useGridApiRef,
} from '@mui/x-data-grid';
import type { GridApiCommunity } from '@mui/x-data-grid/internals';
import axios from 'axios';
import { type JSX, type RefObject, useEffect, useRef, useState } from 'react';
import { Outlet, useLoaderData, useNavigate, useOutletContext } from 'react-router';
import waiting from '../../../assets/swirly-dots-to-chrome.webp';
import useFetchDataGridData from '../../../hooks/useFetchDataGridData.jsx';
import type { PaginationModel } from '../../../pages/crud/crud.jsx';
import loadArtists from '../../../services/loaders/crud-loaders/load-artists.jsx';
import { dataGridStyleUpdate } from '../../../styles/crud-styles.jsx';
import type { artist } from '../../../types/prisma_types';
import type { OutletContextProps } from '../../../types/types.js';
import AddArtist from './add-artist.jsx';

const paginationModelInit: PaginationModel = {
  pageSize: 25,
  page: 0,
};

/**
 * This component renders a page displaying a list of artists.
 * It includes functionality for adding, updating, deleting, and viewing the albums of each artist.
 *
 * @returns {JSX.Element} The rendered Artist component.
 */

const Artist = (): JSX.Element => {
  const COUNT = useLoaderData() as number;
  const [artists, setArtists] = useState<artist[] | undefined>(undefined);
  const [rowCountState, setRowCountState] = useState(COUNT);
  const [paginationModel, setPaginationModel] = useState<PaginationModel>(paginationModelInit);
  const { loading, setLoading } = useOutletContext<OutletContextProps>();
  const matchesSize = useMediaQuery('(max-width:1200px)');
  const divRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  const apiRef = useGridApiRef<GridApiCommunity>();

  useScrollIntoView(divRef);

  useEffect(() => {
    if (apiRef.current) setLoading(false);
  }, [apiRef.current]);

  useFetchDataGridData<artist[] | undefined>(paginationModel, setArtists, loadArtists);

  const columns: GridColDef[] = [
    {
      field: 'artist_id',
      headerName: 'Artist ID',
      type: 'number',
      flex: 0.75,
      editable: false,
      cellClassName: 'artist-id',
    },
    {
      field: 'name',
      headerName: 'Name',
      type: 'string',
      editable: true,
      filterable: true,
      flex: 3,
      cellClassName: 'artist-name',
    },
    {
      field: 'update-delete',
      type: 'actions',
      headerName: 'Update / Delete',
      flex: 1.5,
      getActions: (params: GridRowParams) => {
        return [
          <GridActionsCellItem
            label='Update'
            icon={<UploadIcon color='success' />}
            title='Update'
            id='update-button'
            onClick={() => handleUpdateArtistName(params.row, apiRef)}
          />,
          <GridActionsCellItem
            label='Delete'
            title='Delete'
            id='delete-button'
            icon={<DeleteForeverIcon color='error' />}
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
      headerName: 'Albums',
      flex: 0.75,
      getActions: (params: GridRowParams) => {
        return [
          <GridActionsCellItem
            label='Albums'
            title='Albums'
            icon={<DetailsIcon color='info' />}
            onClick={() => nav(`${params.row.artist_id}/albums`, { replace: true })}
          />,
        ];
      },
    },
  ];

  const getID = (row: artist) => row.artist_id;

  return (
    <Box
      component={'div'}
      key={'all-data-grids-wrapper'}
      id='all-data-grids-wrapper'
      ref={divRef}
      display={'flex'}
      flexDirection={matchesSize ? 'column' : 'row'}
      gap={0.5}
    >
      <Box
        component={'div'}
        key='artists'
        id='artists'
        sx={{
          flex: matchesSize ? '0 1 100%' : '0 1 50%',
          border: '3px solid purple',
          borderRadius: 1,
        }}
      >
        <Container component={'div'} key={'artists-title-box'} id='artists-title-box' sx={{ paddingY: 2 }}>
          <Paper
            elevation={1}
            key={'artist-list-box'}
            id='artist-list-box'
            component={'div'}
            sx={{ height: 'fit-content' }}
          >
            <Text
              component={'h3'}
              titleText={'Artist List'}
              titleVariant={'h3'}
              id='artists-title'
              sx={{
                textAlign: 'center',
              }}
            />
          </Paper>
        </Container>
        <Container component={'div'} key={'add-artist-box'} id={'add-artist-box'} sx={{ paddingY: 1 }}>
          <AddArtist rowCountState={rowCountState} setRowCountState={setRowCountState} COUNT={COUNT} />
        </Container>
        <Paper
          component={'div'}
          key={'artist-data-grid-wrapper'}
          id='artist-data-grid-wrapper'
          sx={{ borderRadius: 1 }}
        >
          {loading && <Waiting src={waiting} />}
          <DataGrid
            logLevel='debug'
            key={'artist-data-grid'}
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
            onPaginationModelChange={setPaginationModel}
            paginationModel={paginationModel}
            sx={dataGridStyleUpdate}
            slots={{ toolbar: GridToolbar }}
            slotProps={{
              pagination: {
                slotProps: {
                  select: {
                    slotProps: {
                      input: { id: 'artist-pagination-page-numbers' },
                    },
                  },
                },
              },
            }}
          />
        </Paper>
      </Box>
      <Box
        key={'albums-for-artist-box'}
        component={'div'}
        id='albums-for-artist-box'
        flex={matchesSize ? '0 1 100%' : '0 1 50%'}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default Artist;

const baseURL = import.meta.env.VITE_DATA_API_URL;

const handleUpdateArtistName = async (values: artist, apiRef: RefObject<GridApiCommunity>) => {
  try {
    const { artist_id, name } = values;
    const resp = await axios.patch(
      `${baseURL}/artists`,
      { artistID: artist_id, name: name },
      { headers: { 'Content-Type': 'application/json' } },
    );

    if (resp.data && apiRef.current) {
      const { artist_id, name } = resp.data.updatedArtist;
      apiRef.current.updateRows([{ artist_id: artist_id, name: name }]);
    }
  } catch (error) {
    console.error(error);
  }
};

const handleDeleteArtist = async (values: artist, apiRef: RefObject<GridApiCommunity>) => {
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
