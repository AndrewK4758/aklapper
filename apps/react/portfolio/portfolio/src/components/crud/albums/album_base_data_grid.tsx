import type { album } from '@aklapper/chinook-client';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DetailsIcon from '@mui/icons-material/Details';
import UploadIcon from '@mui/icons-material/Upload';
import { DataGrid, GridActionsCellItem, type GridColDef, type GridRowParams } from '@mui/x-data-grid';
import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { useLoaderData, useNavigate } from 'react-router';

import useFetchDataGridData from '../../../hooks/useFetchDataGridData';
import handleDeleteAlbum from '../../../services/actions/crud-actions/handle-delete-album.js';
import handleUpdateAlbumTitle from '../../../services/actions/crud-actions/handle-update-album-title.js';
import loadAlbums from '../../../services/loaders/crud-loaders/load-albums';
import { DATA_GRID_BG } from '../../../styles/base/base_styles';
import Theme from '../../../styles/themes/theme';

const paginationModelInit = {
  pageSize: 25,
  page: 0,
};

interface AlbumBaseDataGridProps {
  rows: album[] | null;
  setRows: Dispatch<SetStateAction<album[] | null>>;
}

export default function AlbumBaseDataGrid({ rows, setRows }: AlbumBaseDataGridProps) {
  const COUNT = useLoaderData() as number;
  const [dirtyRows, setDirtyRows] = useState<Set<number>>(new Set());
  const [rowCountState, setRowCountState] = useState(COUNT);
  const [paginationModel, setPaginationModel] = useState(paginationModelInit);
  const nav = useNavigate();
  useFetchDataGridData<album[]>(paginationModel, loadAlbums, setRows);

  const processRowUpdate = useCallback((newRow: album) => {
    setDirtyRows(prev => new Set(prev).add(newRow.album_id));

    return newRow;
  }, []);

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
      getActions: ({ row }: GridRowParams<album>) => {
        const isDirty = dirtyRows.has(row.album_id);
        return [
          <GridActionsCellItem
            label='Update'
            icon={<UploadIcon color={!isDirty ? 'disabled' : 'success'} />}
            title='Update'
            disabled={!isDirty}
            onClick={() => {
              handleUpdateAlbumTitle(row, setRows);
            }}
          />,

          <GridActionsCellItem
            label='Delete'
            title='Delete'
            icon={<DeleteForeverIcon color='error' />}
            onClick={() => {
              handleDeleteAlbum(row, setRows);
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
    <DataGrid
      logLevel='info'
      aria-label='album-data-grid'
      columns={columns}
      rows={rows ?? []}
      getRowId={getID}
      rowCount={rowCountState}
      getRowHeight={() => 'auto'}
      pageSizeOptions={[10, 25, 50, 100]}
      paginationMode='server'
      onRowCountChange={newRowCount => setRowCountState(newRowCount)}
      onPaginationModelChange={setPaginationModel}
      paginationModel={paginationModel}
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
