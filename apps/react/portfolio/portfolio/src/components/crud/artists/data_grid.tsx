import type { artist } from '@aklapper/chinook-client';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DetailsIcon from '@mui/icons-material/Details';
import UploadIcon from '@mui/icons-material/Upload';
import { useGridApiRef } from '@mui/x-data-grid';
import { GridActionsCellItem } from '@mui/x-data-grid/components/cell';
import { DataGrid } from '@mui/x-data-grid/DataGrid';
import type { GridApiCommunity } from '@mui/x-data-grid/internals';
import type { GridColDef } from '@mui/x-data-grid/models/colDef';
import type { GridRowParams } from '@mui/x-data-grid/models/params';
import axios from 'axios';
import { useState, type RefObject } from 'react';
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
}

export default function ArtistDataGrid({ COUNT, setRowCountState }: ArtistDataGridProps) {
  const [paginationModel, setPaginationModel] = useState<PaginationModel>(paginationModelInit);
  const { state } = useFetchDataGridData<artist[]>(paginationModel, loadArtists);
  const nav = useNavigate();

  const apiRef = useGridApiRef<GridApiCommunity>();

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
    <DataGrid
      logLevel='info'
      aria-label='artist-data-grid'
      apiRef={apiRef}
      columns={columns}
      rows={state ?? []}
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
    />
  );
}

const baseURL = import.meta.env.VITE_CRUD_API_URL;

const handleUpdateArtistName = async (values: artist, apiRef: RefObject<GridApiCommunity | null>) => {
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
