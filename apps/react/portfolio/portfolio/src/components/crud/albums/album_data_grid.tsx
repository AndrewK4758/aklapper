import type { album } from '@aklapper/chinook-client';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DetailsIcon from '@mui/icons-material/Details';
import UploadIcon from '@mui/icons-material/Upload';
import { type GridColDef, type GridRowParams, DataGrid, GridActionsCellItem, useGridApiRef } from '@mui/x-data-grid';
import { useState } from 'react';
import { useLoaderData, useNavigate } from 'react-router';
import handleDeleteAlbum from '../../../services/events/crud-events/handle-delete-album';
import handleUpdateAlbumTitle from '../../../services/events/crud-events/handle-update-album-title';
import type { ArtistAlbums } from '../../../services/loaders/crud-loaders/load-artist-albums';
import type { PaginationModel } from '../artists/data_grid';

const paginationModelInit: PaginationModel = { page: 0, pageSize: 5 };

export default function AlbumDataGrid() {
  const { albums } = useLoaderData() as ArtistAlbums;
  const [paginationModel, setPaginationModel] = useState<PaginationModel>(paginationModelInit);
  const nav = useNavigate();

  const apiRef = useGridApiRef();

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
      getActions: (params: GridRowParams<album>) => {
        return [
          <GridActionsCellItem
            label='Update'
            icon={<UploadIcon color='success' />}
            title='Update'
            onClick={async x => {
              console.log(x);
              await handleUpdateAlbumTitle(params.row, apiRef);
            }}
          />,

          <GridActionsCellItem
            label='Delete'
            title='Delete'
            icon={<DeleteForeverIcon color='error' />}
            onClick={async () => {
              await handleDeleteAlbum(params.row, apiRef);
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
      apiRef={apiRef}
      columns={columns}
      rows={albums}
      getRowId={getID}
      getRowHeight={() => 'auto'}
      pageSizeOptions={[1, 5, 10, 20]}
      paginationModel={paginationModel}
      onPaginationModelChange={newPageModel => setPaginationModel(newPageModel)}
    />
  );
}
