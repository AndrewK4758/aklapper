import type { track } from '@aklapper/chinook-client';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import UploadIcon from '@mui/icons-material/Upload';
import { GridActionsCellItem } from '@mui/x-data-grid/components/cell';
import { DataGrid } from '@mui/x-data-grid/DataGrid';
import type { GridColDef } from '@mui/x-data-grid/models/colDef';
import type { GridRowParams } from '@mui/x-data-grid/models/params';
import { useCallback, useState } from 'react';
import { type FetcherWithComponents } from 'react-router';
import handleDeleteTrack from '../../../services/actions/crud-actions/handle-delete-track.js';
import handleUpdateTrack from '../../../services/actions/crud-actions/handle-update-track.js';
import { DATA_GRID_BG } from '../../../styles/base/base_styles.js';
import Theme from '../../../styles/themes/theme.js';
import type { PaginationModel } from '../artists/data_grid.js';

const paginationModelInit: PaginationModel = {
  pageSize: 5,
  page: 0,
};

interface TracksDataGridProps {
  rows: track[];
  fetcher: FetcherWithComponents<track>;
}

export default function TracksDataGrid({ rows, fetcher }: TracksDataGridProps) {
  const [dirtyRows, setDirtyRows] = useState<Set<number>>(new Set());
  const [paginationModel, setPaginationModel] = useState<PaginationModel>(paginationModelInit);

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
              handleUpdateTrack(row, fetcher.submit);
            }}
          />,

          <GridActionsCellItem
            label='Delete'
            title='Delete'
            icon={<DeleteForeverIcon color='error' />}
            onClick={() => {
              handleDeleteTrack(row, fetcher.submit);
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
      rows={rows}
      getRowId={getID}
      getRowHeight={() => 'auto'}
      pageSizeOptions={[1, 5, 10, 25]}
      paginationModel={paginationModel}
      onPaginationModelChange={newPageModel => setPaginationModel(newPageModel)}
      processRowUpdate={processRowUpdate}
      onProcessRowUpdateError={error => console.error(error)}
      sx={{
        '&.MuiDataGrid-root': {
          backgroundColor: DATA_GRID_BG,
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
