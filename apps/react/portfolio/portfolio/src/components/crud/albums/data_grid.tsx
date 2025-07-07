import type { album } from '@aklapper/chinook-client';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DetailsIcon from '@mui/icons-material/Details';
import UploadIcon from '@mui/icons-material/Upload';
import { DataGrid, GridActionsCellItem, type GridColDef, type GridRowParams } from '@mui/x-data-grid';
import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams, type FetcherWithComponents } from 'react-router';
import handleDeleteAlbum from '../../../services/actions/crud-actions/handle-delete-album.js';
import handleUpdateAlbumTitle from '../../../services/actions/crud-actions/handle-update-album-title.js';
import { DATA_GRID_BG } from '../../../styles/base/base_styles.js';
import Theme from '../../../styles/themes/theme.js';
import type { PaginationModel } from '../artists/data_grid.js';

interface AlbumDataGrid {
  rows: album[];
  fetcher: FetcherWithComponents<album>;
}

export default function AlbumDataGrid({ rows, fetcher }: AlbumDataGrid) {
  const [paginationModel, setPaginationModel] = useState<PaginationModel>({ page: 0, pageSize: 5 });
  const [searchParams] = useSearchParams();
  const [dirtyRows, setDirtyRows] = useState<Set<number>>(new Set());
  const nav = useNavigate();

  const handleChangePagination = (model: PaginationModel) => {
    setPaginationModel(model);
  };

  const processRowUpdate = useCallback((newRow: album) => {
    setDirtyRows(prev => new Set(prev).add(newRow.album_id));

    return newRow;
  }, []);

  const columns: GridColDef[] = [
    {
      field: 'album_id',
      headerName: 'Album ID',
      type: 'number',
      flex: 0.75,
      cellClassName: 'album-id',
    },
    {
      field: 'title',
      headerName: 'Title',
      type: 'string',
      flex: 4,
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
      flex: 1.5,
      getActions: ({ row }: GridRowParams<album>) => {
        const isDirty = dirtyRows.has(row.album_id);
        return [
          <GridActionsCellItem
            label='Update'
            icon={<UploadIcon color={!isDirty ? 'disabled' : 'success'} />}
            title='Update'
            disabled={!isDirty}
            onClick={async () => {
              await handleUpdateAlbumTitle(row, fetcher.submit);
            }}
          />,

          <GridActionsCellItem
            label='Delete'
            title='Delete'
            icon={<DeleteForeverIcon color='error' />}
            onClick={async () => {
              await handleDeleteAlbum(row, fetcher.submit);
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
            label='Details'
            title='Details'
            icon={<DetailsIcon color='info' />}
            onClick={() => nav(`${params.row.album_id}/tracks?${searchParams}`, { replace: true })}
          />,
        ];
      },
    },
  ];

  const getID = (row: album) => {
    return row.album_id;
  };

  return (
    <DataGrid
      aria-label='artist-albums-data-grid'
      logLevel='debug'
      label='Albums'
      columns={columns}
      rows={rows}
      getRowId={getID}
      getRowHeight={() => 'auto'}
      pageSizeOptions={[1, 5, 10, 20]}
      paginationModel={paginationModel}
      onPaginationModelChange={handleChangePagination}
      processRowUpdate={processRowUpdate}
      onProcessRowUpdateError={error => console.error(error)}
      experimentalFeatures={{
        warnIfFocusStateIsNotSynced: true,
      }}
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
