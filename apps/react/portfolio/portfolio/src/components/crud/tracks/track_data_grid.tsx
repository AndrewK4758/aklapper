import type { track } from '@aklapper/chinook-client';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import UploadIcon from '@mui/icons-material/Upload';
import { GridActionsCellItem } from '@mui/x-data-grid/components/cell';
import { DataGrid } from '@mui/x-data-grid/DataGrid';
import type { GridColDef } from '@mui/x-data-grid/models/colDef';
import type { GridRowParams } from '@mui/x-data-grid/models/params';
import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { useLoaderData, useParams } from 'react-router';
import useFetchDataGridData from '../../../hooks/useFetchDataGridData';
import handleDeleteTrack from '../../../services/actions/crud-actions/handle-delete-track.js';
import handleUpdateTrack from '../../../services/actions/crud-actions/handle-update-track.js';
import loadAlbumTracks from '../../../services/loaders/crud-loaders/load-album-tracks';
import CRUD_THEME from '../../../styles/themes/crud_theme';
import Theme from '../../../styles/themes/theme';
import type { PaginationModel } from '../artists/data_grid';

const paginationModelInit: PaginationModel = {
  pageSize: 5,
  page: 0,
};

interface TracksDataGridProps {
  rows: track[] | null;
  setRows: Dispatch<SetStateAction<track[] | null>>;
}

export default function TracksDataGrid({ rows, setRows }: TracksDataGridProps) {
  const { albumID } = useParams();
  const count = useLoaderData() as number;

  const [dirtyRows, setDirtyRows] = useState<Set<number>>(new Set());
  const [paginationModel, setPaginationModel] = useState<PaginationModel>(paginationModelInit);

  useFetchDataGridData<track[]>(paginationModel, loadAlbumTracks, setRows, albumID);

  const processRowUpdate = useCallback((newRow: track) => {
    setDirtyRows(prev => new Set(prev).add(newRow.track_id));

    return newRow;
  }, []);

  const columns: GridColDef[] = [
    {
      field: 'track_id',
      headerName: 'Track ID',
      type: 'number',
      flex: 1,
      cellClassName: 'track-id',
    },
    {
      field: 'name',
      headerName: 'Name',
      type: 'string',
      editable: true,
      flex: 3,
      cellClassName: 'track-name',
    },
    {
      field: 'unit_price',
      type: 'number',
      headerName: 'Unit Price',
      editable: true,
      flex: 1,
      cellClassName: 'unit-price',
    },
    {
      field: 'genre_id',
      type: 'number',
      headerName: 'Genre ID',
      editable: true,
      flex: 1,
      cellClassName: 'genre-id',
    },
    {
      field: 'media_type_id',
      type: 'number',
      headerName: 'Media Type ID',
      editable: true,
      flex: 1,
      cellClassName: 'media-type-id',
    },
    {
      field: 'composer',
      type: 'string',
      headerName: 'Composer',
      editable: true,
      flex: 2,
      cellClassName: 'composer',
    },
    {
      field: 'milliseconds',
      type: 'number',
      headerName: 'Milliseconds',
      editable: true,
      flex: 1,
      cellClassName: 'milliseconds',
    },
    {
      field: 'bytes',
      type: 'number',
      headerName: 'Bytes',
      editable: true,
      flex: 1,
      cellClassName: 'bytes',
    },

    {
      field: 'update-delete',
      type: 'actions',
      headerName: 'Actions',
      flex: 1.5,
      getActions: ({ row }: GridRowParams<track>) => {
        const isDirty = dirtyRows.has(row.track_id);
        return [
          <GridActionsCellItem
            label='Update'
            icon={<UploadIcon color={!isDirty ? 'disabled' : 'success'} />}
            title='Update'
            disabled={!isDirty}
            onClick={() => {
              handleUpdateTrack(row, setRows);
            }}
          />,

          <GridActionsCellItem
            label='Delete'
            title='Delete'
            icon={<DeleteForeverIcon color='error' />}
            onClick={() => {
              handleDeleteTrack(row, setRows);
            }}
          />,
        ];
      },
    },
  ];

  const getID = (row: track) => row.track_id;

  return (
    <DataGrid
      aria-label='track-data-grid'
      columns={columns}
      rows={rows ?? []}
      rowCount={count}
      getRowId={getID}
      getRowHeight={() => 'auto'}
      pageSizeOptions={[1, 5, 10, 25]}
      paginationMode='server'
      paginationModel={paginationModel}
      onPaginationModelChange={newPageModel => setPaginationModel(newPageModel)}
      processRowUpdate={processRowUpdate}
      onProcessRowUpdateError={error => console.error(error)}
      sx={{
        '&.MuiDataGrid-root': {
          backgroundColor: CRUD_THEME.palette.background.default,
        },
        '& .MuiDataGrid-footerContainer': {
          backgroundColor: Theme.palette.background.paper,
          color: Theme.palette.text.secondary,
        },
        '& .MuiDataGrid-columnHeader': {
          backgroundColor: Theme.palette.background.paper,
          color: Theme.palette.text.secondary,
        },
        '.MuiDataGrid-columnSeparator': {
          color: Theme.palette.primary.dark,
        },
      }}
    />
  );
}
