import type { artist } from '@aklapper/chinook-client';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DetailsIcon from '@mui/icons-material/Details';
import UploadIcon from '@mui/icons-material/Upload';
import { useGridApiRef } from '@mui/x-data-grid';
import { GridActionsCellItem } from '@mui/x-data-grid/components/cell';
import { DataGrid } from '@mui/x-data-grid/DataGrid';
import { GridApiCommunity } from '@mui/x-data-grid/internals';
import type { GridColDef } from '@mui/x-data-grid/models/colDef';
import type { GridRowParams } from '@mui/x-data-grid/models/params';
import axios from 'axios';
import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router';
import useFetchDataGridData from '../../../hooks/useFetchDataGridData';
import loadArtists from '../../../services/loaders/crud-loaders/load-artists';

export type PaginationModel = {
  pageSize: number;
  page: number;
};

const paginationModelInit: PaginationModel = {
  pageSize: 25,
  page: 0,
};

interface ArtistDataGridProps {
  COUNT: number;
  setRowCountState: (rowCount: number) => void;
  rows: artist[] | null;
  setRows: Dispatch<SetStateAction<artist[] | null>>;
}

export default function ArtistDataGrid({ rows, setRows, COUNT, setRowCountState }: ArtistDataGridProps) {
  const [paginationModel, setPaginationModel] = useState<PaginationModel>(paginationModelInit);
  const [dirtyRows, setDirtyRows] = useState<Set<number>>(new Set());
  const dgApiRef = useGridApiRef<GridApiCommunity>();
  const nav = useNavigate();

  useFetchDataGridData<artist[]>(paginationModel, loadArtists, setRows);

  const processRowUpdate = useCallback((newRow: artist) => {
    setDirtyRows(prev => new Set(prev).add(newRow.artist_id));

    return newRow;
  }, []);

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

      getActions: ({ row }: GridRowParams) => {
        const isDirty = dirtyRows.has(row.artist_id);
        return [
          <GridActionsCellItem
            label='Update'
            icon={<UploadIcon color={!isDirty ? 'disabled' : 'success'} />}
            title='Update'
            id='update-button'
            disabled={!isDirty}
            onClick={() => handleUpdateArtistName(row, setRows)}
          />,
          <GridActionsCellItem
            label='Delete'
            title='Delete'
            id='delete-button'
            icon={<DeleteForeverIcon color='error' />}
            onClick={() => {
              handleDeleteArtist(row, setRows);
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
    <DataGrid
      apiRef={dgApiRef}
      logLevel='info'
      aria-label='artist-data-grid'
      columns={columns}
      rows={rows ?? []}
      getRowId={getID}
      rowCount={COUNT}
      getRowHeight={() => 'auto'}
      pageSizeOptions={[10, 25, 50, 100]}
      paginationMode='server'
      filterMode='server'
      sortingMode='server'
      onRowCountChange={newRowCount => setRowCountState(newRowCount)}
      onPaginationModelChange={setPaginationModel}
      paginationModel={paginationModel}
      processRowUpdate={processRowUpdate}
      onProcessRowUpdateError={error => console.error(error)}
    />
  );
}

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const handleUpdateArtistName = async (values: artist, setRows: Dispatch<SetStateAction<artist[] | null>>) => {
  try {
    const { artist_id, name } = values;
    const resp = await axios.patch(
      `${baseURL}/artists`,
      { artist_id, name },
      { headers: { 'Content-Type': 'application/json' } },
    );

    const newArtist = resp.data.updatedArtist as artist;

    setRows(
      prev =>
        prev &&
        prev.map(artist => {
          if (artist.artist_id === newArtist.artist_id) {
            return newArtist;
          } else return artist;
        }),
    );
  } catch (error) {
    console.error(error);
  }
};

const handleDeleteArtist = async (values: artist, setRows: Dispatch<SetStateAction<artist[] | null>>) => {
  try {
    const { artist_id } = values;
    const resp = await axios.delete(`${baseURL}/artists/${artist_id}`, {
      headers: { 'Content-Type': 'application/json' },
    });

    console.log(resp.data);
    if (resp.data.deletedArtist) {
      setRows(prev => prev && prev.filter(({ artist_id }) => artist_id !== resp.data.deletedArtist.artist_id));
    }
  } catch (err) {
    console.error(err);
  }
};
