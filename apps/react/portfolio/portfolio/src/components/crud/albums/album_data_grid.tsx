import type { album } from '@aklapper/chinook-client';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DetailsIcon from '@mui/icons-material/Details';
import UploadIcon from '@mui/icons-material/Upload';
import { DataGrid, GridActionsCellItem, type GridColDef, type GridRowParams } from '@mui/x-data-grid';
import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { useNavigate, useParams } from 'react-router';
import useFetchDataGridData from '../../../hooks/useFetchDataGridData';
import handleDeleteAlbum from '../../../services/actions/crud-actions/handle-delete-album.js';
import handleUpdateAlbumTitle from '../../../services/actions/crud-actions/handle-update-album-title.js';
import loadArtistAlbums from '../../../services/loaders/crud-loaders/load-artist-albums';
import { DATA_GRID_BG } from '../../../styles/base/base_styles';
import Theme from '../../../styles/themes/theme';
import type { PaginationModel } from '../artists/data_grid';

const paginationModelInit: PaginationModel = { page: 0, pageSize: 5 };

interface AlbumDataGrid {
  rows: album[] | null;
  setRows: Dispatch<SetStateAction<album[] | null>>;
}

export default function AlbumDataGrid({ rows, setRows }: AlbumDataGrid) {
  const { artistID } = useParams();
  const [dirtyRows, setDirtyRows] = useState<Set<number>>(new Set());
  const [paginationModel, setPaginationModel] = useState<PaginationModel>(paginationModelInit);
  const nav = useNavigate();

  useFetchDataGridData<album[]>(paginationModel, loadArtistAlbums, setRows, artistID);

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
              await handleUpdateAlbumTitle(row, setRows);
            }}
          />,

          <GridActionsCellItem
            label='Delete'
            title='Delete'
            icon={<DeleteForeverIcon color='error' />}
            onClick={async () => {
              await handleDeleteAlbum(row, setRows);
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
            onClick={() => nav(`${params.row.album_id}/tracks`, { replace: true })}
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
      columns={columns}
      rows={rows ?? []}
      rowCount={rows ? rows.length : 0}
      getRowId={getID}
      getRowHeight={() => 'auto'}
      pageSizeOptions={[1, 5, 10, 20]}
      paginationMode='server'
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
